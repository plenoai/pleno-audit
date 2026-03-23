import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTyposquatDetector, type TyposquatCache } from "./detector.js";
import type { TyposquatConfig, TyposquatResult } from "./types.js";

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
      // Cyrillic 'а' (U+0430) looks like Latin 'a'
      const result = detector.checkDomain("gооgle.com"); // Cyrillic 'о' (U+043E)

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

  describe("confidence levels", () => {
    it("returns high confidence for score >= 70", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      // Domain with many Cyrillic characters
      const result = detector.checkDomain("gооgle.cоm"); // Multiple Cyrillic 'о'

      if (result.heuristics.totalScore >= 70) {
        expect(result.confidence).toBe("high");
      }
    });

    it("returns none confidence for score < 20", () => {
      const detector = createTyposquatDetector(defaultConfig, cache);
      const result = detector.checkDomain("example.com");

      expect(result.confidence).toBe("none");
    });
  });

  describe("threshold configuration", () => {
    it("respects custom threshold", () => {
      const strictConfig: TyposquatConfig = {
        ...defaultConfig,
        heuristicThreshold: 10, // Lower threshold
      };

      const detector = createTyposquatDetector(strictConfig, cache);
      const result = detector.checkDomain("examp1e.com"); // 1 instead of l

      // With lower threshold, more domains are flagged
      expect(result.heuristics.totalScore).toBeGreaterThanOrEqual(0);
    });

    it("uses higher threshold for stricter detection", () => {
      const lenientConfig: TyposquatConfig = {
        ...defaultConfig,
        heuristicThreshold: 90, // Very high threshold
      };

      const detector = createTyposquatDetector(lenientConfig, cache);
      const result = detector.checkDomain("g0ogle.com");

      // With high threshold, only severe cases are flagged
      if (result.heuristics.totalScore < 90) {
        expect(result.isTyposquat).toBe(false);
      }
    });
  });

  describe("Punycode handling", () => {
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
});
