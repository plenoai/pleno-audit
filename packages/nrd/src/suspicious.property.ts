/**
 * Property-based tests for suspicious domain detection
 *
 * fast-checkを使用した強化プロパティベーステスト
 * - 代数的プロパティ（冪等性、単調性）
 * - エッジケース（Unicode、巨大文字列）
 * - 真のランダム生成
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateSuspiciousScore,
} from "./suspicious.js";

// カスタムArbitrary: ドメイン風文字列
const domainLabelArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}[a-z0-9]$|^[a-z]$/);
const tldArb = fc.constantFrom("com", "net", "org", "io", "dev", "xyz", "tk", "ml");

// カスタムArbitrary: 様々な文字種
// fast-check v4では fullUnicodeString が廃止されたため、unit: 'grapheme' を使用
const unicodeStringArb = fc.string({ minLength: 0, maxLength: 100, unit: "grapheme" });
const asciiStringArb = fc.stringMatching(/^[\x20-\x7e]{0,100}$/);
const largeStringArb = fc.string({ minLength: 1000, maxLength: 5000 });

describe("suspicious domain detection - property tests", () => {
  describe("calculateEntropy", () => {
    // 基本プロパティ: 範囲
    it("should always return value between 0 and 1 (strict)", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const entropy = calculateEntropy(str);
          return entropy >= 0 && entropy <= 1;
        }),
        { numRuns: 1000 }
      );
    });

    // エッジケース: Unicode
    it("should handle Unicode strings correctly", () => {
      fc.assert(
        fc.property(unicodeStringArb, (str) => {
          const entropy = calculateEntropy(str);
          return entropy >= 0 && entropy <= 1;
        }),
        { numRuns: 500 }
      );
    });

    // エッジケース: 巨大文字列
    it("should handle large strings without crashing", () => {
      fc.assert(
        fc.property(largeStringArb, (str) => {
          const entropy = calculateEntropy(str);
          return entropy >= 0 && entropy <= 1;
        }),
        { numRuns: 50 }
      );
    });

    // 代数的プロパティ: 冪等性
    it("should be idempotent (same input → same output)", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          return calculateEntropy(str) === calculateEntropy(str);
        }),
        { numRuns: 500 }
      );
    });

    // 代数的プロパティ: 単調性（文字種が増えるとエントロピーも増える）
    it("should have higher entropy for diverse characters than repeated ones", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 50 }),
          (str) => {
            if (str.length === 0) return true;
            const repeated = str[0].repeat(str.length);
            return calculateEntropy(str) >= calculateEntropy(repeated);
          }
        ),
        { numRuns: 500 }
      );
    });

    // 境界値: 空文字列
    it("should return 0 for empty string", () => {
      expect(calculateEntropy("")).toBe(0);
    });

    // 境界値: 単一文字
    it("should return 0 for single character", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1 }), (str) => {
          return calculateEntropy(str) === 0;
        })
      );
    });

    // 境界値: 全て同じ文字
    it("should return 0 for repeated single character", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1 }),
          fc.integer({ min: 1, max: 100 }),
          (char, count) => {
            return calculateEntropy(char.repeat(count)) === 0;
          }
        )
      );
    });

    // 最大エントロピー: 全て異なる文字
    it("should return 1 for string with all unique characters", () => {
      const uniqueStr = "abcdefghijklmnopqrstuvwxyz";
      expect(calculateEntropy(uniqueStr)).toBeCloseTo(1, 5);
    });
  });

  describe("extractSLD", () => {
    // 基本プロパティ
    it("should return non-empty string for valid domains", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = extractSLD(domain);
            return result.length > 0;
          }
        ),
        { numRuns: 500 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            return extractSLD(domain) === extractSLD(domain);
          }
        )
      );
    });

    // サブドメイン付き
    it("should handle subdomains consistently", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          domainLabelArb,
          tldArb,
          (sub, sld, tld) => {
            const domain = `${sub}.${sld}.${tld}`;
            const result = extractSLD(domain);
            return typeof result === "string" && result.length > 0;
          }
        )
      );
    });
  });

  describe("extractTLD", () => {
    // 基本プロパティ: 小文字
    it("should always return lowercase", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          fc.stringMatching(/^[A-Za-z]{2,6}$/),
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = extractTLD(domain);
            return result === result.toLowerCase();
          }
        )
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            return extractTLD(domain) === extractTLD(domain);
          }
        )
      );
    });
  });

  describe("hasExcessiveHyphens", () => {
    // 構造的プロパティ: 先頭ハイフン
    it("should return true for leading hyphen", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{1,10}$/),
          (rest) => hasExcessiveHyphens(`-${rest}`) === true
        )
      );
    });

    // 構造的プロパティ: 末尾ハイフン
    it("should return true for trailing hyphen", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{1,10}$/),
          (rest) => hasExcessiveHyphens(`${rest}-`) === true
        )
      );
    });

    // 構造的プロパティ: 連続ハイフン
    it("should return true for consecutive hyphens", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{1,5}$/),
          fc.stringMatching(/^[a-z]{1,5}$/),
          (prefix, suffix) => hasExcessiveHyphens(`${prefix}--${suffix}`) === true
        )
      );
    });

    // ランダム入力での型安全性
    it("should return boolean for any string", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          return typeof hasExcessiveHyphens(str) === "boolean";
        }),
        { numRuns: 1000 }
      );
    });

    // Unicode入力
    it("should handle Unicode strings", () => {
      fc.assert(
        fc.property(unicodeStringArb, (str) => {
          return typeof hasExcessiveHyphens(str) === "boolean";
        })
      );
    });
  });

  describe("hasExcessiveNumbers", () => {
    // 構造的プロパティ: 4桁以上連続
    it("should return true for 4+ consecutive digits", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[0-9]{4,10}$/),
          (digits) => hasExcessiveNumbers(`test${digits}domain`) === true
        )
      );
    });

    // ランダム入力での型安全性
    it("should return boolean for any string", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          return typeof hasExcessiveNumbers(str) === "boolean";
        }),
        { numRuns: 1000 }
      );
    });

    // 比率テスト: 30%以上が数字
    it("should return true when 30%+ of string is digits", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (digitCount) => {
            // 30%以上になるよう文字列を構成
            const letters = "ab";
            const digits = "0".repeat(digitCount);
            const str = letters + digits; // 2文字 + n桁 → n/(n+2) > 0.3 when n >= 1
            if (digitCount / str.length >= 0.3) {
              return hasExcessiveNumbers(str) === true;
            }
            return true;
          }
        )
      );
    });
  });

  describe("isRandomLooking", () => {
    // 構造的プロパティ: 5文字以上の連続子音
    it("should return true for 5+ consecutive consonants", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[bcdfghjklmnpqrstvwxyz]{5,10}$/),
          (consonants) => isRandomLooking(consonants) === true
        )
      );
    });

    // ランダム入力での型安全性
    it("should return boolean for any string", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          return typeof isRandomLooking(str) === "boolean";
        }),
        { numRuns: 1000 }
      );
    });

    // 母音を含む文字列は通常false
    it("should return false for strings with adequate vowels", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[aeiou]{3,10}$/),
          (vowels) => isRandomLooking(vowels) === false
        )
      );
    });
  });

  describe("calculateSuspiciousScore", () => {
    // 基本プロパティ: スコア範囲
    it("should return totalScore between 0 and 100", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateSuspiciousScore(domain);
            return result.totalScore >= 0 && result.totalScore <= 100;
          }
        ),
        { numRuns: 1000 }
      );
    });

    // 基本プロパティ: エントロピー範囲（修正後）
    it("should return entropy strictly between 0 and 1", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateSuspiciousScore(domain);
            return result.entropy >= 0 && result.entropy <= 1;
          }
        ),
        { numRuns: 1000 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const r1 = calculateSuspiciousScore(domain);
            const r2 = calculateSuspiciousScore(domain);
            return (
              r1.totalScore === r2.totalScore &&
              r1.entropy === r2.entropy &&
              r1.suspiciousTLD === r2.suspiciousTLD
            );
          }
        )
      );
    });

    // 構造的プロパティ: 疑わしいTLDはスコアが高い
    it("should have higher score for suspicious TLDs", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,10}$/),
          (sld) => {
            const safeDomain = `${sld}.com`;
            const suspiciousDomain = `${sld}.xyz`;
            const safeScore = calculateSuspiciousScore(safeDomain);
            const suspiciousScore = calculateSuspiciousScore(suspiciousDomain);
            return suspiciousScore.totalScore >= safeScore.totalScore;
          }
        )
      );
    });

    // 構造整合性
    it("should return consistent structure", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateSuspiciousScore(domain);
            return (
              typeof result.entropy === "number" &&
              typeof result.suspiciousTLD === "boolean" &&
              typeof result.hasExcessiveHyphens === "boolean" &&
              typeof result.hasExcessiveNumbers === "boolean" &&
              typeof result.isRandomLooking === "boolean" &&
              typeof result.totalScore === "number"
            );
          }
        )
      );
    });

    // Unicode入力でもクラッシュしない
    it("should handle Unicode domains without crashing", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30, unit: "grapheme" }),
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateSuspiciousScore(domain);
            return (
              typeof result.totalScore === "number" &&
              result.totalScore >= 0 &&
              result.totalScore <= 100
            );
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
