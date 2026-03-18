// CASB Domain Types
export type {
  DetectedService,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookiePolicyFoundDetails,
  CookieBannerDetectedDetails,
  CookieSetDetails,
  NRDDetectedDetails,
  ExtensionRequestDetails,
  AISensitiveDataDetectedDetails,
  EventLogBase,
  EventLog,
  EventLogType,
} from "./casb-types.js";

// NRD Detection (re-export from @pleno-audit/nrd)
export type {
  SuspiciousDomainScores,
  DDNSInfo,
  DDNSResult,
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  NRDCache,
  RDAPEvent,
  RDAPResponse,
} from "@pleno-audit/nrd";

export {
  DEFAULT_NRD_CONFIG,
  createNRDDetector,
} from "@pleno-audit/nrd";

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

// AI Prompt Detection (re-export from @pleno-audit/ai-detector)
export type {
  InferredProvider,
  AIDetectionMethod,
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
  AIPromptPIIResult,
  AIPromptRiskAssessment,
  AIPromptAnalysisResult,
  // Provider Classification Types
  ExtendedProvider,
  ProviderClassification,
  ProviderInfo,
} from "@pleno-audit/ai-detector";

export {
  DEFAULT_AI_MONITOR_CONFIG,
  isAIRequestBody,
  extractPromptContent,
  extractModel,
  extractResponseContent,
  inferProviderFromResponse,
  analyzePromptPII,
  calculatePromptRiskScore,
  analyzePrompt,
  // Provider Classification Functions
  classifyByModelName,
  classifyByUrl,
  classifyByResponseStructure,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
  PROVIDER_INFO,
  // DLP Rules
  createDLPManager,
  EXTENDED_DLP_RULES,
  DEFAULT_DLP_CONFIG,
} from "@pleno-audit/ai-detector";

export type {
  DLPRule,
  DLPConfig,
  DLPDetectionResult,
  DLPAnalysisResult,
  DLPManager,
} from "@pleno-audit/ai-detector";

// Typosquatting Detection (re-export from @pleno-audit/typosquat)
export type {
  HomoglyphType,
  HomoglyphMatch,
  ScriptType,
  ScoreBreakdown,
  TyposquatScores,
  TyposquatDetectionMethod,
  TyposquatConfidence,
  TyposquatResult,
  TyposquatConfig,
  TyposquatDetectedDetails,
  TyposquatCache,
} from "@pleno-audit/typosquat";

export {
  DEFAULT_TYPOSQUAT_CONFIG,
  LATIN_HOMOGLYPHS,
  CYRILLIC_TO_LATIN,
  JAPANESE_HOMOGLYPHS,
  getCharacterScript,
  detectScripts,
  isSuspiciousMixedScript,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  detectJapaneseHomoglyphs,
  isPunycodeDomain,
  decodePunycode,
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
  createTyposquatDetector,
} from "@pleno-audit/typosquat";

// Alert System (re-export from @pleno-audit/alerts)
export type {
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  SecurityAlert,
  AlertDetails,
  NRDAlertDetails,
  TyposquatAlertDetails,
  DataLeakAlertDetails,
  DataExfiltrationAlertDetails,
  CredentialTheftAlertDetails,
  SupplyChainAlertDetails,
  CSPAlertDetails,
  AISensitiveAlertDetails,
  ShadowAIAlertDetails,
  ExtensionAlertDetails,
  LoginAlertDetails,
  PolicyAlertDetails,
  ComplianceAlertDetails,
  PolicyViolationAlertDetails,
  AlertAction,
  AlertRule,
  AlertCondition,
  AlertConfig,
  AlertManager,
  AlertStore,
  AlertListener,
  // Policy Types
  PolicyAction,
  PolicyMatchType,
  DomainPolicyRule,
  ToolPolicyRule,
  AIPolicyRule,
  DataTransferPolicyRule,
  PolicyConfig,
  PolicyViolation,
  PolicyManager,
  PolicyCheckResult,
} from "@pleno-audit/alerts";

export {
  DEFAULT_ALERT_CONFIG,
  DEFAULT_ALERT_RULES,
  createAlertManager,
  createInMemoryAlertStore,
  // Policy Manager
  DEFAULT_POLICY_CONFIG,
  POLICY_TEMPLATES,
  SOCIAL_MEDIA_DOMAINS,
  PRODUCTIVITY_DOMAINS,
  COMMUNICATION_DOMAINS,
  createPolicyManager,
} from "@pleno-audit/alerts";
