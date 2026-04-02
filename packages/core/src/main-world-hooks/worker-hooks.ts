/**
 * @fileoverview Worker Detection Hooks
 *
 * Worker, SharedWorker, ServiceWorker の作成を検出。
 */

import { type SharedHookUtils } from "./shared.js";

export function initWorkerHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  const workerUrlsSeen = new Set<string>();

  // Worker — deduplicated by URL
  const OriginalWorker = window.Worker;
  window.Worker = function (scriptURL: string | URL, options?: WorkerOptions) {
    const url = typeof scriptURL === "string" ? scriptURL : scriptURL.toString();
    if (!workerUrlsSeen.has(url)) {
      workerUrlsSeen.add(url);
      emitSecurityEvent("__WORKER_CREATED__", { url, ts: Date.now() });
    }
    return new OriginalWorker(scriptURL, options);
  } as unknown as typeof Worker;
  window.Worker.prototype = OriginalWorker.prototype;

  // SharedWorker — deduplicated by URL
  if (window.SharedWorker) {
    const OriginalSharedWorker = window.SharedWorker;
    window.SharedWorker = function (scriptURL: string | URL, options?: string | WorkerOptions) {
      const url = typeof scriptURL === "string" ? scriptURL : scriptURL.toString();
      if (!workerUrlsSeen.has(url)) {
        workerUrlsSeen.add(url);
        emitSecurityEvent("__SHARED_WORKER_CREATED__", {
          url,
          name: typeof options === "string" ? options : options?.name,
          timestamp: Date.now(),
        });
      }
      return new OriginalSharedWorker(scriptURL, options as string);
    } as unknown as typeof SharedWorker;
    window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  }

  // ServiceWorker — deduplicated by scope
  if (navigator.serviceWorker) {
    const swScopesSeen = new Set<string>();
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = function (scriptURL: string | URL, options?: RegistrationOptions) {
      const url = typeof scriptURL === "string" ? scriptURL : scriptURL.toString();
      const scope = options?.scope ?? url;
      if (!swScopesSeen.has(scope)) {
        swScopesSeen.add(scope);
        emitSecurityEvent("__SERVICE_WORKER_REGISTERED__", {
          url,
          scope: options?.scope,
          type: options?.type || "classic",
          timestamp: Date.now(),
        });
      }
      return originalRegister(scriptURL, options);
    };
  }
}
