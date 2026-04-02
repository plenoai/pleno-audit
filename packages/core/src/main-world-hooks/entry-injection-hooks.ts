import { getSharedHooks } from "./shared.js";
import { initInjectionHooks } from "./injection-hooks.js";

;(function () {
  "use strict";
  if (window.__PLENO_INJECTION_HOOKS_INITIALIZED__) return;
  window.__PLENO_INJECTION_HOOKS_INITIALIZED__ = true;
  const shared = getSharedHooks();
  if (!shared) return;
  initInjectionHooks(shared.emitSecurityEvent);
})();
