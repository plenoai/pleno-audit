/**
 * NRD (Newly Registered Domain) Detection Types
 *
 * Defines types for detecting domains registered within a threshold period.
 * RDAP API queries provide actual registration dates for NRD detection.
 * Suspicious domain analysis detects potentially malicious domain patterns.
 */

/**
 * Suspicious domain score components
 * Detects potentially malicious domain patterns (DGA, typosquatting, etc.)
 * Note: This is NOT NRD detection - it detects suspicious patterns regardless of age
 */
export interface SuspiciousDomainScores {
  /** Shannon entropy of domain name (0-1) */
  entropy: number;
  /** Whether domain uses suspicious TLD */
  suspiciousTLD: boolean;
  /** Whether domain has excessive hyphens (3+ or malformed) */
  hasExcessiveHyphens: boolean;
  /** Whether domain has excessive numbers (4+ consecutive or 30%+ ratio) */
  hasExcessiveNumbers: boolean;
  /** Whether domain name looks randomly generated */
  isRandomLooking: boolean;
  /** Total suspicious score (0-100) */
  totalScore: number;
}

/**
 * Detection method used for NRD determination
 * - rdap: Actual registration date from RDAP API (true NRD detection)
 * - suspicious: Domain pattern analysis (not actual NRD, just suspicious patterns)
 * - cache: Cached result from previous detection
 * - error: Detection failed
 */
export type NRDDetectionMethod = 'rdap' | 'suspicious' | 'cache' | 'error';

/**
 * Confidence level of NRD detection result
 */
export type NRDConfidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * DDNS detection result
 */
export interface DDNSInfo {
  /** Whether domain uses a DDNS service */
  isDDNS: boolean;
  /** DDNS provider name if detected */
  provider: string | null;
}

/**
 * Result of NRD detection for a domain
 */
export interface NRDResult {
  domain: string;
  /** Whether domain is newly registered (within threshold) */
  isNRD: boolean;
  /** Confidence level of the result */
  confidence: NRDConfidence;
  /** Registration date from RDAP (ISO 8601 format) */
  registrationDate: string | null;
  /** Domain age in days (null if unknown) */
  domainAge: number | null;
  /** Method used to determine result */
  method: NRDDetectionMethod;
  /** Suspicious domain analysis scores */
  suspiciousScores: SuspiciousDomainScores;
  /** DDNS detection result */
  ddns: DDNSInfo;
  /** Timestamp when this result was generated */
  checkedAt: number;
}

/**
 * NRD detection configuration
 * NRD = RDAP による新規登録ドメイン判定のみ
 */
export interface NRDConfig {
  /** Threshold in days (domain age <= this is considered NRD) */
  thresholdDays: number;
  /** Timeout for RDAP queries in milliseconds */
  rdapTimeout: number;
  /** Cache expiry time in milliseconds */
  cacheExpiry: number;
}

/**
 * Default NRD configuration
 */
export const DEFAULT_NRD_CONFIG: NRDConfig = {
  thresholdDays: 30,
  rdapTimeout: 5000,
  cacheExpiry: 86400000, // 24 hours
};
