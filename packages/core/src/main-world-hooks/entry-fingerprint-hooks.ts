import { getSharedHooks } from "./shared.js";
import { initFingerprintHooks } from "./fingerprint-hooks.js";

;(function () {
  "use strict";
  if (window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__) return;
  window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__ = true;
  const shared = getSharedHooks();
  if (!shared) return;
  initFingerprintHooks(shared.emitSecurityEvent);
})();
