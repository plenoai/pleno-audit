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
} from "./heuristics.js";
import { DEFAULT_TYPOSQUAT_CONFIG } from "./types.js";

describe("getCharacterScript", () => {
  it("detects latin characters", () => {
    expect(getCharacterScript("a")).toBe("latin");
    expect(getCharacterScript("Z")).toBe("latin");
  });

  it("detects numbers as latin", () => {
    // Numbers are treated as latin in this implementation
    expect(getCharacterScript("0")).toBe("latin");
    expect(getCharacterScript("9")).toBe("latin");
  });

  it("detects cyrillic characters", () => {
    expect(getCharacterScript("а")).toBe("cyrillic"); // Cyrillic a
    expect(getCharacterScript("о")).toBe("cyrillic"); // Cyrillic o
  });

  it("detects hiragana", () => {
    expect(getCharacterScript("あ")).toBe("hiragana");
    expect(getCharacterScript("ん")).toBe("hiragana");
  });

  it("detects katakana", () => {
    expect(getCharacterScript("ア")).toBe("katakana");
    expect(getCharacterScript("ン")).toBe("katakana");
  });

  it("detects CJK characters", () => {
    expect(getCharacterScript("日")).toBe("cjk");
    expect(getCharacterScript("本")).toBe("cjk");
  });
});

describe("detectScripts", () => {
  it("detects single script", () => {
    const result = detectScripts("example");
    expect(result.has("latin")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("detects mixed scripts", () => {
    const result = detectScripts("exаmple"); // Contains Cyrillic 'а'
    expect(result.has("latin")).toBe(true);
    expect(result.has("cyrillic")).toBe(true);
    expect(result.size).toBeGreaterThan(1);
  });
});

describe("isSuspiciousMixedScript", () => {
  it("returns true for latin+cyrillic mix", () => {
    expect(isSuspiciousMixedScript(new Set(["latin", "cyrillic"]))).toBe(true);
  });

  it("returns false for japanese script combinations", () => {
    expect(isSuspiciousMixedScript(new Set(["hiragana", "katakana"]))).toBe(false);
    expect(isSuspiciousMixedScript(new Set(["hiragana", "cjk"]))).toBe(false);
  });

  it("returns false for single script", () => {
    expect(isSuspiciousMixedScript(new Set(["latin"]))).toBe(false);
  });
});

describe("detectLatinHomoglyphs", () => {
  it("detects number-letter homoglyphs", () => {
    const matches = detectLatinHomoglyphs("g00gle"); // 0 looks like O
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.original === "0")).toBe(true);
  });

  it("returns empty for normal domains", () => {
    const matches = detectLatinHomoglyphs("google");
    expect(matches.length).toBe(0);
  });
});

describe("detectCyrillicHomoglyphs", () => {
  it("detects cyrillic homoglyphs", () => {
    const matches = detectCyrillicHomoglyphs("gооgle"); // Contains Cyrillic о
    expect(matches.length).toBeGreaterThan(0);
  });

  it("returns empty for pure latin", () => {
    const matches = detectCyrillicHomoglyphs("google");
    expect(matches.length).toBe(0);
  });
});

describe("isPunycodeDomain", () => {
  it("detects punycode domains", () => {
    expect(isPunycodeDomain("xn--n3h.com")).toBe(true);
    expect(isPunycodeDomain("xn--80ak6aa92e.com")).toBe(true);
  });

  it("returns false for normal domains", () => {
    expect(isPunycodeDomain("example.com")).toBe(false);
    expect(isPunycodeDomain("google.co.jp")).toBe(false);
  });
});

describe("decodePunycode", () => {
  it("attempts to decode punycode", () => {
    // decodePunycode may return original on error
    const decoded = decodePunycode("xn--n3h");
    expect(typeof decoded).toBe("string");
  });

  it("returns original for non-punycode", () => {
    const decoded = decodePunycode("example");
    expect(decoded).toBe("example");
  });
});

describe("calculateTyposquatHeuristics", () => {
  it("returns low score for legitimate domains", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.totalScore).toBeLessThan(30);
    expect(scores.breakdown.mixedScript).toBe(0);
  });

  it("returns high score for mixed script domain", () => {
    const scores = calculateTyposquatHeuristics("gооgle.com", DEFAULT_TYPOSQUAT_CONFIG); // Cyrillic о
    expect(scores.totalScore).toBeGreaterThan(30);
    expect(scores.breakdown.mixedScript).toBeGreaterThan(0);
  });

  it("returns high score for punycode domain", () => {
    const scores = calculateTyposquatHeuristics("xn--80ak6aa92e.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.totalScore).toBeGreaterThan(0);
  });

  it("caps total score at 100", () => {
    const scores = calculateTyposquatHeuristics("xn--gооgle123.xyz", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.totalScore).toBeLessThanOrEqual(100);
  });
});

describe("isHighRiskTyposquat", () => {
  it("returns true when score exceeds threshold", () => {
    const scores = calculateTyposquatHeuristics("gооgle.com", DEFAULT_TYPOSQUAT_CONFIG); // Cyrillic
    expect(isHighRiskTyposquat(scores, 20)).toBe(true);
  });

  it("returns false for legitimate domains", () => {
    const scores = calculateTyposquatHeuristics("google.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(isHighRiskTyposquat(scores, 50)).toBe(false);
  });
});

describe("CYRILLIC_TO_LATIN", () => {
  it("maps cyrillic characters to latin equivalents", () => {
    expect(CYRILLIC_TO_LATIN.get("а")).toBe("a");
    expect(CYRILLIC_TO_LATIN.get("о")).toBe("o");
    expect(CYRILLIC_TO_LATIN.get("е")).toBe("e");
  });
});

describe("detectGreekHomoglyphs", () => {
  it("detects Greek omicron as Latin o", () => {
    const matches = detectGreekHomoglyphs("g\u03BFogle"); // ο (omicron)
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some(m => m.original === "\u03BF" && m.possibleReplacement === "o")).toBe(true);
  });

  it("detects multiple Greek homoglyphs", () => {
    // α (alpha), ο (omicron), ι (iota)
    const matches = detectGreekHomoglyphs("\u03B1\u03BF\u03B9");
    expect(matches.length).toBe(3);
  });

  it("returns empty for pure latin", () => {
    const matches = detectGreekHomoglyphs("google");
    expect(matches.length).toBe(0);
  });

  it("detects uppercase Greek homoglyphs", () => {
    const matches = detectGreekHomoglyphs("\u0391\u0392"); // Α, Β
    expect(matches.length).toBe(2);
  });
});

describe("detectJapaneseHomoglyphs", () => {
  it("detects fullwidth Latin characters", () => {
    const matches = detectJapaneseHomoglyphs("\uFF47\uFF4F\uFF4F\uFF47\uFF4C\uFF45"); // ｇｏｏｇｌｅ
    expect(matches.length).toBe(6);
  });

  it("detects katakana long vowel mark as hyphen", () => {
    const matches = detectJapaneseHomoglyphs("test\u30FCdomain"); // ー
    expect(matches.length).toBe(1);
    expect(matches[0].possibleReplacement).toBe("-");
  });

  it("detects fullwidth digits", () => {
    const matches = detectJapaneseHomoglyphs("\uFF11\uFF12\uFF13"); // １２３
    expect(matches.length).toBe(3);
  });

  it("returns empty for normal ascii", () => {
    const matches = detectJapaneseHomoglyphs("google.com");
    expect(matches.length).toBe(0);
  });
});

describe("isSuspiciousMixedScript", () => {
  it("returns true for latin+greek mix", () => {
    expect(isSuspiciousMixedScript(new Set(["latin", "greek"]))).toBe(true);
  });

  it("returns false for CJK combinations", () => {
    expect(isSuspiciousMixedScript(new Set(["cjk", "hiragana", "katakana"]))).toBe(false);
  });
});

describe("getCharacterScript", () => {
  it("detects greek characters", () => {
    expect(getCharacterScript("\u03B1")).toBe("greek"); // alpha
    expect(getCharacterScript("\u03BF")).toBe("greek"); // omicron
  });

  it("detects fullwidth as CJK", () => {
    expect(getCharacterScript("\uFF41")).toBe("cjk"); // ａ
  });

  it("returns unknown for control characters", () => {
    expect(getCharacterScript("\u0000")).toBe("unknown");
    expect(getCharacterScript("\u0001")).toBe("unknown");
  });

  it("returns unknown for special symbols", () => {
    expect(getCharacterScript("@")).toBe("unknown");
    expect(getCharacterScript("#")).toBe("unknown");
  });
});

describe("edge cases: malformed input", () => {
  it("calculateTyposquatHeuristics handles empty domain", () => {
    const result = calculateTyposquatHeuristics("", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it("calculateTyposquatHeuristics handles dots-only domain", () => {
    const result = calculateTyposquatHeuristics("...", DEFAULT_TYPOSQUAT_CONFIG);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it("detectLatinHomoglyphs detects sequence at label start", () => {
    // "rn" at the beginning of label - dangerous (like "rnicrosoft")
    const matches = detectLatinHomoglyphs("rnicrosoft");
    const sequenceMatches = matches.filter(m => m.type === "latin_sequence");
    expect(sequenceMatches.length).toBeGreaterThan(0);
    expect(sequenceMatches[0].original).toBe("rn");
    expect(sequenceMatches[0].possibleReplacement).toBe("m");
  });

  it("detectLatinHomoglyphs detects vv sequence", () => {
    const matches = detectLatinHomoglyphs("vvitter");
    const sequenceMatches = matches.filter(m => m.type === "latin_sequence" && m.original === "vv");
    expect(sequenceMatches.length).toBe(1);
  });

  it("calculateTyposquatHeuristics gives high score for Cyrillic mixed-script attack", () => {
    // "аррlе.com" with Cyrillic а, р, р
    const scores = calculateTyposquatHeuristics("\u0430\u0440\u0440le.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.hasMixedScript).toBe(true);
    expect(scores.breakdown.cyrillicHomoglyphs).toBeGreaterThan(0);
    expect(scores.breakdown.mixedScript).toBe(40);
    expect(scores.totalScore).toBeGreaterThanOrEqual(40);
  });

  it("calculateTyposquatHeuristics gives high score for Greek mixed-script", () => {
    // "g\u03BF\u03BFgle.com" with Greek omicron
    const scores = calculateTyposquatHeuristics("g\u03BF\u03BFgle.com", DEFAULT_TYPOSQUAT_CONFIG);
    expect(scores.hasMixedScript).toBe(true);
    expect(scores.breakdown.greekHomoglyphs).toBeGreaterThan(0);
    expect(scores.breakdown.mixedScript).toBe(40);
  });

  it("decodePunycode handles completely invalid domain", () => {
    const result = decodePunycode("xn--invalid!!!@@@");
    expect(typeof result).toBe("string");
  });

  it("GREEK_TO_LATIN contains expected mappings", () => {
    expect(GREEK_TO_LATIN.get("\u03BF")).toBe("o"); // omicron
    expect(GREEK_TO_LATIN.get("\u03B1")).toBe("a"); // alpha
    expect(GREEK_TO_LATIN.get("\u039F")).toBe("O"); // Omicron uppercase
  });

  it("JAPANESE_HOMOGLYPHS contains fullwidth mappings", () => {
    expect(JAPANESE_HOMOGLYPHS.get("\uFF41")).toEqual(["a"]); // ａ
    expect(JAPANESE_HOMOGLYPHS.get("\u30FC")).toEqual(["-"]); // ー
  });
});
