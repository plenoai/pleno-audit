/**
 * @libztbs/main-world-hooks
 *
 * ブラウザのmain-worldに注入されるセキュリティ検出フック。
 * 各フックはIIFE形式にバンドルされ、拡張機能のpublic/に配置される。
 */

export { createSharedHookUtils, getSharedHooks, emitSecurityEvent, type SharedHookUtils } from "./shared.js";
export { initAIHooks } from "./ai-hooks.js";
export { initSecurityHooks } from "./security-hooks.js";
export { initFingerprintHooks } from "./fingerprint-hooks.js";
export { initWebSocketHooks } from "./websocket-hooks.js";
export { initWorkerHooks } from "./worker-hooks.js";
export { initInjectionHooks } from "./injection-hooks.js";
