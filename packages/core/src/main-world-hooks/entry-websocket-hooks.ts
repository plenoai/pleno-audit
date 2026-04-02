import { getSharedHooks } from "./shared.js";
import { initWebSocketHooks } from "./websocket-hooks.js";

;(function () {
  "use strict";
  if (window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__) return;
  window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__ = true;
  const shared = getSharedHooks();
  if (!shared) return;
  initWebSocketHooks(shared.emitSecurityEvent);
})();
