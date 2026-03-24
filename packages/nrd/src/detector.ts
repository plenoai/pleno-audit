/**
 * NRD (Newly Registered Domain) Detector
 *
 * RDAPによる新規登録ドメイン判定のみを行う。
 * 怪しいドメインパターン検出はTyposquat側で行う。
 *
 * Detection flow:
 * 1. Check cache for previous result
 * 2. Query RDAP API for registration date
 * 3. Determine NRD status based on domain age
 * 4. Cache result for future lookups
 */

import type {
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  SuspiciousDomainScores,
  DDNSInfo,
} from './types.js';
import { calculateSuspiciousScore } from './suspicious.js';
import { queryRDAP, extractRegistrationDate } from './rdap.js';
import { checkDDNS } from './ddns.js';

/**
 * Cache interface for storing NRD results
 */
export interface NRDCache {
  get(domain: string): NRDResult | null;
  set(domain: string, result: NRDResult): void;
  clear(): void;
}

/**
 * Create an NRD detector instance
 *
 * @param config - NRD detection configuration
 * @param cache - Cache implementation for storing results
 * @returns Detector object with check methods
 */
export function createNRDDetector(config: NRDConfig, cache: NRDCache) {
  /**
   * Check if a domain is newly registered (async)
   *
   * RDAPでドメイン年齢を取得し、NRD判定を行う。
   *
   * @param domain - Domain name to check
   * @returns NRD detection result
   */
  async function checkDomain(domain: string): Promise<NRDResult> {
    // 1. Check cache for recent result
    const cached = cache.get(domain);
    if (cached && Date.now() - cached.checkedAt < config.cacheExpiry) {
      return { ...cached, method: 'cache' };
    }

    // 2. Calculate suspicious domain scores (for reference only, not for NRD judgment)
    const suspiciousScores = calculateSuspiciousScore(domain);

    // 3. Check for DDNS usage
    const ddnsResult = checkDDNS(domain);
    const ddns: DDNSInfo = {
      isDDNS: ddnsResult.isDDNS,
      provider: ddnsResult.provider,
    };

    // 4. Query RDAP API for domain age
    let registrationDate: string | null = null;
    let domainAge: number | null = null;
    let method: NRDDetectionMethod = 'error';

    try {
      const rdapResult = await queryRDAP(domain, config.rdapTimeout);
      registrationDate = extractRegistrationDate(rdapResult);
      if (registrationDate) {
        domainAge = calculateDomainAge(registrationDate);
        method = 'rdap';
      }
    } catch {
      // RDAP取得失敗時はNRD判定不能
    }

    // 5. Determine NRD status based on domain age only
    const result = determineNRDStatus(
      domain,
      registrationDate,
      domainAge,
      suspiciousScores,
      ddns,
      config,
      method
    );

    // 6. Cache result for future lookups
    cache.set(domain, result);

    return result;
  }

  /**
   * Check domain using only suspicious score analysis (synchronous)
   *
   * Fast check that doesn't require network access.
   * Detects suspicious patterns but not actual domain age.
   *
   * @param domain - Domain name to check
   * @returns Suspicious domain scores only
   */
  function checkDomainSync(domain: string): SuspiciousDomainScores {
    return calculateSuspiciousScore(domain);
  }

  return {
    checkDomain,
    checkDomainSync,
  };
}

/**
 * Calculate domain age in days from registration date
 *
 * @param registrationDate - ISO 8601 formatted date string
 * @returns Age in days
 */
function calculateDomainAge(registrationDate: string): number {
  const regDate = new Date(registrationDate);
  const now = new Date();
  const ageMs = now.getTime() - regDate.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine NRD status based on RDAP domain age only
 *
 * @param domain - Domain name
 * @param registrationDate - Registration date from RDAP
 * @param domainAge - Calculated domain age
 * @param suspiciousScores - Suspicious domain analysis scores (for reference)
 * @param ddns - DDNS detection result
 * @param config - NRD configuration
 * @param method - Detection method used
 * @returns NRD detection result
 */
function determineNRDStatus(
  domain: string,
  registrationDate: string | null,
  domainAge: number | null,
  suspiciousScores: SuspiciousDomainScores,
  ddns: DDNSInfo,
  config: NRDConfig,
  method: NRDDetectionMethod
): NRDResult {
  let isNRD = false;
  let confidence: NRDConfidence = 'unknown';

  // RDAPでドメイン年齢が取得できた場合のみNRD判定
  if (domainAge !== null) {
    isNRD = domainAge <= config.thresholdDays;
    confidence = 'high';
  }
  // ドメイン年齢不明の場合はNRD判定不能（isNRD: false）

  return {
    domain,
    isNRD,
    confidence,
    registrationDate,
    domainAge,
    method,
    suspiciousScores,
    ddns,
    checkedAt: Date.now(),
  };
}
