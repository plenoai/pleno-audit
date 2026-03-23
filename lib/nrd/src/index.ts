/**
 * @libztbs/nrd
 *
 * NRD (Newly Registered Domain) 検出パッケージ
 * - RDAP API: 真のNRD検出（登録日ベース）
 * - Suspicious Domain Analysis: 悪性ドメインパターン検出
 */

// Types
export type {
  SuspiciousDomainScores,
  DDNSInfo,
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
} from "./types.js";

export { DEFAULT_NRD_CONFIG } from "./types.js";

// Suspicious Domain Analysis
export {
  SUSPICIOUS_TLDS,
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateSuspiciousScore,
  isHighRiskDomain,
} from "./suspicious.js";

// RDAP Client (true NRD detection)
export type { RDAPEvent, RDAPResponse } from "./rdap.js";
export {
  queryRDAP,
  extractRegistrationDate,
  extractDomainStatus,
} from "./rdap.js";

// DDNS Detection
export type { DDNSResult } from "./ddns.js";
export {
  DDNS_PROVIDERS,
  checkDDNS,
  getDDNSProviderDomains,
  getDDNSProviderNames,
} from "./ddns.js";

// Detector
export type { NRDCache } from "./detector.js";
export { createNRDDetector } from "./detector.js";
