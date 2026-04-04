/**
 * @libztbs/main-world-hooks
 *
 * ブラウザのmain-worldに注入されるセキュリティ検出フック。
 * 各フックはIIFE形式にバンドルされ、拡張機能のpublic/に配置される。
 */

export { createSharedHookUtils, getSharedHooks, emitSecurityEvent, getBodySize, getBodySample, type SharedHookUtils } from "./shared.js";
export { initAIHooks, isLikelyAIUrl, AI_URL_MARKERS, getBodySample as getAIBodySample } from "./ai-hooks.js";
export {
  initSecurityHooks, checkSupplyChainRisk, hasSensitiveFields, checkOpenRedirect,
  KNOWN_CDNS, SENSITIVE_TYPES, SENSITIVE_NAMES, CRYPTO_PATTERNS, SUSPICIOUS_EXTENSIONS,
} from "./security-hooks.js";
export { initFingerprintHooks } from "./fingerprint-hooks.js";
export { initWebSocketHooks } from "./websocket-hooks.js";
export { initWorkerHooks } from "./worker-hooks.js";
export { initInjectionHooks } from "./injection-hooks.js";
export { setupDLPHooks } from "./dlp-hooks.js";
