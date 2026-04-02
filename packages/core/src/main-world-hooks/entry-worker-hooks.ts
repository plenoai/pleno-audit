import { getSharedHooks } from "./shared.js";
import { initWorkerHooks } from "./worker-hooks.js";

;(function () {
  "use strict";
  if (window.__PLENO_WORKER_HOOKS_INITIALIZED__) return;
  window.__PLENO_WORKER_HOOKS_INITIALIZED__ = true;
  const shared = getSharedHooks();
  if (!shared) return;
  initWorkerHooks(shared.emitSecurityEvent);
})();
