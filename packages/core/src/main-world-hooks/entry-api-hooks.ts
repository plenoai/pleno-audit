/**
 * @fileoverview api-hooks entry point
 *
 * main-worldに注入されるメインフック。
 * ビルド時にIIFE形式にバンドルされる。
 */

import { getSharedHooks } from "./shared.js";
import { initAIHooks } from "./ai-hooks.js";
import { initSecurityHooks } from "./security-hooks.js";
import { setupDLPHooks } from "./dlp-hooks.js";

;(function () {
  "use strict";
  if (window.__SERVICE_DETECTION_CSP_INITIALIZED__) return;
  window.__SERVICE_DETECTION_CSP_INITIALIZED__ = true;

  const shared = getSharedHooks();
  initAIHooks(shared);
  initSecurityHooks(shared.emitSecurityEvent);
  setupDLPHooks(shared);
})();
