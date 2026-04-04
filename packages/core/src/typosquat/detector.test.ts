import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTyposquatDetector, type TyposquatCache } from "./detector.js";
import type { TyposquatConfig, TyposquatResult, TyposquatScores } from "./types.js";
import * as heuristicsModule from "./heuristics.js";

function createMockCache(): TyposquatCache & { store: Map<string, TyposquatResult> } {
  const store = new Map<string, TyposquatResult>();
  return {
    store,
    get: vi.fn((domain: string) => store.get(domain) || null),
    set: vi.fn((domain: string, result: TyposquatResult) => {
      store.set(domain, result);
    }),
    clear: vi.fn(() => store.clear()),
  };
}

const defaultConfig: TyposquatConfig = {
  enabled: true,
  heuristicThreshold: 30,
  cacheExpiry: 86400000,
  detectJapaneseHomoglyphs: true,
  warnOnPunycode: true,
};

describe("createTyposquatDetector", () => {
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    cache = createMockCache();
  });

  describe("checkDomain", () => {
    it("returns result for clean domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("google.com");

      expect(result.domain).toBe("google.com");
      expect(result.isTyposquat).toBe(false);
      expect(result.method).toBe("heuristic");
      expect(result.confidence).toBe("none");
    });

    it("detects Latin digit homoglyphs (g00gle)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("g00gle.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.homoglyphs.length).toBeGreaterThan(0);
    });

    it("detects domains with numeric substitution (g0ogle)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("g0ogle.com"); // 0 instead of o

      // The heuristics should detect the numeric substitution
      expect(result.heuristics.homoglyphs.some(h => h.type === "latin_digit")).toBe(true);
    });

    it("detects mixed script domains", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Cyrillic 'о' (U+043E) looks like Latin 'o'
      const result = detector.checkDomain("g\u043E\u043Egle.com"); // Cyrillic 'о' (U+043E)

      expect(result.heuristics.hasMixedScript).toBe(true);
    });

    it("returns cached result when available", () => {
      const cachedResult: TyposquatResult = {
        domain: "cached.com",
        isTyposquat: false,
        confidence: "none",
        method: "heuristic",
        heuristics: {
          homoglyphs: [],
          hasMixedScript: false,
          detectedScripts: ["latin"],
          isPunycode: false,
          totalScore: 0,
          breakdown: {
            latinHomoglyphs: 0,
            cyrillicHomoglyphs: 0,
            greekHomoglyphs: 0,
            japaneseHomoglyphs: 0,
            mixedScript: 0,
            punycode: 0,
          },
        },
        checkedAt: Date.now(),
        normalizedDomain: "cached.com",
      };
      cache.store.set("cached.com", cachedResult);

      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("cached.com");

      expect(result.method).toBe("cache");
    });

    it("ignores expired cache entries", () => {
      const expiredResult: TyposquatResult = {
        domain: "expired.com",
        isTyposquat: false,
        confidence: "none",
        method: "heuristic",
        heuristics: {
          homoglyphs: [],
          hasMixedScript: false,
          detectedScripts: ["latin"],
          isPunycode: false,
          totalScore: 0,
          breakdown: {
            latinHomoglyphs: 0,
            cyrillicHomoglyphs: 0,
            greekHomoglyphs: 0,
            japaneseHomoglyphs: 0,
            mixedScript: 0,
            punycode: 0,
          },
        },
        checkedAt: Date.now() - defaultConfig.cacheExpiry - 1000,
        normalizedDomain: "expired.com",
      };
      cache.store.set("expired.com", expiredResult);

      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("expired.com");

      expect(result.method).toBe("heuristic");
    });

    it("caches result after check", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      detector.checkDomain("newdomain.com");

      expect(cache.set).toHaveBeenCalledWith(
        "newdomain.com",
        expect.objectContaining({ domain: "newdomain.com" })
      );
    });

    it("includes timestamp in result", () => {
      const before = Date.now();
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("test.com");
      const after = Date.now();

      expect(result.checkedAt).toBeGreaterThanOrEqual(before);
      expect(result.checkedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("Cyrillic homoglyph detection", () => {
    it("detects single Cyrillic character (exampl\u0435.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Cyrillic е (U+0435) looks like Latin e
      const result = detector.checkDomain("exampl\u0435.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.breakdown.cyrillicHomoglyphs).toBeGreaterThan(0);
      expect(result.heuristics.homoglyphs.some(h => h.type === "cyrillic")).toBe(true);
    });

    it("detects multiple Cyrillic characters (\u0430\u0440\u0440l\u0435.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // аррlе - multiple Cyrillic chars mixed with Latin
      const result = detector.checkDomain("\u0430\u0440\u0440l\u0435.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.heuristics.hasMixedScript).toBe(true);
    });

    it("scores mixed Cyrillic+Latin with mixedScript bonus", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("g\u043E\u043Egle.com");

      // 2 Cyrillic chars (2×25=50 pts, capped at 50) + mixed script (40 pts) = 90 pts
      expect(result.heuristics.breakdown.cyrillicHomoglyphs).toBeGreaterThan(0);
      expect(result.heuristics.breakdown.mixedScript).toBe(40);
    });
  });

  describe("Greek homoglyph detection", () => {
    it("detects Greek omicron (g\u03BF\u03BFgle.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Greek ο (U+03BF) looks like Latin o
      const result = detector.checkDomain("g\u03BF\u03BFgle.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.breakdown.greekHomoglyphs).toBeGreaterThan(0);
      expect(result.heuristics.homoglyphs.some(h => h.type === "greek")).toBe(true);
    });

    it("detects Greek alpha (\u03B1pple.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Greek α (U+03B1) looks like Latin a
      const result = detector.checkDomain("\u03B1pple.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.breakdown.greekHomoglyphs).toBeGreaterThan(0);
    });

    it("detects Latin+Greek mixed script", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("pay\u03C1al.com"); // Greek rho ρ

      expect(result.heuristics.hasMixedScript).toBe(true);
      expect(result.heuristics.breakdown.mixedScript).toBe(40);
    });
  });

  describe("Full-width character detection (Japanese)", () => {
    it("detects full-width Latin letters (\uFF47\uFF4F\uFF4F\uFF47le.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // ｇｏｏｇle.com - full-width g, o, o, g
      const result = detector.checkDomain("\uFF47\uFF4F\uFF4F\uFF47le.com");

      expect(result.heuristics.homoglyphs.some(h => h.type === "japanese")).toBe(true);
      expect(result.heuristics.breakdown.japaneseHomoglyphs).toBeGreaterThan(0);
    });

    it("skips Japanese homoglyph detection when disabled", () => {
      const noJpConfig: TyposquatConfig = {
        ...defaultConfig,
        detectJapaneseHomoglyphs: false,
      };
      const detector = createTyposquatDetector(noJpConfig, createMockCache());
      const result = detector.checkDomain("\uFF47\uFF4F\uFF4F\uFF47le.com");

      expect(result.heuristics.breakdown.japaneseHomoglyphs).toBe(0);
      expect(result.heuristics.homoglyphs.some(h => h.type === "japanese")).toBe(false);
    });
  });

  describe("Punycode detection", () => {
    it("detects Punycode domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("xn--n3h.com"); // Snowman emoji

      expect(result.heuristics.isPunycode).toBe(true);
      // Punycode domains are detected as suspicious
      expect(result.heuristics.breakdown.punycode).toBeGreaterThan(0);
    });

    it("keeps non-Punycode domain unchanged", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("example.com");

      expect(result.normalizedDomain).toBe("example.com");
      expect(result.heuristics.isPunycode).toBe(false);
    });

    it("does not add Punycode score when warnOnPunycode is disabled", () => {
      const noPunycodeConfig: TyposquatConfig = {
        ...defaultConfig,
        warnOnPunycode: false,
      };
      const detector = createTyposquatDetector(noPunycodeConfig, createMockCache());
      const result = detector.checkDomain("xn--n3h.com");

      expect(result.heuristics.breakdown.punycode).toBe(0);
    });

    it("punycode-only domains score below threshold (Japanese official sites)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // xn--r8jz45g.jp = 総務省.jp
      const result = detector.checkDomain("xn--r8jz45g.jp");

      // Only 10 pts from punycode, not flagged as typosquat
      expect(result.heuristics.totalScore).toBeLessThan(defaultConfig.heuristicThreshold);
      expect(result.isTyposquat).toBe(false);
    });
  });

  describe("Sequence pattern detection (rn→m, vv→w)", () => {
    it("detects rn at label start (rnicrosoft.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("rnicrosoft.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.homoglyphs.some(h => h.type === "latin_sequence" && h.original === "rn")).toBe(true);
    });

    it("detects vv at label start (vvikipedia.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("vvikipedia.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.homoglyphs.some(h => h.type === "latin_sequence" && h.original === "vv")).toBe(true);
    });

    it("does NOT flag rn in middle of legitimate domain (learn, intern)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // "learn" has rn but not at label start
      const result = detector.checkDomain("learn.microsoft.com");

      expect(result.isTyposquat).toBe(false);
    });

    it("does NOT flag cl sequences (high false positive rate)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("clicky.com");

      expect(result.isTyposquat).toBe(false);
    });
  });

  describe("Digit homoglyphs (0/O, 1/l)", () => {
    it("detects digit 0 surrounded by letters (micr0soft.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("micr0soft.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.breakdown.latinHomoglyphs).toBe(30);
    });

    it("detects digit 1 surrounded by letters (app1e.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("app1e.com");

      expect(result.isTyposquat).toBe(true);
      expect(result.heuristics.breakdown.latinHomoglyphs).toBe(30);
    });

    it("scores trailing digit lower (paypa1.com = 15 pts, not flagged)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("paypa1.com");

      // Trailing digit: only one side letter (15 pts), below 30 threshold
      expect(result.heuristics.breakdown.latinHomoglyphs).toBe(15);
      expect(result.isTyposquat).toBe(false);
    });

    it("does NOT flag leading digits in legitimate domains (1password.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("1password.com");

      expect(result.isTyposquat).toBe(false);
    });

    it("does NOT flag leading digits (000webhost.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("000webhost.com");

      expect(result.isTyposquat).toBe(false);
    });
  });

  describe("Mixed script detection", () => {
    it("flags Latin+Cyrillic as mixed script", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("mi\u0441rosoft.com"); // Cyrillic с

      expect(result.heuristics.hasMixedScript).toBe(true);
      expect(result.heuristics.breakdown.mixedScript).toBe(40);
    });

    it("flags Latin+Greek as mixed script", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("g\u03BF\u03BFgle.com"); // Greek ο

      expect(result.heuristics.hasMixedScript).toBe(true);
      expect(result.heuristics.breakdown.mixedScript).toBe(40);
    });

    it("does not flag pure Latin as mixed script", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("google.com");

      expect(result.heuristics.hasMixedScript).toBe(false);
      expect(result.heuristics.breakdown.mixedScript).toBe(0);
    });
  });

  describe("Threshold-based detection (score >= 30 = typosquat)", () => {
    it("flags domain when score >= threshold", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // g00gle: two 0s surrounded by letters = 30 pts
      const result = detector.checkDomain("g00gle.com");

      expect(result.heuristics.totalScore).toBeGreaterThanOrEqual(30);
      expect(result.isTyposquat).toBe(true);
    });

    it("does not flag domain when score < threshold", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("paypa1.com");

      expect(result.heuristics.totalScore).toBeLessThan(30);
      expect(result.isTyposquat).toBe(false);
    });

    it("respects lower custom threshold (flags more domains)", () => {
      const strictConfig: TyposquatConfig = {
        ...defaultConfig,
        heuristicThreshold: 10,
      };
      const detector = createTyposquatDetector(strictConfig, createMockCache());
      // paypa1.com = 15 pts, below default 30 but above custom 10
      const result = detector.checkDomain("paypa1.com");

      expect(result.isTyposquat).toBe(true);
    });

    it("respects high custom threshold (flags fewer domains)", () => {
      const lenientConfig: TyposquatConfig = {
        ...defaultConfig,
        heuristicThreshold: 90,
      };
      const detector = createTyposquatDetector(lenientConfig, createMockCache());
      const result = detector.checkDomain("g0ogle.com"); // 30 pts

      expect(result.isTyposquat).toBe(false);
    });
  });

  describe("Confidence levels", () => {
    it("returns 'high' confidence for score >= 70", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // аррlе.com: 4 Cyrillic chars (capped 50) + mixed script (40) = 90 pts
      const result = detector.checkDomain("\u0430\u0440\u0440l\u0435.com");

      expect(result.heuristics.totalScore).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBe("high");
    });

    it("returns 'medium' confidence for score 40-69", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Single Cyrillic in otherwise Latin domain: 25 (cyrillic) + 40 (mixed) = 65 pts
      const result = detector.checkDomain("exampl\u0435.com"); // Cyrillic е

      expect(result.heuristics.totalScore).toBeGreaterThanOrEqual(40);
      expect(result.heuristics.totalScore).toBeLessThan(70);
      expect(result.confidence).toBe("medium");
    });

    it("returns 'low' confidence for score 20-39", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("micr0soft.com"); // 30 pts

      expect(result.heuristics.totalScore).toBe(30);
      expect(result.confidence).toBe("low");
    });

    it("returns 'none' confidence for score < 20", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("example.com");

      expect(result.heuristics.totalScore).toBeLessThan(20);
      expect(result.confidence).toBe("none");
    });

    it("returns 'none' confidence for clean domains", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("microsoft.com");

      expect(result.confidence).toBe("none");
    });
  });

  describe("Clean domains that should NOT be flagged", () => {
    const legitimateDomains = [
      "google.com",
      "microsoft.com",
      "apple.com",
      "amazon.com",
      "github.com",
      "wikipedia.org",
      "youtube.com",
      "paypal.com",
      "stackoverflow.com",
    ];

    for (const domain of legitimateDomains) {
      it(`does not flag ${domain}`, () => {
        const detector = createTyposquatDetector(defaultConfig, createMockCache());
        const result = detector.checkDomain(domain);

        expect(result.isTyposquat).toBe(false);
      });
    }

    it("does not flag domains with numbers in legitimate positions (office365.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("office365.com");

      expect(result.isTyposquat).toBe(false);
    });

    it("does not flag domains with numbers at start (7eleven.com)", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("7eleven.com");

      expect(result.isTyposquat).toBe(false);
    });
  });

  describe("heuristics breakdown", () => {
    it("includes score breakdown", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("test.com");

      expect(result.heuristics.breakdown).toBeDefined();
      expect(typeof result.heuristics.breakdown.latinHomoglyphs).toBe("number");
      expect(typeof result.heuristics.breakdown.cyrillicHomoglyphs).toBe("number");
      expect(typeof result.heuristics.breakdown.greekHomoglyphs).toBe("number");
      expect(typeof result.heuristics.breakdown.japaneseHomoglyphs).toBe("number");
      expect(typeof result.heuristics.breakdown.mixedScript).toBe("number");
      expect(typeof result.heuristics.breakdown.punycode).toBe("number");
    });

    it("includes detected scripts", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("example.com");

      expect(Array.isArray(result.heuristics.detectedScripts)).toBe(true);
      expect(result.heuristics.detectedScripts).toContain("latin");
    });

    it("total score is capped at 100", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Multiple attack vectors should not exceed 100
      const result = detector.checkDomain("\u0430\u0440\u0440l\u0435.\u043Eom");

      expect(result.heuristics.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe("edge cases", () => {
    it("handles empty domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("");

      expect(result.domain).toBe("");
      expect(result.isTyposquat).toBe(false);
    });

    it("handles single character domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("a.co");

      expect(result.domain).toBe("a.co");
      expect(result.isTyposquat).toBe(false);
    });

    it("handles numeric domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("123.com");

      expect(result.domain).toBe("123.com");
    });

    it("handles subdomain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("sub.example.com");

      expect(result.domain).toBe("sub.example.com");
    });

    it("handles very long domain", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const longDomain = "a".repeat(60) + ".com";
      const result = detector.checkDomain(longDomain);

      expect(result.domain).toBe(longDomain);
      expect(result.isTyposquat).toBe(false);
    });

    it("handles domain with only TLD", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("a");

      expect(result.domain).toBe("a");
    });
  });
});

describe("determineConfidence boundary values (via mocked heuristics)", () => {
  function makeFakeScores(totalScore: number): TyposquatScores {
    return {
      homoglyphs: [],
      hasMixedScript: false,
      detectedScripts: ["latin"],
      isPunycode: false,
      totalScore,
      breakdown: {
        latinHomoglyphs: 0,
        cyrillicHomoglyphs: 0,
        greekHomoglyphs: 0,
        japaneseHomoglyphs: 0,
        mixedScript: 0,
        punycode: 0,
      },
    };
  }

  function testConfidenceAtScore(score: number, expectedConfidence: string) {
    const spy = vi.spyOn(heuristicsModule, "calculateTyposquatHeuristics").mockReturnValue(makeFakeScores(score));
    const cache = createMockCache();
    const detector = createTyposquatDetector(defaultConfig, cache);
    const result = detector.checkDomain("test-boundary.com");

    expect(result.heuristics.totalScore).toBe(score);
    expect(result.confidence).toBe(expectedConfidence);
    spy.mockRestore();
  }

  it("score exactly 70 returns 'high'", () => {
    testConfidenceAtScore(70, "high");
  });

  it("score exactly 69 returns 'medium' (not 'high')", () => {
    testConfidenceAtScore(69, "medium");
  });

  it("score exactly 40 returns 'medium'", () => {
    testConfidenceAtScore(40, "medium");
  });

  it("score exactly 39 returns 'low' (not 'medium')", () => {
    testConfidenceAtScore(39, "low");
  });

  it("score exactly 20 returns 'low'", () => {
    testConfidenceAtScore(20, "low");
  });

  it("score exactly 19 returns 'none' (not 'low')", () => {
    testConfidenceAtScore(19, "none");
  });
});

describe("determineConfidence", () => {
  it("assigns correct confidence levels", () => {
    const detector = createTyposquatDetector(defaultConfig, createMockCache());

    // Score >= 70 -> high
    // Score 40-69 -> medium
    // Score 20-39 -> low
    // Score < 20 -> none

    // Clean domain should have low score
    const cleanResult = detector.checkDomain("microsoft.com");
    expect(cleanResult.confidence).toBe("none");

    // We can't easily generate exact scores for other levels without knowing
    // the exact implementation, but we verify the function exists
  });

  it("high confidence requires score >= 70", () => {
    // аррlе.com: multiple Cyrillic + mixed script bonus = high confidence
    const detector = createTyposquatDetector(defaultConfig, createMockCache());
    const result = detector.checkDomain("\u0430\u0440\u0440l\u0435.com");

    expect(result.confidence).toBe("high");
    expect(result.heuristics.totalScore).toBeGreaterThanOrEqual(70);
  });

  it("low confidence for score in 20-39 range", () => {
    const detector = createTyposquatDetector(defaultConfig, createMockCache());
    // micr0soft.com: 30 pts (surrounded digit)
    const result = detector.checkDomain("micr0soft.com");

    expect(result.heuristics.totalScore).toBe(30);
    expect(result.confidence).toBe("low");
  });
});
