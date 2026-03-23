/**
 * Security Bridge Content Script
 * Main worldからの検知イベントをキュー制御し、負荷に応じてバッチでbackgroundへ送信する。
 */

import { createLogger, isRuntimeAvailable, fireMessage } from "@pleno-audit/extension-runtime";

const logger = createLogger("security-bridge");

type RuntimeEvent = {
  type: string;
  data: Record<string, unknown>;
};

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const MAX_QUEUE = 200;
    const MAX_UNLOAD_BATCH = 50;
    const queue: RuntimeEvent[] = [];
    let flushScheduled = false;
    let longTaskDetectedAt = 0;
    let fallbackTimer: number | null = null;
    const abortController = new AbortController();

    const LOW_PRIORITY_TYPES = new Set([
      "COOKIE_ACCESS_DETECTED",
      "DOM_SCRAPING_DETECTED",
      "TRACKING_BEACON_DETECTED",
      "NETWORK_INSPECTION_REQUEST",
      "DYNAMIC_CODE_EXECUTION_DETECTED",
      "GEOLOCATION_ACCESSED",
    ]);
    const HIGH_PRIORITY_TYPES = new Set([
      "AI_PROMPT_CAPTURED",
      "XSS_DETECTED",
      "SUSPICIOUS_DOWNLOAD_DETECTED",
      "CREDENTIAL_THEFT_DETECTED",
      "SUPPLY_CHAIN_RISK_DETECTED",
    ]);
    const lastLowPrioritySentAt = new Map<string, number>();

    function isHighLoad(now: number): boolean {
      return now - longTaskDetectedAt < 2000 || queue.length > 80;
    }

    function throttleLowPriority(type: string, now: number): boolean {
      if (!LOW_PRIORITY_TYPES.has(type)) return false;
      const prev = lastLowPrioritySentAt.get(type) ?? 0;
      const minInterval = isHighLoad(now) ? 2000 : 800;
      if (now - prev < minInterval) return true;
      lastLowPrioritySentAt.set(type, now);
      return false;
    }

    function isHighPriority(type: string): boolean {
      return HIGH_PRIORITY_TYPES.has(type);
    }

    function teardown(): void {
      queue.length = 0;
      abortController.abort();
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      logger.warn("Extension context invalidated — bridge stopped");
    }

    function pushEvent(type: string, detail: unknown): void {
      if (!isRuntimeAvailable()) return;
      const now = Date.now();
      if (throttleLowPriority(type, now)) return;

      const payload = (detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : {}) as Record<string, unknown>;

      if (queue.length >= MAX_QUEUE) {
        if (!isHighPriority(type)) return;
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

    function scheduleFlush(): void {
      if (flushScheduled || !isRuntimeAvailable()) return;
      flushScheduled = true;

      const now = Date.now();
      const highLoad = isHighLoad(now);
      const timeoutMs = highLoad ? 600 : 120;

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(
          (deadline) => {
            void flushQueue(deadline);
          },
          { timeout: timeoutMs },
        );
        return;
      }

      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        void flushQueue();
      }, timeoutMs);
    }

    async function flushQueue(deadline?: IdleDeadline): Promise<void> {
      flushScheduled = false;
      if (queue.length === 0) return;

      if (!isRuntimeAvailable()) {
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
          await Promise.all(
            batch.map((e) =>
              chrome.runtime.sendMessage({ type: e.type, data: e.data }),
            ),
          );
        } catch {
          // isRuntimeAvailable() で事前チェック済みのため、
          // ここに到達するのはレースコンディションのみ — teardown して終了
          teardown();
          return;
        }
      }

      if (queue.length > 0) {
        scheduleFlush();
      }
    }

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            longTaskDetectedAt = Date.now();
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // longtask is not available in all pages/browsers
      }
    }

    const securityEvents = [
      "__AI_PROMPT_CAPTURED__",
      "__CREDENTIAL_THEFT_DETECTED__",
      "__SUPPLY_CHAIN_RISK_DETECTED__",
      "__TRACKING_BEACON_DETECTED__",
      "__NETWORK_INSPECTION_REQUEST__",
      "__CLIPBOARD_HIJACK_DETECTED__",
      "__COOKIE_ACCESS_DETECTED__",
      "__XSS_DETECTED__",
      "__DOM_SCRAPING_DETECTED__",
      "__SUSPICIOUS_DOWNLOAD_DETECTED__",
      "__WEBSOCKET_CONNECTION_DETECTED__",
      "__WORKER_CREATED__",
      "__SHARED_WORKER_CREATED__",
      "__SERVICE_WORKER_REGISTERED__",
      "__DYNAMIC_CODE_EXECUTION_DETECTED__",
      "__FULLSCREEN_PHISHING_DETECTED__",
      "__CLIPBOARD_READ_DETECTED__",
      "__GEOLOCATION_ACCESSED__",
      "__CANVAS_FINGERPRINT_DETECTED__",
      "__WEBGL_FINGERPRINT_DETECTED__",
      "__AUDIO_FINGERPRINT_DETECTED__",
      "__BROADCAST_CHANNEL_DETECTED__",
      "__WEBRTC_CONNECTION_DETECTED__",
    ];

    const signal = abortController.signal;
    for (const eventType of securityEvents) {
      window.addEventListener(eventType, ((event: CustomEvent) => {
        const type = eventType.replace(/^__|__$/g, "");
        queueMicrotask(() => pushEvent(type, event.detail));
      }) as EventListener, { signal });
    }

    window.addEventListener("beforeunload", () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (!isRuntimeAvailable() || queue.length === 0) return;
      const batch = queue.splice(0, MAX_UNLOAD_BATCH);
      for (const e of batch) {
        fireMessage({ type: e.type, data: e.data });
      }
    }, { signal });
  },
});
