/**
 * Security Bridge Content Script
 * Main worldからの検知イベントをキュー制御し、負荷に応じてバッチでstorageキューに書き込む。
 * Background SWの生死に依存しない永続キュー方式。
 */

import { createLogger } from "@pleno-audit/extension-runtime";
import { createProducer, type QueueAdapter, type Priority } from "@pleno-audit/event-queue";

const logger = createLogger("security-bridge");

const queueAdapter: QueueAdapter = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

type RuntimeEvent = {
  type: string;
  data: Record<string, unknown>;
  priority: Priority;
};

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const tabId = chrome.runtime.id ? (Date.now() % 1_000_000) : 0;
    const MAX_QUEUE = 200;
    const MAX_UNLOAD_BATCH = 50;
    const queue: RuntimeEvent[] = [];
    let flushScheduled = false;
    let longTaskDetectedAt = 0;
    let fallbackTimer: number | null = null;

    // Producer is initialized lazily once we know the tab ID
    let producer: ReturnType<typeof createProducer> | null = null;

    function getProducer(): ReturnType<typeof createProducer> {
      if (!producer) {
        // Use a stable ID derived from runtime. Content scripts don't have sender.tab.id,
        // so we use a combination that's unique per content script instance.
        producer = createProducer(queueAdapter, tabId);
        producer.setContext({ senderUrl: window.location.href });
      }
      return producer;
    }

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

    function getPriority(type: string): Priority {
      return HIGH_PRIORITY_TYPES.has(type) ? "high" : "low";
    }

    function pushEvent(type: string, detail: unknown): void {
      const now = Date.now();
      if (throttleLowPriority(type, now)) return;

      const payload = (detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : {}) as Record<string, unknown>;

      const priority = getPriority(type);

      if (queue.length >= MAX_QUEUE) {
        if (priority !== "high") return;
        queue.shift();
      }

      queue.push({
        type,
        data: {
          ...payload,
          source: "security-bridge",
          queuedAt: now,
        },
        priority,
      });

      scheduleFlush();
    }

    function scheduleFlush(): void {
      if (flushScheduled) return;
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
          await getProducer().enqueueBatch(
            batch.map((e) => ({
              type: e.type,
              data: { data: e.data } as Record<string, unknown>,
              priority: e.priority,
            })),
          );
        } catch (error) {
          logger.warn("Queue write failed, re-queuing events", error);
          for (let i = batch.length - 1; i >= 0; i--) {
            queue.unshift(batch[i]);
          }
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

    for (const eventType of securityEvents) {
      window.addEventListener(eventType, ((event: CustomEvent) => {
        const type = eventType.replace(/^__|__$/g, "");
        queueMicrotask(() => pushEvent(type, event.detail));
      }) as EventListener);
    }

    window.addEventListener("beforeunload", () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (queue.length > 0) {
        const batch = queue.splice(0, MAX_UNLOAD_BATCH);
        // Fire-and-forget: storage write may complete even after unload
        void getProducer().enqueueBatch(
          batch.map((e) => ({
            type: e.type,
            data: { data: e.data } as Record<string, unknown>,
            priority: e.priority,
          })),
        );
      }
    });
  },
});
