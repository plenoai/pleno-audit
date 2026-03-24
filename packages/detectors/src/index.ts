// Detection Types
export type {
  DOMAdapter,
  DetectionMethod,
  DetectionResult,
  PrivacyPolicyResult,
  TosResult,
  CookiePolicyResult,
  CookieBannerResult,
  LoginDetectionResult,
} from "./types.js";

// Patterns (CASB Domain Knowledge)
export {
  // Authentication Detection
  LOGIN_URL_PATTERNS,
  isLoginUrl,
  // Privacy Policy Detection
  PRIVACY_URL_PATTERNS,
  PRIVACY_TEXT_PATTERNS,
  JSONLD_PRIVACY_KEYS,
  LINK_REL_PRIVACY_VALUES,
  OG_PRIVACY_PATTERNS,
  FOOTER_SELECTORS,
  isPrivacyUrl,
  isPrivacyText,
  // Terms of Service Detection
  TOS_URL_PATTERNS,
  TOS_TEXT_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
  TOS_OG_PATTERNS,
  isTosUrl,
  isTosText,
  // Cookie Policy Detection
  COOKIE_POLICY_URL_PATTERNS,
  COOKIE_POLICY_TEXT_PATTERNS,
  COOKIE_JSONLD_KEYS,
  COOKIE_LINK_REL_VALUES,
  COOKIE_OG_PATTERNS,
  COOKIE_BANNER_SELECTORS,
  COOKIE_CONSENT_BUTTON_PATTERNS,
  isCookiePolicyUrl,
  isCookiePolicyText,
  isCookieConsentButton,
  // Session Detection
  SESSION_COOKIE_PATTERNS,
  isSessionCookie,
} from "./patterns.js";

// URL Utilities
export {
  decodeUrlSafe,
  getPathFromUrl,
  extractOrigin,
  resolveUrl,
} from "./url-utils.js";

// Detector factories
export { createPrivacyFinder } from "./privacy-finder.js";
export { createTosFinder } from "./tos-finder.js";
export { createCookiePolicyFinder, createCookieBannerFinder } from "./cookie-finder.js";
export { createLoginDetector } from "./login-detector.js";

// Favicon Detection
export type { FaviconRequest } from "./favicon-detector.js";
export { findFaviconUrl, findFavicons } from "./favicon-detector.js";

// Security Detection Patterns
export {
  SENSITIVE_INPUT_TYPES,
  SENSITIVE_FIELD_NAMES,
  hasSensitiveField,
  CRYPTO_ADDRESS_PATTERNS,
  detectCryptoAddress,
  XSS_PATTERNS,
  containsXSSPattern,
  SUSPICIOUS_FILE_EXTENSIONS,
  isSuspiciousFileExtension,
  KNOWN_CDN_DOMAINS,
  isKnownCDN,
} from "./security-patterns.js";

// Service Filters
export {
  filterNRDServices,
  filterLoginServices,
  filterTyposquatServices,
  filterAIServices,
} from "./service-filters.js";

// Service Explorer
export {
  buildServiceIndex,
  queryServiceIndex,
  type FilterCategory,
  type ServiceIndex,
  type ServiceQuery,
  type ServiceQueryResult,
} from "./service-explorer.js";
