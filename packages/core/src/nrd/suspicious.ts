/**
 * Suspicious Domain Detection
 *
 * Analyzes domain names using entropy, pattern recognition, and domain characteristics
 * to identify potentially malicious domains (DGA, typosquatting, etc.).
 *
 * Note: This is NOT NRD detection - these patterns indicate suspicious domains
 * regardless of when they were registered.
 */

import type { SuspiciousDomainScores } from './types.js';

/**
 * Suspicious TLDs commonly used for phishing, malware, or abuse
 * - Free/cheap TLDs (.tk, .ml, .ga, .cf, .gq)
 * - High-abuse TLDs (.xyz, .top, .buzz, .click, .link)
 * - Recent generic TLDs (.icu, .cyou, .cfd)
 */
export const SUSPICIOUS_TLDS = new Set([
  'xyz',
  'top',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'buzz',
  'cam',
  'icu',
  'club',
  'online',
  'work',
  'click',
  'link',
  'site',
  'website',
  'space',
  'fun',
  'monster',
  'rest',
  'surf',
  'hair',
  'quest',
  'bond',
  'cyou',
  'cfd',
]);

/**
 * Calculate Shannon entropy of a string
 * Higher entropy indicates more random/unpredictable content
 * Normalized to 0-1 range
 *
 * @param str - String to analyze
 * @returns Entropy value (0-1)
 */
export function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;

  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  // Normalize to 0-1 range
  // Math.minで浮動小数点誤差による1超過を防止
  const maxEntropy = Math.log2(len);
  return maxEntropy > 0 ? Math.min(entropy / maxEntropy, 1) : 0;
}

/**
 * Extract Second Level Domain (SLD) from a domain
 * Examples:
 * - example.com → example
 * - sub.example.co.jp → example
 * - test.example.com → example
 *
 * @param domain - Full domain name
 * @returns SLD without TLD
 */
export function extractSLD(domain: string): string {
  const parts = domain.split('.');

  // Common country-code second-level domains (ccSLD)
  const ccSLDs = ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'go'];

  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2);
    // Check if last component is a ccSLD (short + common word)
    if (lastTwo[0].length <= 3 && ccSLDs.includes(lastTwo[0])) {
      return parts.length >= 3 ? parts[parts.length - 3] : parts[0];
    }
    return parts[parts.length - 2];
  }

  return parts[0];
}

/**
 * Extract TLD from a domain
 *
 * @param domain - Full domain name
 * @returns TLD in lowercase
 */
export function extractTLD(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Detect excessive or malformed hyphens in domain name
 * Red flags:
 * - Leading or trailing hyphens
 * - Consecutive hyphens
 * - 3+ hyphens (excessive segmentation)
 *
 * @param sld - Second level domain
 * @returns True if hyphen usage is suspicious
 */
export function hasExcessiveHyphens(sld: string): boolean {
  if (sld.startsWith('-') || sld.endsWith('-')) return true;
  if (sld.includes('--')) return true;

  const hyphenCount = (sld.match(/-/g) || []).length;
  return hyphenCount >= 3;
}

/**
 * Detect excessive or malformed numbers in domain name
 * Red flags:
 * - 4+ consecutive digits (phone numbers, random sequences)
 * - 30%+ of domain is numbers (unusual for legitimate domains)
 *
 * @param sld - Second level domain
 * @returns True if number usage is suspicious
 */
export function hasExcessiveNumbers(sld: string): boolean {
  // 4+ consecutive digits is highly suspicious
  if (/\d{4,}/.test(sld)) return true;

  // Calculate digit ratio
  const digitCount = (sld.match(/\d/g) || []).length;
  const ratio = digitCount / sld.length;

  // 30%+ numbers is unusual for legitimate domains
  return ratio >= 0.3;
}

/**
 * Detect domain names that look randomly generated
 * Red flags:
 * - 5+ consecutive consonants (unpronounceable)
 * - Missing vowels entirely (for 3+ char domains)
 * - Vowel ratio < 15% (for 6+ char domains)
 *
 * @param sld - Second level domain
 * @returns True if domain looks randomly generated
 */
export function isRandomLooking(sld: string): boolean {
  // 5+ consecutive consonants is unpronounceable
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(sld)) return true;

  const vowels = 'aeiou';

  // For 3+ character domains, check for missing vowels
  if (sld.length >= 3) {
    const vowelCount = [...sld.toLowerCase()].filter((c) =>
      vowels.includes(c)
    ).length;

    if (vowelCount === 0) return true;

    // Extremely low vowel ratio (< 15%) for longer domains
    if (vowelCount / sld.length < 0.15 && sld.length >= 6) return true;
  }

  return false;
}

/**
 * Calculate suspicious domain score
 * Scores individual risk factors and combines them into 0-100 range
 *
 * Scoring breakdown:
 * - Entropy (random-looking): up to 30 points
 * - Suspicious TLD: 25 points
 * - Excessive hyphens: 15 points
 * - Excessive numbers: 15 points
 * - Random-looking name: 20 points
 * - Very short SLD (2 chars): 10 points
 *
 * @param domain - Full domain name
 * @returns Suspicious domain scores breakdown
 */
export function calculateSuspiciousScore(domain: string): SuspiciousDomainScores {
  const sld = extractSLD(domain);
  const tld = extractTLD(domain);

  const entropy = calculateEntropy(sld);
  const suspiciousTLD = SUSPICIOUS_TLDS.has(tld);
  const excessiveHyphens = hasExcessiveHyphens(sld);
  const excessiveNumbers = hasExcessiveNumbers(sld);
  const randomLooking = isRandomLooking(sld);

  // Calculate weighted score
  let score = 0;

  // Entropy: higher entropy = more random = higher risk (max 30 pts)
  score += Math.min(entropy * 40, 30);

  // Suspicious TLD (25 pts)
  if (suspiciousTLD) score += 25;

  // Excessive hyphens (15 pts)
  if (excessiveHyphens) score += 15;

  // Excessive numbers (15 pts)
  if (excessiveNumbers) score += 15;

  // Random looking (20 pts)
  if (randomLooking) score += 20;

  // Very short SLD (10 pts) - often associated with squatting/abuse
  if (sld.length <= 2) score += 10;

  return {
    entropy,
    suspiciousTLD,
    hasExcessiveHyphens: excessiveHyphens,
    hasExcessiveNumbers: excessiveNumbers,
    isRandomLooking: randomLooking,
    totalScore: Math.min(score, 100),
  };
}

/**
 * Check if suspicious scores indicate high risk
 *
 * @param scores - Calculated suspicious domain scores
 * @param threshold - Risk threshold (0-100)
 * @returns True if total score exceeds threshold
 */
export function isHighRiskDomain(
  scores: SuspiciousDomainScores,
  threshold: number
): boolean {
  return scores.totalScore >= threshold;
}

