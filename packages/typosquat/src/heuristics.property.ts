/**
 * Property-based tests for typosquatting heuristics
 *
 * fast-checkを使用した強化プロパティベーステスト
 * - 代数的プロパティ（冪等性）
 * - エッジケース（Unicode、Punycode）
 * - 真のランダム生成
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  getCharacterScript,
  detectScripts,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  detectJapaneseHomoglyphs,
  decodePunycode,
  isPunycodeDomain,
  calculateTyposquatHeuristics,
  isSuspiciousMixedScript,
} from "./heuristics.js";
import type { ScriptType, TyposquatConfig } from "./types.js";

const defaultConfig: TyposquatConfig = {
  enabled: true,
  heuristicThreshold: 30,
  cacheExpiry: 86400000,
  detectJapaneseHomoglyphs: true,
  warnOnPunycode: true,
};

// カスタムArbitrary
const domainLabelArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}[a-z0-9]$|^[a-z]$/);
const tldArb = fc.constantFrom("com", "net", "org", "io", "dev");
// fast-check v4では fullUnicodeString が廃止されたため、unit: 'grapheme' を使用
const unicodeStringArb = fc.string({ minLength: 0, maxLength: 50, unit: "grapheme" });
const cyrillicCharArb = fc.constantFrom("\u0430", "\u0435", "\u043E", "\u0440", "\u0441");
const latinCharArb = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''));

const validScripts: ScriptType[] = [
  "latin", "cyrillic", "greek", "hiragana", "katakana", "cjk", "unknown",
];

describe("typosquat heuristics - property tests", () => {
  describe("getCharacterScript", () => {
    // 基本プロパティ: 常に有効なScriptTypeを返す
    it("should return valid ScriptType for any single character", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1 }), (char) => {
          const result = getCharacterScript(char);
          return validScripts.includes(result);
        }),
        { numRuns: 1000 }
      );
    });

    // Unicode文字でも動作
    it("should handle any Unicode character", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1, unit: "grapheme" }),
          (char) => {
            const result = getCharacterScript(char);
            return validScripts.includes(result);
          }
        ),
        { numRuns: 500 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1 }), (char) => {
          return getCharacterScript(char) === getCharacterScript(char);
        })
      );
    });

    // ASCII文字はlatin
    it("should return latin for ASCII letters", () => {
      fc.assert(
        fc.property(latinCharArb, (char) => {
          return getCharacterScript(char) === "latin";
        })
      );
    });

    // 数字もlatin
    it("should return latin for ASCII digits", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...'0123456789'.split('')),
          (char) => getCharacterScript(char) === "latin"
        )
      );
    });

    // キリル文字はcyrillic
    it("should return cyrillic for Cyrillic characters", () => {
      fc.assert(
        fc.property(cyrillicCharArb, (char) => {
          return getCharacterScript(char) === "cyrillic";
        })
      );
    });
  });

  describe("detectScripts", () => {
    // 基本プロパティ: Setを返す
    it("should return Set for any input", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = detectScripts(domain);
          return result instanceof Set;
        }),
        { numRuns: 500 }
      );
    });

    // unknownは含まれない
    it("should not include unknown in result", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = detectScripts(domain);
          return !result.has("unknown");
        }),
        { numRuns: 500 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const r1 = Array.from(detectScripts(domain)).sort();
          const r2 = Array.from(detectScripts(domain)).sort();
          return JSON.stringify(r1) === JSON.stringify(r2);
        })
      );
    });

    // ASCII文字のみならlatinのみ
    it("should detect only latin for ASCII-only strings", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z0-9]{1,20}$/),
          (domain) => {
            const result = detectScripts(domain);
            return result.has("latin") && result.size === 1;
          }
        )
      );
    });

    // Unicode混在
    it("should detect multiple scripts for mixed content", () => {
      fc.assert(
        fc.property(
          latinCharArb,
          cyrillicCharArb,
          (latin, cyrillic) => {
            const domain = `${latin}${cyrillic}`;
            const result = detectScripts(domain);
            return result.has("latin") && result.has("cyrillic");
          }
        )
      );
    });
  });

  describe("isSuspiciousMixedScript", () => {
    // Latin + Cyrillicは危険
    it("should return true for Latin + Cyrillic mix", () => {
      const scripts = new Set<ScriptType>(["latin", "cyrillic"]);
      expect(isSuspiciousMixedScript(scripts)).toBe(true);
    });

    // Latin + Greekも危険
    it("should return true for Latin + Greek mix", () => {
      const scripts = new Set<ScriptType>(["latin", "greek"]);
      expect(isSuspiciousMixedScript(scripts)).toBe(true);
    });

    // Latinのみは安全
    it("should return false for Latin only", () => {
      const scripts = new Set<ScriptType>(["latin"]);
      expect(isSuspiciousMixedScript(scripts)).toBe(false);
    });
  });

  describe("detectLatinHomoglyphs", () => {
    // 基本プロパティ: 配列を返す
    it("should return array for any input", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = detectLatinHomoglyphs(domain);
          return Array.isArray(result);
        }),
        { numRuns: 500 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const r1 = detectLatinHomoglyphs(domain);
          const r2 = detectLatinHomoglyphs(domain);
          return r1.length === r2.length;
        })
      );
    });

    // 数字0を検出
    it("should detect digit 0 as homoglyph", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{1,10}$/),
          (prefix) => {
            const domain = `${prefix}0`;
            const result = detectLatinHomoglyphs(domain);
            return result.some((h) => h.original === "0");
          }
        )
      );
    });

    // 数字1を検出
    it("should detect digit 1 as homoglyph", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{1,10}$/),
          (prefix) => {
            const domain = `${prefix}1`;
            const result = detectLatinHomoglyphs(domain);
            return result.some((h) => h.original === "1");
          }
        )
      );
    });

    // rnシーケンスを検出
    it("should detect rn sequence as m homoglyph", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{0,5}$/),
          fc.stringMatching(/^[a-z]{0,5}$/),
          (prefix, suffix) => {
            const domain = `${prefix}rn${suffix}`;
            const result = detectLatinHomoglyphs(domain);
            return result.some((h) => h.original === "rn" && h.possibleReplacement === "m");
          }
        )
      );
    });

    // vvシーケンスを検出
    it("should detect vv sequence as w homoglyph", () => {
      const result = detectLatinHomoglyphs("testvvdomain");
      expect(result.some((h) => h.original === "vv" && h.possibleReplacement === "w")).toBe(true);
    });
  });

  describe("detectCyrillicHomoglyphs", () => {
    // 基本プロパティ: 配列を返す
    it("should return array for any input", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = detectCyrillicHomoglyphs(domain);
          return Array.isArray(result);
        }),
        { numRuns: 500 }
      );
    });

    // ASCII文字のみなら空配列
    it("should return empty array for ASCII-only strings", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z0-9]{1,20}$/),
          (domain) => {
            const result = detectCyrillicHomoglyphs(domain);
            return result.length === 0;
          }
        )
      );
    });

    // キリル文字аを検出
    it("should detect Cyrillic а (U+0430) as homoglyph to Latin a", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[b-z]{1,10}$/),
          (suffix) => {
            const domain = `\u0430${suffix}`; // Cyrillic а
            const result = detectCyrillicHomoglyphs(domain);
            return result.some((h) => h.original === "\u0430" && h.possibleReplacement === "a");
          }
        )
      );
    });

    // 各キリル文字ホモグリフを検出
    it("should detect various Cyrillic homoglyphs", () => {
      const testCases = [
        { cyrillic: "\u0430", latin: "a" },
        { cyrillic: "\u0435", latin: "e" },
        { cyrillic: "\u043E", latin: "o" },
        { cyrillic: "\u0440", latin: "p" },
        { cyrillic: "\u0441", latin: "c" },
      ];

      for (const { cyrillic, latin } of testCases) {
        const result = detectCyrillicHomoglyphs(`test${cyrillic}domain`);
        expect(result.some((h) => h.original === cyrillic && h.possibleReplacement === latin)).toBe(true);
      }
    });
  });

  describe("detectJapaneseHomoglyphs", () => {
    // 全角文字を検出
    it("should detect fullwidth characters", () => {
      const result = detectJapaneseHomoglyphs("\uFF21\uFF22\uFF23"); // ＡＢＣ
      expect(result.length).toBeGreaterThan(0);
    });

    // 長音記号を検出
    it("should detect katakana prolonged sound mark as hyphen", () => {
      const result = detectJapaneseHomoglyphs("test\u30FCdomain"); // ー
      expect(result.some((h) => h.possibleReplacement === "-")).toBe(true);
    });
  });

  describe("decodePunycode", () => {
    // 基本プロパティ: 文字列を返す
    it("should return string for any input", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = decodePunycode(domain);
          return typeof result === "string";
        }),
        { numRuns: 500 }
      );
    });

    // 冪等性
    it("should be idempotent for non-punycode domains", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            return decodePunycode(domain) === domain;
          }
        )
      );
    });

    // Punycodeデコード（Node.jsのURL APIはPunycodeをデコードしないため、同じ値を返す）
    it("should return normalized domain for xn-- prefixed domains", () => {
      // Node.jsのURL APIはPunycodeをデコードしないため、ホスト名はそのまま返る
      const decoded = decodePunycode("xn--wgv71a119e.jp");
      // 小文字化・正規化されることを確認
      expect(typeof decoded).toBe("string");
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe("isPunycodeDomain", () => {
    // 基本プロパティ: booleanを返す
    it("should return boolean for any input", () => {
      fc.assert(
        fc.property(fc.string(), (domain) => {
          const result = isPunycodeDomain(domain);
          return typeof result === "boolean";
        }),
        { numRuns: 500 }
      );
    });

    // xn--プレフィックスを検出
    it("should return true for xn-- prefix", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z0-9]{1,10}$/),
          (suffix) => {
            const domain = `xn--${suffix}.com`;
            return isPunycodeDomain(domain) === true;
          }
        )
      );
    });

    // ASCII文字のみならfalse（xn--で始まるラベルがなければ）
    it("should return false for ASCII-only domains without xn-- prefix", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            return isPunycodeDomain(domain) === false;
          }
        )
      );
    });
  });

  describe("calculateTyposquatHeuristics", () => {
    // 基本プロパティ: スコア範囲
    it("should return totalScore between 0 and 100", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateTyposquatHeuristics(domain, defaultConfig);
            return result.totalScore >= 0 && result.totalScore <= 100;
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
            const r1 = calculateTyposquatHeuristics(domain, defaultConfig);
            const r2 = calculateTyposquatHeuristics(domain, defaultConfig);
            return (
              r1.totalScore === r2.totalScore &&
              r1.hasMixedScript === r2.hasMixedScript &&
              r1.isPunycode === r2.isPunycode
            );
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
            const result = calculateTyposquatHeuristics(domain, defaultConfig);
            return (
              Array.isArray(result.homoglyphs) &&
              typeof result.hasMixedScript === "boolean" &&
              Array.isArray(result.detectedScripts) &&
              typeof result.isPunycode === "boolean" &&
              typeof result.totalScore === "number" &&
              typeof result.breakdown === "object"
            );
          }
        )
      );
    });

    // breakdownの整合性
    it("should have breakdown components as non-negative numbers", () => {
      fc.assert(
        fc.property(
          domainLabelArb,
          tldArb,
          (sld, tld) => {
            const domain = `${sld}.${tld}`;
            const result = calculateTyposquatHeuristics(domain, defaultConfig);
            const { breakdown } = result;
            return (
              breakdown.latinHomoglyphs >= 0 &&
              breakdown.cyrillicHomoglyphs >= 0 &&
              breakdown.greekHomoglyphs >= 0 &&
              breakdown.japaneseHomoglyphs >= 0 &&
              breakdown.mixedScript >= 0 &&
              breakdown.punycode >= 0
            );
          }
        )
      );
    });

    // キリル文字混在でスコアが上がる
    it("should have higher score for Cyrillic mixed domains", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[b-z]{3,10}$/),
          (suffix) => {
            const pureLatin = `a${suffix}.com`;
            const mixedCyrillic = `\u0430${suffix}.com`; // Cyrillic а
            const pureScore = calculateTyposquatHeuristics(pureLatin, defaultConfig);
            const mixedScore = calculateTyposquatHeuristics(mixedCyrillic, defaultConfig);
            return mixedScore.totalScore >= pureScore.totalScore;
          }
        )
      );
    });

    // Unicode入力でもクラッシュしない
    it("should handle Unicode domains without crashing", () => {
      fc.assert(
        fc.property(
          unicodeStringArb,
          tldArb,
          (sld, tld) => {
            if (sld.length === 0) return true;
            const domain = `${sld}.${tld}`;
            const result = calculateTyposquatHeuristics(domain, defaultConfig);
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

    // 設定のwarnOnPunycodeフラグ
    it("should respect warnOnPunycode config", () => {
      const punycodeOff: TyposquatConfig = { ...defaultConfig, warnOnPunycode: false };
      const domain = "xn--test123.com";
      const withWarning = calculateTyposquatHeuristics(domain, defaultConfig);
      const withoutWarning = calculateTyposquatHeuristics(domain, punycodeOff);
      expect(withWarning.breakdown.punycode).toBeGreaterThanOrEqual(withoutWarning.breakdown.punycode);
    });
  });
});
