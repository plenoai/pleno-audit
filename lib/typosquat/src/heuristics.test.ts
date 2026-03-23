import { describe, it, expect } from "vitest";
import {
  getCharacterScript,
  detectScripts,
  isSuspiciousMixedScript,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  isPunycodeDomain,
  decodePunycode,
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
  CYRILLIC_TO_LATIN,
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
