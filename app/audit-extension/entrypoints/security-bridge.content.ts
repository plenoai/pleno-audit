/**
 * Security Bridge Content Script
 * Main worldからの検知イベントをキュー制御し、負荷に応じてバッチでbackgroundへ送信する。
 */

import { createLogger, isRuntimeAvailable, fireMessage, createEventQueue } from "@libztbs/extension-runtime";

const logger = createLogger("security-bridge");

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const abortController = new AbortController();

    const eventQueue = createEventQueue({
      logger,
      isRuntimeAvailable,
      sendEvent: (event) =>
        chrome.runtime.sendMessage({ type: event.type, data: event.data }) as Promise<void>,
      fireEvent: (event) =>
        fireMessage({ type: event.type, data: event.data }),
      scheduleIdle: typeof window.requestIdleCallback === "function"
        ? (cb, timeout) => {
            window.requestIdleCallback(cb, { timeout });
            return 0;
          }
        : undefined,
      scheduleTimeout: (cb, ms) => window.setTimeout(cb, ms),
      clearTimeout: (id) => window.clearTimeout(id),
    });

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          if (list.getEntries().length > 0) {
            eventQueue.notifyLongTask();
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
      // XSS via innerHTML removed (prototype modification triggers anti-tamper SDKs)
      "__DOM_SCRAPING_DETECTED__",
      "__SUSPICIOUS_DOWNLOAD_DETECTED__",
      "__WORKER_CREATED__",
      "__SHARED_WORKER_CREATED__",
      "__SERVICE_WORKER_REGISTERED__",
      // eval/Function hooks removed (anti-tamper compatibility)
      "__FULLSCREEN_PHISHING_DETECTED__",
      "__CANVAS_FINGERPRINT_DETECTED__",
      "__WEBGL_FINGERPRINT_DETECTED__",
      "__AUDIO_FINGERPRINT_DETECTED__",
      "__WEBRTC_CONNECTION_DETECTED__",
      "__SEND_BEACON_DETECTED__",
      "__DEVICE_ENUMERATION_DETECTED__",
      "__STORAGE_EXFILTRATION_DETECTED__",
      // Prototype pollution hooks removed (anti-tamper compatibility)
      "__DNS_PREFETCH_LEAK_DETECTED__",
      "__FORM_HIJACK_DETECTED__",
      "__CSS_KEYLOGGING_DETECTED__",
      "__DOM_CLOBBERING_DETECTED__",
      "__FETCH_EXFILTRATION_DETECTED__",
      "__WASM_EXECUTION_DETECTED__",
      "__EXECCOMMAND_DETECTED__",
      // addEventListener hooks removed (anti-tamper compatibility)
    ];

    const signal = abortController.signal;
    for (const eventType of securityEvents) {
      window.addEventListener(eventType, ((event: CustomEvent) => {
        const type = eventType.replace(/^__|__$/g, "");
        queueMicrotask(() => eventQueue.push(type, event.detail));
      }) as EventListener, { signal });
    }

    window.addEventListener("beforeunload", () => {
      eventQueue.flushSync();
    }, { signal });
  },
});
