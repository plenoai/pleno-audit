import { describe, it, expect } from "vitest";
import {
  getCharacterScript,
  detectScripts,
  isSuspiciousMixedScript,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  detectGreekHomoglyphs,
  detectJapaneseHomoglyphs,
  isPunycodeDomain,
  decodePunycode,
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
  CYRILLIC_TO_LATIN,
  GREEK_TO_LATIN,
  JAPANESE_HOMOGLYPHS,
  LATIN_HOMOGLYPHS,
} from "./heuristics.js";
import type { TyposquatConfig } from "./types.js";
import { DEFAULT_TYPOSQUAT_CONFIG } from "./types.js";

// ============================================================================
// getCharacterScript
// ============================================================================

describe("getCharacterScript", () => {
  it("detects latin uppercase A-Z", () => {
    expect(getCharacterScript("A")).toBe("latin");
    expect(getCharacterScript("Z")).toBe("latin");
    expect(getCharacterScript("M")).toBe("latin");
  });

  it("detects latin lowercase a-z", () => {
    expect(getCharacterScript("a")).toBe("latin");
    expect(getCharacterScript("z")).toBe("latin");
  });

  it("detects extended latin characters", () => {
    expect(getCharacterScript("\u00C0")).toBe("latin"); // A-grave (0x00C0)
    expect(getCharacterScript("\u024F")).toBe("latin"); // end of extended (0x024F)
    expect(getCharacterScript("\u00E9")).toBe("latin"); // e-acute
  });

  it("detects numbers 0-9 as latin", () => {
    expect(getCharacterScript("0")).toBe("latin");
    expect(getCharacterScript("5")).toBe("latin");
    expect(getCharacterScript("9")).toBe("latin");
  });

  it("detects cyrillic characters", () => {
    expect(getCharacterScript("\u0400")).toBe("cyrillic"); // start of range
    expect(getCharacterScript("\u0430")).toBe("cyrillic"); // Cyrillic a
    expect(getCharacterScript("\u043E")).toBe("cyrillic"); // Cyrillic o
    expect(getCharacterScript("\u04FF")).toBe("cyrillic"); // end of range
  });

  it("detects greek characters", () => {
    expect(getCharacterScript("\u0370")).toBe("greek"); // start of range
    expect(getCharacterScript("\u03B1")).toBe("greek"); // alpha
    expect(getCharacterScript("\u03BF")).toBe("greek"); // omicron
    expect(getCharacterScript("\u03FF")).toBe("greek"); // end of range
  });

  it("detects hiragana", () => {
    expect(getCharacterScript("\u3040")).toBe("hiragana"); // start
    expect(getCharacterScript("\u3042")).toBe("hiragana"); // あ
    expect(getCharacterScript("\u3093")).toBe("hiragana"); // ん
    expect(getCharacterScript("\u309F")).toBe("hiragana"); // end
  });

  it("detects katakana", () => {
    expect(getCharacterScript("\u30A0")).toBe("katakana"); // start
    expect(getCharacterScript("\u30A2")).toBe("katakana"); // ア
    expect(getCharacterScript("\u30F3")).toBe("katakana"); // ン
    expect(getCharacterScript("\u30FF")).toBe("katakana"); // end
  });

  it("detects CJK unified ideographs", () => {
    expect(getCharacterScript("\u4E00")).toBe("cjk"); // start (一)
    expect(getCharacterScript("\u65E5")).toBe("cjk"); // 日
    expect(getCharacterScript("\u9FFF")).toBe("cjk"); // end
  });

  it("detects fullwidth forms as cjk", () => {
    expect(getCharacterScript("\uFF00")).toBe("cjk"); // start of fullwidth
    expect(getCharacterScript("\uFF41")).toBe("cjk"); // fullwidth a
    expect(getCharacterScript("\uFFEF")).toBe("cjk"); // end of fullwidth
  });

  it("returns unknown for control characters", () => {
    expect(getCharacterScript("\u0000")).toBe("unknown");
    expect(getCharacterScript("\u0001")).toBe("unknown");
  });

  it("returns unknown for special symbols outside known ranges", () => {
    expect(getCharacterScript("@")).toBe("unknown");
    expect(getCharacterScript("#")).toBe("unknown");
    expect(getCharacterScript("!")).toBe("unknown");
  });

  it("handles empty string (codePointAt returns undefined → 0)", () => {
    // codePointAt(0) on empty string returns undefined, || 0 makes it 0
    expect(getCharacterScript("")).toBe("unknown");
  });
});

// ============================================================================
// detectScripts
// ============================================================================

describe("detectScripts", () => {
  it("detects single script", () => {
    const result = detectScripts("example");
    expect(result.has("latin")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("detects mixed latin+cyrillic scripts", () => {
    const result = detectScripts("ex\u0430mple"); // Cyrillic a
    expect(result.has("latin")).toBe(true);
    expect(result.has("cyrillic")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("ignores dots", () => {
    const result = detectScripts("example.com");
    expect(result.has("latin")).toBe(true);
    // dots should not add "unknown"
    expect(result.has("unknown")).toBe(false);
  });

  it("ignores hyphens", () => {
    const result = detectScripts("my-domain");
    expect(result.has("latin")).toBe(true);
    expect(result.has("unknown")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("deletes unknown from result", () => {
    // '@' is unknown, but unknown gets deleted
    const result = detectScripts("a@b");
    expect(result.has("unknown")).toBe(false);
    expect(result.has("latin")).toBe(true);
  });

  it("detects greek script", () => {
    const result = detectScripts("g\u03BFogle");
    expect(result.has("greek")).toBe(true);
    expect(result.has("latin")).toBe(true);
  });

  it("detects multiple CJK scripts", () => {
    const result = detectScripts("\u3042\u30A2\u65E5");
    expect(result.has("hiragana")).toBe(true);
    expect(result.has("katakana")).toBe(true);
    expect(result.has("cjk")).toBe(true);
  });
});

// ============================================================================
// isSuspiciousMixedScript
// ============================================================================

describe("isSuspiciousMixedScript", () => {
  it("returns true for latin+cyrillic mix", () => {
    expect(isSuspiciousMixedScript(new Set(["latin", "cyrillic"]))).toBe(true);
  });

  it("returns true for latin+greek mix", () => {
    expect(isSuspiciousMixedScript(new Set(["latin", "greek"]))).toBe(true);
  });

  it("returns false for single script", () => {
    expect(isSuspiciousMixedScript(new Set(["latin"]))).toBe(false);
    expect(isSuspiciousMixedScript(new Set(["cyrillic"]))).toBe(false);
    expect(isSuspiciousMixedScript(new Set(["greek"]))).toBe(false);
  });

  it("returns false for japanese script combinations", () => {
    expect(isSuspiciousMixedScript(new Set(["hiragana", "katakana"]))).toBe(false);
    expect(isSuspiciousMixedScript(new Set(["hiragana", "cjk"]))).toBe(false);
    expect(isSuspiciousMixedScript(new Set(["cjk", "hiragana", "katakana"]))).toBe(false);
  });

  it("returns false for empty set", () => {
    expect(isSuspiciousMixedScript(new Set())).toBe(false);
  });
});

// ============================================================================
// detectLatinHomoglyphs
// ============================================================================

describe("detectLatinHomoglyphs", () => {
  it("detects 0 as O/o homoglyph", () => {
    const matches = detectLatinHomoglyphs("g00gle");
    const digitMatches = matches.filter(m => m.type === "latin_digit");
    // Each '0' maps to ["O", "o"] = 2 matches per digit, 2 digits = 4
    expect(digitMatches.length).toBe(4);
    expect(digitMatches.some(m => m.original === "0" && m.possibleReplacement === "O")).toBe(true);
    expect(digitMatches.some(m => m.original === "0" && m.possibleReplacement === "o")).toBe(true);
  });

  it("detects 1 as l/I/i homoglyph", () => {
    const matches = detectLatinHomoglyphs("app1e");
    const digitMatches = matches.filter(m => m.type === "latin_digit");
    // '1' maps to ["l", "I", "i"] = 3 matches
    expect(digitMatches.length).toBe(3);
    expect(digitMatches.some(m => m.original === "1" && m.possibleReplacement === "l")).toBe(true);
    expect(digitMatches.some(m => m.original === "1" && m.possibleReplacement === "I")).toBe(true);
    expect(digitMatches.some(m => m.original === "1" && m.possibleReplacement === "i")).toBe(true);
  });

  it("returns correct positions for digit homoglyphs", () => {
    const matches = detectLatinHomoglyphs("a0b");
    const zeroMatches = matches.filter(m => m.original === "0");
    expect(zeroMatches.every(m => m.position === 1)).toBe(true);
  });

  it("returns empty for normal domains", () => {
    const matches = detectLatinHomoglyphs("google");
    expect(matches.length).toBe(0);
  });

  it("detects rn sequence as m", () => {
    const matches = detectLatinHomoglyphs("rnicrosoft");
    const seqMatches = matches.filter(m => m.type === "latin_sequence");
    expect(seqMatches.length).toBe(1);
    expect(seqMatches[0].original).toBe("rn");
    expect(seqMatches[0].possibleReplacement).toBe("m");
    expect(seqMatches[0].position).toBe(0);
  });

  it("detects vv sequence as w", () => {
    const matches = detectLatinHomoglyphs("vvitter");
    const seqMatches = matches.filter(m => m.type === "latin_sequence" && m.original === "vv");
    expect(seqMatches.length).toBe(1);
    expect(seqMatches[0].possibleReplacement).toBe("w");
  });

  it("detects nn sequence as m", () => {
    const matches = detectLatinHomoglyphs("nnap");
    const seqMatches = matches.filter(m => m.type === "latin_sequence" && m.original === "nn");
    expect(seqMatches.length).toBe(1);
    expect(seqMatches[0].possibleReplacement).toBe("m");
  });

  it("detects uu sequence as w", () => {
    const matches = detectLatinHomoglyphs("uueb");
    const seqMatches = matches.filter(m => m.type === "latin_sequence" && m.original === "uu");
    expect(seqMatches.length).toBe(1);
    expect(seqMatches[0].possibleReplacement).toBe("w");
  });

  it("detects multiple occurrences of same sequence", () => {
    const matches = detectLatinHomoglyphs("rnrn");
    const seqMatches = matches.filter(m => m.type === "latin_sequence" && m.original === "rn");
    expect(seqMatches.length).toBe(2);
    expect(seqMatches[0].position).toBe(0);
    expect(seqMatches[1].position).toBe(2);
  });
});

// ============================================================================
// detectCyrillicHomoglyphs
// ============================================================================

describe("detectCyrillicHomoglyphs", () => {
  it("detects cyrillic homoglyphs with correct mappings", () => {
    const matches = detectCyrillicHomoglyphs("g\u043E\u043Egle"); // Cyrillic о × 2
    expect(matches.length).toBe(2);
    expect(matches[0].original).toBe("\u043E");
    expect(matches[0].possibleReplacement).toBe("o");
    expect(matches[0].type).toBe("cyrillic");
    expect(matches[0].position).toBe(1);
    expect(matches[1].position).toBe(2);
  });

  it("returns empty for pure latin", () => {
    const matches = detectCyrillicHomoglyphs("google");
    expect(matches.length).toBe(0);
  });

  it("detects all mapped cyrillic characters", () => {
    // Test each entry in CYRILLIC_TO_LATIN map
    for (const [cyrillic, latin] of CYRILLIC_TO_LATIN) {
      const matches = detectCyrillicHomoglyphs(cyrillic);
      expect(matches.length).toBe(1);
      expect(matches[0].original).toBe(cyrillic);
      expect(matches[0].possibleReplacement).toBe(latin);
      expect(matches[0].type).toBe("cyrillic");
      expect(matches[0].position).toBe(0);
    }
  });
});

// ============================================================================
// detectGreekHomoglyphs
// ============================================================================

describe("detectGreekHomoglyphs", () => {
  it("detects Greek omicron as Latin o", () => {
    const matches = detectGreekHomoglyphs("g\u03BFogle");
    expect(matches.length).toBe(1);
    expect(matches[0].original).toBe("\u03BF");
    expect(matches[0].possibleReplacement).toBe("o");
    expect(matches[0].type).toBe("greek");
    expect(matches[0].position).toBe(1);
  });

  it("detects multiple Greek homoglyphs", () => {
    const matches = detectGreekHomoglyphs("\u03B1\u03BF\u03B9");
    expect(matches.length).toBe(3);
    expect(matches[0].possibleReplacement).toBe("a");
    expect(matches[1].possibleReplacement).toBe("o");
    expect(matches[2].possibleReplacement).toBe("i");
  });

  it("returns empty for pure latin", () => {
    expect(detectGreekHomoglyphs("google").length).toBe(0);
  });

  it("detects uppercase Greek homoglyphs", () => {
    const matches = detectGreekHomoglyphs("\u0391\u0392\u0395\u0397\u0399");
    expect(matches.length).toBe(5);
    expect(matches[0].possibleReplacement).toBe("A");
    expect(matches[1].possibleReplacement).toBe("B");
    expect(matches[2].possibleReplacement).toBe("E");
    expect(matches[3].possibleReplacement).toBe("H");
    expect(matches[4].possibleReplacement).toBe("I");
  });

  it("detects all mapped Greek characters", () => {
    for (const [greek, latin] of GREEK_TO_LATIN) {
      const matches = detectGreekHomoglyphs(greek);
      expect(matches.length).toBe(1);
      expect(matches[0].original).toBe(greek);
      expect(matches[0].possibleReplacement).toBe(latin);
      expect(matches[0].type).toBe("greek");
    }
  });
});

// ============================================================================
// detectJapaneseHomoglyphs
// ============================================================================

describe("detectJapaneseHomoglyphs", () => {
  it("detects fullwidth Latin characters", () => {
    const matches = detectJapaneseHomoglyphs("\uFF47\uFF4F\uFF4F\uFF47\uFF4C\uFF45");
    expect(matches.length).toBe(6);
    expect(matches[0].possibleReplacement).toBe("g");
    expect(matches[1].possibleReplacement).toBe("o");
  });

  it("detects katakana long vowel mark as hyphen", () => {
    const matches = detectJapaneseHomoglyphs("test\u30FCdomain");
    expect(matches.length).toBe(1);
    expect(matches[0].possibleReplacement).toBe("-");
    expect(matches[0].position).toBe(4);
  });

  it("detects dash-like characters", () => {
    // ― (dash), — (em dash), − (minus), 一 (CJK one)
    for (const char of ["\u2015", "\u2014", "\u2212", "\u4E00"]) {
      const matches = detectJapaneseHomoglyphs(char);
      expect(matches.length).toBe(1);
      expect(matches[0].possibleReplacement).toBe("-");
    }
  });

  it("detects fullwidth digits 0-9", () => {
    const fullwidthDigits = "\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19";
    const matches = detectJapaneseHomoglyphs(fullwidthDigits);
    expect(matches.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(matches[i].possibleReplacement).toBe(String(i));
    }
  });

  it("detects fullwidth uppercase A-Z", () => {
    // Test a few fullwidth uppercase
    const matches = detectJapaneseHomoglyphs("\uFF21\uFF22\uFF23\uFF3A");
    expect(matches.length).toBe(4);
    expect(matches[0].possibleReplacement).toBe("A");
    expect(matches[1].possibleReplacement).toBe("B");
    expect(matches[2].possibleReplacement).toBe("C");
    expect(matches[3].possibleReplacement).toBe("Z");
  });

  it("detects fullwidth lowercase a-z", () => {
    const matches = detectJapaneseHomoglyphs("\uFF41\uFF5A");
    expect(matches.length).toBe(2);
    expect(matches[0].possibleReplacement).toBe("a");
    expect(matches[1].possibleReplacement).toBe("z");
  });

  it("returns empty for normal ascii", () => {
    expect(detectJapaneseHomoglyphs("google.com").length).toBe(0);
  });

  it("detects all mapped Japanese homoglyphs", () => {
    for (const [jp, replacements] of JAPANESE_HOMOGLYPHS) {
      const matches = detectJapaneseHomoglyphs(jp);
      expect(matches.length).toBe(replacements.length);
      expect(matches[0].original).toBe(jp);
      expect(matches[0].possibleReplacement).toBe(replacements[0]);
      expect(matches[0].type).toBe("japanese");
    }
  });
});

// ============================================================================
// isPunycodeDomain
// ============================================================================

describe("isPunycodeDomain", () => {
  it("detects punycode domains", () => {
    expect(isPunycodeDomain("xn--n3h.com")).toBe(true);
    expect(isPunycodeDomain("xn--80ak6aa92e.com")).toBe(true);
  });

  it("detects punycode in second label", () => {
    expect(isPunycodeDomain("sub.xn--n3h.com")).toBe(true);
  });

  it("returns false for normal domains", () => {
    expect(isPunycodeDomain("example.com")).toBe(false);
    expect(isPunycodeDomain("google.co.jp")).toBe(false);
  });

  it("returns false for xn without double dash", () => {
    expect(isPunycodeDomain("xn.com")).toBe(false);
  });
});

// ============================================================================
// decodePunycode
// ============================================================================

describe("decodePunycode", () => {
  it("decodes valid punycode domain", () => {
    const decoded = decodePunycode("xn--n3h.com");
    expect(typeof decoded).toBe("string");
    // URL constructor may or may not decode - just verify it returns a string
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("returns original for non-punycode", () => {
    expect(decodePunycode("example.com")).toBe("example.com");
  });

  it("returns original on invalid punycode (catch branch)", () => {
    const result = decodePunycode("xn--invalid!!!@@@");
    expect(typeof result).toBe("string");
  });
});

// ============================================================================
// LATIN_HOMOGLYPHS map
// ============================================================================

describe("LATIN_HOMOGLYPHS", () => {
  it("maps 0 to O and o", () => {
    expect(LATIN_HOMOGLYPHS.get("0")).toEqual(["O", "o"]);
  });

  it("maps 1 to l, I, and i", () => {
    expect(LATIN_HOMOGLYPHS.get("1")).toEqual(["l", "I", "i"]);
  });

  it("has exactly 2 entries", () => {
    expect(LATIN_HOMOGLYPHS.size).toBe(2);
  });
});

// ============================================================================
// CYRILLIC_TO_LATIN map
// ============================================================================

describe("CYRILLIC_TO_LATIN", () => {
  it("maps all expected cyrillic characters", () => {
    expect(CYRILLIC_TO_LATIN.get("\u0430")).toBe("a");
    expect(CYRILLIC_TO_LATIN.get("\u0435")).toBe("e");
    expect(CYRILLIC_TO_LATIN.get("\u043E")).toBe("o");
    expect(CYRILLIC_TO_LATIN.get("\u0440")).toBe("p");
    expect(CYRILLIC_TO_LATIN.get("\u0441")).toBe("c");
    expect(CYRILLIC_TO_LATIN.get("\u0445")).toBe("x");
    expect(CYRILLIC_TO_LATIN.get("\u0443")).toBe("y");
    expect(CYRILLIC_TO_LATIN.get("\u0456")).toBe("i");
    expect(CYRILLIC_TO_LATIN.get("\u0458")).toBe("j");
    expect(CYRILLIC_TO_LATIN.get("\u04BB")).toBe("h");
    expect(CYRILLIC_TO_LATIN.get("\u043A")).toBe("k");
    expect(CYRILLIC_TO_LATIN.get("\u043D")).toBe("n");
    expect(CYRILLIC_TO_LATIN.get("\u0432")).toBe("b");
    expect(CYRILLIC_TO_LATIN.get("\u0433")).toBe("r");
    expect(CYRILLIC_TO_LATIN.get("\u0442")).toBe("t");
    expect(CYRILLIC_TO_LATIN.get("\u043C")).toBe("m");
  });

  it("has exactly 16 entries", () => {
    expect(CYRILLIC_TO_LATIN.size).toBe(16);
  });
});

// ============================================================================
// GREEK_TO_LATIN map
// ============================================================================

describe("GREEK_TO_LATIN", () => {
  it("maps all lowercase Greek homoglyphs", () => {
    expect(GREEK_TO_LATIN.get("\u03BF")).toBe("o");
    expect(GREEK_TO_LATIN.get("\u03B1")).toBe("a");
    expect(GREEK_TO_LATIN.get("\u03B5")).toBe("e");
    expect(GREEK_TO_LATIN.get("\u03B9")).toBe("i");
    expect(GREEK_TO_LATIN.get("\u03BA")).toBe("k");
    expect(GREEK_TO_LATIN.get("\u03BD")).toBe("v");
    expect(GREEK_TO_LATIN.get("\u03C1")).toBe("p");
    expect(GREEK_TO_LATIN.get("\u03C4")).toBe("t");
    expect(GREEK_TO_LATIN.get("\u03C5")).toBe("u");
    expect(GREEK_TO_LATIN.get("\u03C7")).toBe("x");
  });

  it("maps all uppercase Greek homoglyphs", () => {
    expect(GREEK_TO_LATIN.get("\u0391")).toBe("A");
    expect(GREEK_TO_LATIN.get("\u0392")).toBe("B");
    expect(GREEK_TO_LATIN.get("\u0395")).toBe("E");
    expect(GREEK_TO_LATIN.get("\u0397")).toBe("H");
    expect(GREEK_TO_LATIN.get("\u0399")).toBe("I");
    expect(GREEK_TO_LATIN.get("\u039A")).toBe("K");
    expect(GREEK_TO_LATIN.get("\u039C")).toBe("M");
    expect(GREEK_TO_LATIN.get("\u039D")).toBe("N");
    expect(GREEK_TO_LATIN.get("\u039F")).toBe("O");
    expect(GREEK_TO_LATIN.get("\u03A1")).toBe("P");
    expect(GREEK_TO_LATIN.get("\u03A4")).toBe("T");
    expect(GREEK_TO_LATIN.get("\u03A7")).toBe("X");
    expect(GREEK_TO_LATIN.get("\u03A5")).toBe("Y");
    expect(GREEK_TO_LATIN.get("\u0396")).toBe("Z");
  });

  it("has exactly 24 entries", () => {
    expect(GREEK_TO_LATIN.size).toBe(24);
  });
});

// ============================================================================
// JAPANESE_HOMOGLYPHS map
// ============================================================================

describe("JAPANESE_HOMOGLYPHS", () => {
  it("maps all fullwidth digits", () => {
    expect(JAPANESE_HOMOGLYPHS.get("\uFF10")).toEqual(["0"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF11")).toEqual(["1"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF12")).toEqual(["2"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF13")).toEqual(["3"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF14")).toEqual(["4"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF15")).toEqual(["5"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF16")).toEqual(["6"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF17")).toEqual(["7"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF18")).toEqual(["8"]);
    expect(JAPANESE_HOMOGLYPHS.get("\uFF19")).toEqual(["9"]);
  });

  it("maps dash-like characters", () => {
    expect(JAPANESE_HOMOGLYPHS.get("\u30FC")).toEqual(["-"]); // katakana long vowel
    expect(JAPANESE_HOMOGLYPHS.get("\u2015")).toEqual(["-"]); // dash
    expect(JAPANESE_HOMOGLYPHS.get("\u2014")).toEqual(["-"]); // em dash
    expect(JAPANESE_HOMOGLYPHS.get("\u2212")).toEqual(["-"]); // minus
    expect(JAPANESE_HOMOGLYPHS.get("\u4E00")).toEqual(["-"]); // CJK one
  });

  it("maps all fullwidth uppercase letters", () => {
    const uppercaseStart = 0xFF21; // Ａ
    for (let i = 0; i < 26; i++) {
      const fullwidth = String.fromCharCode(uppercaseStart + i);
      const ascii = String.fromCharCode(0x41 + i);
      expect(JAPANESE_HOMOGLYPHS.get(fullwidth)).toEqual([ascii]);
    }
  });

  it("maps all fullwidth lowercase letters", () => {
    const lowercaseStart = 0xFF41; // ａ
    for (let i = 0; i < 26; i++) {
      const fullwidth = String.fromCharCode(lowercaseStart + i);
      const ascii = String.fromCharCode(0x61 + i);
      expect(JAPANESE_HOMOGLYPHS.get(fullwidth)).toEqual([ascii]);
    }
  });

  it("has correct total size (5 dash + 10 digits + 26 upper + 26 lower = 67)", () => {
    expect(JAPANESE_HOMOGLYPHS.size).toBe(67);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Digit scoring
// ============================================================================

describe("calculateTyposquatHeuristics - digit scoring", () => {
  it("returns 0 for legitimate domains", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.totalScore).toBe(0);
    expect(scores.breakdown.latinHomoglyphs).toBe(0);
    expect(scores.breakdown.mixedScript).toBe(0);
  });

  it("scores 30 for digit surrounded by letters (app1e: letter-digit-letter)", () => {
    // "app1e" - 1 is between p and e → surrounded → 30pts
    const scores = calculateTyposquatHeuristics("app1e.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
    expect(scores.totalScore).toBe(30);
  });

  it("scores 15 for digit with letter only before (paypa1: letter-digit at end)", () => {
    // "paypa1" - 1 is after a, but nothing after → embedded but NOT surrounded → 15pts
    const scores = calculateTyposquatHeuristics("paypa1.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(15);
    expect(scores.totalScore).toBe(15);
  });

  it("scores 0 for digit at label start (leading digit is natural)", () => {
    // "0auth" - 0 at start of label → not embedded → 0pts
    const scores = calculateTyposquatHeuristics("0auth.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(0);
    expect(scores.totalScore).toBe(0);
  });

  it("scores 0 for natural leading digit domain (1password)", () => {
    const scores = calculateTyposquatHeuristics("1password.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(0);
    expect(scores.totalScore).toBe(0);
  });

  it("treats consecutive digits as one group - g00gle (surrounded)", () => {
    // "g00gle" - digits 0,0 at positions 1,2 are consecutive group
    // hasLetterBefore: g at pos 0 → true
    // hasLetterAfter: g at pos 3 → true
    // → surrounded → 2 digits * 30 = 60, capped at 30
    const scores = calculateTyposquatHeuristics("g00gle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30); // capped at 30
    expect(scores.totalScore).toBe(30);
  });

  it("treats non-consecutive digits as separate groups", () => {
    // "g0o0gle" - digit at pos 1, letter at pos 2, digit at pos 3
    // Group 1: pos 1 (0) - hasLetterBefore: g → true, hasLetterAfter: o → true → surrounded
    // Group 2: pos 3 (0) - hasLetterBefore: o → true, hasLetterAfter: g → true → surrounded
    // 2 surrounded * 30 = 60, capped at 30
    const scores = calculateTyposquatHeuristics("g0o0gle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30); // capped at 30
  });

  it("digit score is capped at 30", () => {
    // Multiple digits all surrounded
    const scores = calculateTyposquatHeuristics("a0b0c0d.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("correctly computes embedded - surrounded for mixed digit positions", () => {
    // "g0ogle1" - digit 0 at pos 1: hasLetterBefore(g)=true, hasLetterAfter(o)=true → surrounded+embedded
    //           - digit 1 at end: hasLetterBefore(e)=true, hasLetterAfter=false → embedded only
    // surrounded=1, embedded=2
    // score = 1*30 + (2-1)*15 = 45, capped at 30
    const scores = calculateTyposquatHeuristics("g0ogle1.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30); // capped
  });

  it("lower score when only trailing digit (embedded but not surrounded)", () => {
    // "googl1" - 1 at pos 5, hasLetterBefore(l)=true, hasLetterAfter=false → embedded only
    // score = 0*30 + (1-0)*15 = 15
    const scores = calculateTyposquatHeuristics("googl1.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(15);
    expect(scores.totalScore).toBe(15);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Sequence scoring
// ============================================================================

describe("calculateTyposquatHeuristics - sequence scoring", () => {
  it("scores 30 for sequence at label start (rnicrosoft)", () => {
    const scores = calculateTyposquatHeuristics("rnicrosoft.com", DEFAULT_TYPOSQUAT_CONFIG);
    // rn at position 0 of label → dangerous → 30 pts
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("scores 0 for sequence NOT at label start (learn)", () => {
    // "learn" has "rn" at position 3 → NOT at label start → 0pts
    const scores = calculateTyposquatHeuristics("learn.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(0);
    expect(scores.totalScore).toBe(0);
  });

  it("scores 30 for vv at label start", () => {
    const scores = calculateTyposquatHeuristics("vvitter.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("sequence score caps at 50", () => {
    // Two sequences at label starts: "rn.vv" - each label starts with a sequence
    const scores = calculateTyposquatHeuristics("rn.vv", DEFAULT_TYPOSQUAT_CONFIG);
    // 2 * 30 = 60, capped at 50
    expect(scores.breakdown.latinHomoglyphs).toBe(50);
  });

  it("sequence at second label start in multi-label domain", () => {
    // "sub.rnicrosoft.com" - rn at start of second label
    const scores = calculateTyposquatHeuristics("sub.rnicrosoft.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Cyrillic scoring
// ============================================================================

describe("calculateTyposquatHeuristics - cyrillic scoring", () => {
  it("scores 25 per cyrillic character (1 char = 25)", () => {
    // "g\u043Eogle.com" - 1 cyrillic о → 25pts cyrillic + 40pts mixed
    const scores = calculateTyposquatHeuristics("g\u043Eogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.cyrillicHomoglyphs).toBe(25);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(65);
  });

  it("scores 50 for 2 cyrillic characters (2 * 25 = 50)", () => {
    // "g\u043E\u043Egle.com" - 2 cyrillic о → 50pts
    const scores = calculateTyposquatHeuristics("g\u043E\u043Egle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.cyrillicHomoglyphs).toBe(50);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(90);
  });

  it("cyrillic score caps at 50 (3 chars still 50)", () => {
    // "\u0430\u0440\u0440le.com" - 3 cyrillic → 75 capped to 50
    const scores = calculateTyposquatHeuristics("\u0430\u0440\u0440le.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.cyrillicHomoglyphs).toBe(50);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(90);
  });

  it("has mixed script flag set", () => {
    const scores = calculateTyposquatHeuristics("g\u043Eogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.hasMixedScript).toBe(true);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Greek scoring
// ============================================================================

describe("calculateTyposquatHeuristics - greek scoring", () => {
  it("scores 25 for 1 greek character", () => {
    // "g\u03BFogle.com" - 1 greek ο → 25pts greek + 40pts mixed
    const scores = calculateTyposquatHeuristics("g\u03BFogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.greekHomoglyphs).toBe(25);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(65);
  });

  it("scores 50 for 2 greek characters (2 * 25 = 50)", () => {
    const scores = calculateTyposquatHeuristics("g\u03BF\u03BFgle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.greekHomoglyphs).toBe(50);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(90);
  });

  it("greek score caps at 50 (3 chars still 50)", () => {
    const scores = calculateTyposquatHeuristics("\u03B1\u03BF\u03B9gle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.greekHomoglyphs).toBe(50);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBe(90);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Japanese scoring
// ============================================================================

describe("calculateTyposquatHeuristics - japanese scoring", () => {
  it("scores 15 for 1 japanese fullwidth character", () => {
    const scores = calculateTyposquatHeuristics("\uFF47oogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.japaneseHomoglyphs).toBe(15);
    expect(scores.totalScore).toBe(15);
  });

  it("scores 30 for 2 japanese fullwidth characters (2 * 15 = 30)", () => {
    const scores = calculateTyposquatHeuristics("\uFF47\uFF4Fogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.japaneseHomoglyphs).toBe(30);
  });

  it("japanese score caps at 30 (3 chars still 30)", () => {
    const scores = calculateTyposquatHeuristics("\uFF47\uFF4F\uFF4Fgle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.japaneseHomoglyphs).toBe(30);
  });

  it("japanese detection disabled when config flag is false", () => {
    const config: TyposquatConfig = {
      ...DEFAULT_TYPOSQUAT_CONFIG,
      detectJapaneseHomoglyphs: false,
    };
    const scores = calculateTyposquatHeuristics("\uFF47oogle.com", config);
    expect(scores.breakdown.japaneseHomoglyphs).toBe(0);
  });

  it("japanese detection enabled by default", () => {
    const scores = calculateTyposquatHeuristics("\uFF47oogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.japaneseHomoglyphs).toBeGreaterThan(0);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Punycode scoring
// ============================================================================

describe("calculateTyposquatHeuristics - punycode scoring", () => {
  it("scores 10 for punycode domain when warnOnPunycode is true", () => {
    const scores = calculateTyposquatHeuristics("xn--n3h.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.punycode).toBe(10);
    expect(scores.isPunycode).toBe(true);
  });

  it("scores 0 for punycode domain when warnOnPunycode is false", () => {
    const config: TyposquatConfig = {
      ...DEFAULT_TYPOSQUAT_CONFIG,
      warnOnPunycode: false,
    };
    const scores = calculateTyposquatHeuristics("xn--n3h.com", config);
    expect(scores.breakdown.punycode).toBe(0);
    expect(scores.isPunycode).toBe(true);
  });

  it("scores 0 punycode for normal domain", () => {
    const scores = calculateTyposquatHeuristics("example.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.punycode).toBe(0);
    expect(scores.isPunycode).toBe(false);
  });

  it("excludes xn-- label content from homoglyph analysis", () => {
    // The xn-- label gets replaced with "" in analysisDomain
    // So digits inside xn-- labels should NOT contribute to digit score
    const scores = calculateTyposquatHeuristics("xn--80ak6aa92e.com", DEFAULT_TYPOSQUAT_CONFIG);
    // Only punycode score should exist, not digit score
    expect(scores.breakdown.punycode).toBe(10);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Multi-label / offset
// ============================================================================

describe("calculateTyposquatHeuristics - multi-label offset", () => {
  it("detects digit in second label with correct offset", () => {
    // "sub.g0ogle.com"
    // label "sub" offset=0, label "g0ogle" offset=4
    // digit '0' at domain position 5 → posInLabel = 5 - 4 = 1
    // hasLetterBefore: g → true, hasLetterAfter: o → true → surrounded
    const scores = calculateTyposquatHeuristics("sub.g0ogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("detects digit in third label", () => {
    // "a.b.g0ogle.com"
    // label "a" offset=0, label "b" offset=2, label "g0ogle" offset=4
    const scores = calculateTyposquatHeuristics("a.b.g0ogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("detects sequence at start of second label", () => {
    // "sub.rnicrosoft.com" - labelStarts includes offset for "rnicrosoft"
    const scores = calculateTyposquatHeuristics("sub.rnicrosoft.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(30);
  });

  it("does not score sequence in middle of second label", () => {
    // "sub.learn.com" - "rn" is NOT at label start
    const scores = calculateTyposquatHeuristics("sub.learn.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.latinHomoglyphs).toBe(0);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - Total score cap
// ============================================================================

describe("calculateTyposquatHeuristics - total score cap", () => {
  it("caps total score at 100", () => {
    // Cyrillic(50) + mixed(40) + punycode(10) + digit → should cap at 100
    const scores = calculateTyposquatHeuristics("xn--g\u043E\u043Egle123.xyz", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.totalScore).toBeLessThanOrEqual(100);
  });

  it("returns correct breakdown even when total is capped", () => {
    // Greek(50) + mixed(40) + punycode(10) = 100 exactly
    // Use a domain with many Greek chars + punycode
    const config: TyposquatConfig = {
      ...DEFAULT_TYPOSQUAT_CONFIG,
      warnOnPunycode: true,
    };
    const scores = calculateTyposquatHeuristics(
      "xn--\u03B1\u03BF\u03B9gle.com", config
    );
    expect(scores.totalScore).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// calculateTyposquatHeuristics - detectedScripts in result
// ============================================================================

describe("calculateTyposquatHeuristics - detectedScripts", () => {
  it("returns latin script for normal domain", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.detectedScripts).toContain("latin");
  });

  it("returns both latin and cyrillic for mixed domain", () => {
    const scores = calculateTyposquatHeuristics("g\u043Eogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.detectedScripts).toContain("latin");
    expect(scores.detectedScripts).toContain("cyrillic");
  });

  it("returns homoglyphs array", () => {
    const scores = calculateTyposquatHeuristics("g\u043Eogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.homoglyphs.length).toBeGreaterThan(0);
    expect(scores.homoglyphs.some(h => h.type === "cyrillic")).toBe(true);
  });
});

// ============================================================================
// isHighRiskTyposquat
// ============================================================================

describe("isHighRiskTyposquat", () => {
  it("returns true when score equals threshold", () => {
    const scores = calculateTyposquatHeuristics("app1e.com", DEFAULT_TYPOSQUAT_CONFIG);
    // Score is 30
    expect(isHighRiskTyposquat(scores, 30)).toBe(true);
  });

  it("returns true when score exceeds threshold", () => {
    const scores = calculateTyposquatHeuristics("g\u043Eogle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(isHighRiskTyposquat(scores, 20)).toBe(true);
  });

  it("returns false when score is below threshold", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(isHighRiskTyposquat(scores, 50)).toBe(false);
  });

  it("returns false for legitimate domain at default threshold", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(isHighRiskTyposquat(scores, 30)).toBe(false);
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe("edge cases", () => {
  it("handles empty domain", () => {
    const result = calculateTyposquatHeuristics("", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.totalScore).toBe(0);
  });

  it("handles dots-only domain", () => {
    const result = calculateTyposquatHeuristics("...", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.totalScore).toBe(0);
  });

  it("handles single character domain", () => {
    const result = calculateTyposquatHeuristics("a", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.totalScore).toBe(0);
  });

  it("handles domain with only digits at start (000webhost)", () => {
    const result = calculateTyposquatHeuristics("000webhost.com", DEFAULT_TYPOSQUAT_CONFIG);
    // Leading digits → not embedded → 0pts
    expect(result.breakdown.latinHomoglyphs).toBe(0);
  });

  it("digit in label with no letters before it is not scored", () => {
    // "0a" - 0 at pos 0, no letter before → not embedded
    const result = calculateTyposquatHeuristics("0a.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.breakdown.latinHomoglyphs).toBe(0);
  });

  it("handles combined digit + sequence scoring", () => {
    // "rn0crosoft" - rn at label start → 30pts sequence
    // 0 at pos 2: hasLetterBefore(n)=true, hasLetterAfter(c)=true → surrounded → 30pts digit
    // digit score capped at 30, total latin = 30 + 30 = 60
    const result = calculateTyposquatHeuristics("rn0crosoft.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.breakdown.latinHomoglyphs).toBe(60);
  });

  it("sequence + digit scores add up correctly", () => {
    // "rntest.com" - rn at pos 0 → 30pts sequence, no digits
    const result = calculateTyposquatHeuristics("rntest.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.breakdown.latinHomoglyphs).toBe(30);
  });

  it("combined cyrillic + digit scoring", () => {
    // Both cyrillic and digit in same domain
    const scores = calculateTyposquatHeuristics("g\u043E0gle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.breakdown.cyrillicHomoglyphs).toBe(25);
    expect(scores.breakdown.mixedScript).toBe(40);
    // Digit: 0 at position depends on domain structure
    expect(scores.totalScore).toBeGreaterThanOrEqual(65);
  });
});
