/**
 * @fileoverview Security Event Queue
 *
 * Main worldからの検知イベントをキュー制御し、
 * 負荷に応じてバッチでbackgroundへ送信するための汎用キュー。
 */

import type { Logger } from "./logger.js";

export interface RuntimeEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface EventQueueConfig {
  /** キュー最大サイズ（デフォルト: 200） */
  maxQueue?: number;
  /** beforeunloadで送信する最大バッチサイズ（デフォルト: 50） */
  maxUnloadBatch?: number;
  /** 低優先度イベントタイプ */
  lowPriorityTypes?: string[];
  /** 高優先度イベントタイプ */
  highPriorityTypes?: string[];
}

export interface EventQueueDeps {
  logger: Logger;
  /** ランタイムが利用可能かチェック */
  isRuntimeAvailable: () => boolean;
  /** イベントをバックグラウンドに送信 */
  sendEvent: (event: RuntimeEvent) => Promise<void>;
  /** 一方向のメッセージ送信（beforeunload用） */
  fireEvent: (event: RuntimeEvent) => void;
  /** requestIdleCallbackのラッパー（環境依存を吸収） */
  scheduleIdle?: (callback: (deadline?: IdleDeadline) => void, timeout: number) => number;
  /** setTimeout相当 */
  scheduleTimeout: (callback: () => void, ms: number) => number;
  /** clearTimeout相当 */
  clearTimeout: (id: number) => void;
}

export interface EventQueue {
  /** イベントをキューに追加 */
  push(type: string, detail: unknown): void;
  /** beforeunload時にキューを同期的に送信 */
  flushSync(): void;
  /** キューを破棄して停止 */
  teardown(): void;
  /** long taskが検出された時に呼ぶ */
  notifyLongTask(): void;
  /** 現在のキューサイズ */
  readonly size: number;
}

const DEFAULT_CONFIG: Required<EventQueueConfig> = {
  maxQueue: 200,
  maxUnloadBatch: 50,
  lowPriorityTypes: [
    "DOM_SCRAPING_DETECTED",
    "TRACKING_BEACON_DETECTED",
    "NETWORK_INSPECTION_REQUEST",
    "DYNAMIC_CODE_EXECUTION_DETECTED",
    "GEOLOCATION_ACCESSED",
    "DEVICE_SENSOR_ACCESSED",
    "DEVICE_ENUMERATION_DETECTED",
    "BROADCAST_CHANNEL_DETECTED",
    "WEBRTC_CONNECTION_DETECTED",
    "SEND_BEACON_DETECTED",
    "STORAGE_EXFILTRATION_DETECTED",
  ],
  highPriorityTypes: [
    "AI_PROMPT_CAPTURED",
    "XSS_DETECTED",
    "SUSPICIOUS_DOWNLOAD_DETECTED",
    "CREDENTIAL_THEFT_DETECTED",
    "SUPPLY_CHAIN_RISK_DETECTED",
    "FULLSCREEN_PHISHING_DETECTED",
    "MEDIA_CAPTURE_DETECTED",
    "CLIPBOARD_HIJACK_DETECTED",
  ],
};

export function createEventQueue(
  deps: EventQueueDeps,
  config: EventQueueConfig = {},
): EventQueue {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const lowPriority = new Set(cfg.lowPriorityTypes);
  const highPriority = new Set(cfg.highPriorityTypes);

  const queue: RuntimeEvent[] = [];
  let flushScheduled = false;
  let longTaskDetectedAt = 0;
  let fallbackTimer: number | null = null;
  let stopped = false;

  const lastLowPrioritySentAt = new Map<string, number>();

  function isHighLoad(now: number): boolean {
    return now - longTaskDetectedAt < 2000 || queue.length > 80;
  }

  function throttleLowPriority(type: string, now: number): boolean {
    if (!lowPriority.has(type)) return false;
    const prev = lastLowPrioritySentAt.get(type) ?? 0;
    const minInterval = isHighLoad(now) ? 2000 : 800;
    if (now - prev < minInterval) return true;
    lastLowPrioritySentAt.set(type, now);
    return false;
  }

  function scheduleFlush(): void {
    if (flushScheduled || stopped || !deps.isRuntimeAvailable()) return;
    flushScheduled = true;

    const now = Date.now();
    const highLoad = isHighLoad(now);
    const timeoutMs = highLoad ? 600 : 120;

    if (deps.scheduleIdle) {
      deps.scheduleIdle(
        (deadline) => {
          void flushQueue(deadline);
        },
        timeoutMs,
      );
      return;
    }

    fallbackTimer = deps.scheduleTimeout(() => {
      fallbackTimer = null;
      void flushQueue();
    }, timeoutMs);
  }

  async function flushQueue(deadline?: IdleDeadline): Promise<void> {
    flushScheduled = false;
    if (queue.length === 0) return;

    if (!deps.isRuntimeAvailable()) {
      teardown();
      return;
    }

    const now = Date.now();
    const highLoad = isHighLoad(now);
    const batchSize = highLoad ? 12 : 40;
    const start = performance.now();
    const budgetMs = highLoad ? 2 : 6;

    const batch: RuntimeEvent[] = [];
    while (queue.length > 0 && batch.length < batchSize) {
      if (deadline && deadline.timeRemaining() <= 1) break;
      if (!deadline && performance.now() - start >= budgetMs) break;
      const item = queue.shift();
      if (item) batch.push(item);
    }

    if (batch.length > 0) {
      try {
        await Promise.all(batch.map((e) => deps.sendEvent(e)));
      } catch {
        teardown();
        return;
      }
    }

    if (queue.length > 0) {
      scheduleFlush();
    }
  }

  function push(type: string, detail: unknown): void {
    if (stopped || !deps.isRuntimeAvailable()) return;
    const now = Date.now();
    if (throttleLowPriority(type, now)) return;

    const payload = (detail && typeof detail === "object"
      ? (detail as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    if (queue.length >= cfg.maxQueue) {
      if (!highPriority.has(type)) return;
      queue.shift();
    }

    queue.push({
      type,
      data: {
        ...payload,
        source: "security-bridge",
        queuedAt: now,
      },
    });

    scheduleFlush();
  }

  function flushSync(): void {
    if (fallbackTimer !== null) {
      deps.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (!deps.isRuntimeAvailable() || queue.length === 0) return;
    const batch = queue.splice(0, cfg.maxUnloadBatch);
    for (const e of batch) {
      deps.fireEvent(e);
    }
  }

  function teardown(): void {
    stopped = true;
    queue.length = 0;
    if (fallbackTimer !== null) {
      deps.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    deps.logger.warn("Extension context invalidated — bridge stopped");
  }

  function notifyLongTask(): void {
    longTaskDetectedAt = Date.now();
  }

  return {
    push,
    flushSync,
    teardown,
    notifyLongTask,
    get size() {
      return queue.length;
    },
  };
}
