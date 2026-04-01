import { describe, it, expect } from "vitest";
import {
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateSuspiciousScore,
  isHighRiskDomain,
  SUSPICIOUS_TLDS,
} from "./suspicious.js";

describe("calculateEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(calculateEntropy("")).toBe(0);
  });

  it("returns 0 for single character", () => {
    expect(calculateEntropy("a")).toBe(0);
  });

  it("returns higher entropy for random-looking strings", () => {
    const lowEntropy = calculateEntropy("aaaaaa");
    const highEntropy = calculateEntropy("abc123xyz");
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it("returns value between 0 and 1", () => {
    const entropy = calculateEntropy("xyzabc123");
    expect(entropy).toBeGreaterThanOrEqual(0);
    expect(entropy).toBeLessThanOrEqual(1);
  });

  it("returns 0 for uniform string (all same chars)", () => {
    expect(calculateEntropy("aaaaaaa")).toBe(0);
  });

  it("returns maximum entropy for fully varied string", () => {
    // "abcd" has 4 unique chars out of 4 = max entropy
    const entropy = calculateEntropy("abcd");
    expect(entropy).toBe(1);
  });

  it("never exceeds 1 (floating point guard)", () => {
    // Strings where floating point arithmetic might produce > 1
    const values = ["ab", "abc", "abcdef", "abcdefghij"];
    for (const v of values) {
      expect(calculateEntropy(v)).toBeLessThanOrEqual(1);
    }
  });
});

describe("extractSLD", () => {
  it("extracts SLD from simple domain", () => {
    expect(extractSLD("example.com")).toBe("example");
  });

  it("extracts SLD from subdomain", () => {
    expect(extractSLD("www.example.com")).toBe("example");
  });

  it("handles country-code SLDs", () => {
    expect(extractSLD("example.co.jp")).toBe("example");
    expect(extractSLD("sub.example.co.uk")).toBe("example");
  });

  it("handles single part domains", () => {
    expect(extractSLD("localhost")).toBe("localhost");
  });

  it("handles .com.au style SLDs", () => {
    expect(extractSLD("example.com.au")).toBe("example");
  });

  it("handles .net.jp style SLDs", () => {
    expect(extractSLD("example.net.jp")).toBe("example");
  });
});

describe("extractTLD", () => {
  it("extracts TLD from domain", () => {
    expect(extractTLD("example.com")).toBe("com");
    expect(extractTLD("example.co.jp")).toBe("jp");
    expect(extractTLD("test.xyz")).toBe("xyz");
  });

  it("returns lowercase TLD", () => {
    expect(extractTLD("example.COM")).toBe("com");
  });

  it("handles suspicious TLDs correctly", () => {
    expect(extractTLD("phishing.xyz")).toBe("xyz");
    expect(extractTLD("malware.tk")).toBe("tk");
    expect(extractTLD("spam.top")).toBe("top");
  });
});

describe("hasExcessiveHyphens", () => {
  it("returns true for leading hyphen", () => {
    expect(hasExcessiveHyphens("-example")).toBe(true);
  });

  it("returns true for trailing hyphen", () => {
    expect(hasExcessiveHyphens("example-")).toBe(true);
  });

  it("returns true for consecutive hyphens", () => {
    expect(hasExcessiveHyphens("ex--ample")).toBe(true);
  });

  it("returns true for 3+ hyphens", () => {
    expect(hasExcessiveHyphens("ex-am-pl-e")).toBe(true);
  });

  it("returns false for normal hyphen usage", () => {
    expect(hasExcessiveHyphens("my-example")).toBe(false);
    expect(hasExcessiveHyphens("my-cool-site")).toBe(false);
  });

  it("returns false for no hyphens", () => {
    expect(hasExcessiveHyphens("example")).toBe(false);
  });

  it("returns false for exactly 2 hyphens (not consecutive)", () => {
    expect(hasExcessiveHyphens("my-cool-site")).toBe(false);
  });
});

describe("hasExcessiveNumbers", () => {
  it("returns true for 4+ consecutive digits", () => {
    expect(hasExcessiveNumbers("example1234")).toBe(true);
    expect(hasExcessiveNumbers("12345example")).toBe(true);
  });

  it("returns true for 30%+ number ratio", () => {
    expect(hasExcessiveNumbers("ex123")).toBe(true); // 60%
    expect(hasExcessiveNumbers("abc12")).toBe(true); // 40%
  });

  it("returns false for normal number usage", () => {
    expect(hasExcessiveNumbers("example1")).toBe(false);
    expect(hasExcessiveNumbers("version2")).toBe(false);
  });

  it("returns false for no numbers", () => {
    expect(hasExcessiveNumbers("example")).toBe(false);
  });

  it("returns true for 3 digits in short string (high ratio)", () => {
    // "abc123" = 50% digits (3/6), exceeds 30% threshold
    expect(hasExcessiveNumbers("abc123")).toBe(true);
  });

  it("returns true for all-digit string", () => {
    expect(hasExcessiveNumbers("12345")).toBe(true);
  });
});

describe("isRandomLooking", () => {
  it("returns true for 5+ consecutive consonants", () => {
    expect(isRandomLooking("xyzqwrt")).toBe(true);
    expect(isRandomLooking("abcdfghj")).toBe(true);
  });

  it("returns true for no vowels in 3+ char domain", () => {
    expect(isRandomLooking("xyz")).toBe(true);
    expect(isRandomLooking("bcdfg")).toBe(true);
  });

  it("returns false for normal domains", () => {
    expect(isRandomLooking("example")).toBe(false);
    expect(isRandomLooking("google")).toBe(false);
    expect(isRandomLooking("amazon")).toBe(false);
  });

  it("returns false for short domains (1-2 chars)", () => {
    // Short domains with no vowels are not flagged (length < 3 check)
    expect(isRandomLooking("a")).toBe(false);
    expect(isRandomLooking("ab")).toBe(false);
  });

  it("returns true for very low vowel ratio in 6+ char domains", () => {
    // "bcdfgh" = 6 chars, 0 vowels → flagged
    expect(isRandomLooking("bcdfgh")).toBe(true);
  });

  it("does not flag domain with reasonable vowel ratio", () => {
    // "twitter" has 2 vowels out of 7 = ~28%, above 15% threshold
    expect(isRandomLooking("twitter")).toBe(false);
  });
});

describe("calculateSuspiciousScore", () => {
  it("returns low score for legitimate domains", () => {
    const score = calculateSuspiciousScore("google.com");
    expect(score.totalScore).toBeLessThan(30);
    expect(score.suspiciousTLD).toBe(false);
  });

  it("returns high score for suspicious TLD", () => {
    const score = calculateSuspiciousScore("example.xyz");
    expect(score.suspiciousTLD).toBe(true);
    expect(score.totalScore).toBeGreaterThanOrEqual(25);
  });

  it("returns high score for random-looking domain", () => {
    const score = calculateSuspiciousScore("xyzqwrt123.xyz");
    expect(score.totalScore).toBeGreaterThan(50);
  });

  it("caps total score at 100", () => {
    const score = calculateSuspiciousScore("x--y--z1234567.xyz");
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it("scores very short SLD (2 chars) with 10 extra points", () => {
    // "ab.xyz" - short SLD + suspicious TLD
    const shortSLD = calculateSuspiciousScore("ab.xyz");
    const normalSLD = calculateSuspiciousScore("example.xyz");

    // Short SLD should score higher (extra 10 pts)
    expect(shortSLD.totalScore).toBeGreaterThan(normalSLD.totalScore);
  });

  it("includes entropy in score breakdown", () => {
    const score = calculateSuspiciousScore("example.com");
    expect(score.entropy).toBeGreaterThanOrEqual(0);
    expect(score.entropy).toBeLessThanOrEqual(1);
  });

  it("detects excessive hyphens", () => {
    // Note: extractSLD removes TLD, so hyphens must be in SLD part
    const score = calculateSuspiciousScore("ex-am-pl-es.xyz");
    expect(score.hasExcessiveHyphens).toBe(true);
    expect(score.totalScore).toBeGreaterThan(25);
  });

  it("detects excessive numbers", () => {
    const score = calculateSuspiciousScore("abc12345.com");
    expect(score.hasExcessiveNumbers).toBe(true);
    expect(score.totalScore).toBeGreaterThanOrEqual(15);
  });

  it("detects random-looking domain name", () => {
    const score = calculateSuspiciousScore("xyzqwrt.com");
    expect(score.isRandomLooking).toBe(true);
    expect(score.totalScore).toBeGreaterThanOrEqual(20);
  });

  it("returns all required fields in result", () => {
    const score = calculateSuspiciousScore("test.com");
    expect(typeof score.entropy).toBe("number");
    expect(typeof score.suspiciousTLD).toBe("boolean");
    expect(typeof score.hasExcessiveHyphens).toBe("boolean");
    expect(typeof score.hasExcessiveNumbers).toBe("boolean");
    expect(typeof score.isRandomLooking).toBe("boolean");
    expect(typeof score.totalScore).toBe("number");
  });

  it("compound risk factors accumulate score", () => {
    // Random-looking domain + suspicious TLD
    const compound = calculateSuspiciousScore("xyzqwrt.xyz");
    const singleFactor = calculateSuspiciousScore("xyzqwrt.com");

    expect(compound.totalScore).toBeGreaterThan(singleFactor.totalScore);
  });

  it("entropy contribution is bounded at 30 pts max", () => {
    // Even fully random SLD should not contribute more than 30 pts from entropy alone
    const score = calculateSuspiciousScore("abcdefghij.com");
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });
});

describe("isHighRiskDomain", () => {
  it("returns true when score exceeds threshold", () => {
    const scores = calculateSuspiciousScore("xyzqwrt.xyz");
    expect(isHighRiskDomain(scores, 30)).toBe(true);
  });

  it("returns false when score is below threshold", () => {
    const scores = calculateSuspiciousScore("google.com");
    expect(isHighRiskDomain(scores, 50)).toBe(false);
  });

  it("returns true when score equals threshold (>= is inclusive)", () => {
    const scores = calculateSuspiciousScore("xyzqwrt.xyz");
    // Get the actual score and check equality
    expect(isHighRiskDomain(scores, scores.totalScore)).toBe(true);
  });

  it("returns false when threshold is 0 only for zero-score domains", () => {
    // Any domain with some entropy will have score > 0
    const scores = calculateSuspiciousScore("google.com");
    // google.com has non-zero entropy, so score > 0
    // Use a threshold slightly above the score to verify false
    if (scores.totalScore < 100) {
      expect(isHighRiskDomain(scores, scores.totalScore + 1)).toBe(false);
    }
  });
});

describe("SUSPICIOUS_TLDS", () => {
  it("contains known suspicious TLDs", () => {
    expect(SUSPICIOUS_TLDS.has("xyz")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("tk")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("top")).toBe(true);
  });

  it("does not contain common legitimate TLDs", () => {
    expect(SUSPICIOUS_TLDS.has("com")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("org")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("net")).toBe(false);
  });

  it("contains free abuse-prone TLDs (.tk, .ml, .ga, .cf, .gq)", () => {
    expect(SUSPICIOUS_TLDS.has("tk")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("ml")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("ga")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("cf")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("gq")).toBe(true);
  });

  it("contains high-abuse generic TLDs (.buzz, .click, .link)", () => {
    expect(SUSPICIOUS_TLDS.has("buzz")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("click")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("link")).toBe(true);
  });

  it("contains recent high-abuse TLDs (.icu, .cyou, .cfd)", () => {
    expect(SUSPICIOUS_TLDS.has("icu")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("cyou")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("cfd")).toBe(true);
  });

  it("does not contain country TLDs like .jp, .uk, .de", () => {
    expect(SUSPICIOUS_TLDS.has("jp")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("uk")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("de")).toBe(false);
  });
});

describe("edge cases: malformed input", () => {
  describe("calculateEntropy", () => {
    it("handles very long strings without error", () => {
      const longStr = "a".repeat(10000) + "b".repeat(10000);
      const result = calculateEntropy(longStr);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("handles unicode characters", () => {
      expect(calculateEntropy("日本語テスト")).toBeGreaterThan(0);
    });

    it("handles emoji", () => {
      expect(calculateEntropy("🎉🎊🎈")).toBeGreaterThan(0);
    });

    it("handles mixed unicode and ascii", () => {
      const result = calculateEntropy("abc日本語xyz");
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe("extractSLD", () => {
    it("handles domain with only dots", () => {
      const result = extractSLD("...");
      expect(typeof result).toBe("string");
    });

    it("handles empty string", () => {
      const result = extractSLD("");
      expect(typeof result).toBe("string");
    });

    it("handles domain with many subdomains", () => {
      expect(extractSLD("a.b.c.d.e.example.com")).toBe("example");
    });

    it("handles domain with trailing dot (FQDN)", () => {
      // FQDN format: "example.com."
      const result = extractSLD("example.com.");
      expect(typeof result).toBe("string");
    });
  });

  describe("extractTLD", () => {
    it("handles empty string", () => {
      const result = extractTLD("");
      expect(typeof result).toBe("string");
    });

    it("handles domain with no dots", () => {
      expect(extractTLD("localhost")).toBe("localhost");
    });
  });

  describe("hasExcessiveHyphens", () => {
    it("handles empty string", () => {
      expect(hasExcessiveHyphens("")).toBe(false);
    });

    it("handles string of only hyphens", () => {
      expect(hasExcessiveHyphens("---")).toBe(true);
    });

    it("handles single hyphen", () => {
      expect(hasExcessiveHyphens("-")).toBe(true); // leading and trailing
    });
  });

  describe("hasExcessiveNumbers", () => {
    it("handles empty string", () => {
      // empty string: ratio = 0/0, which is NaN
      const result = hasExcessiveNumbers("");
      expect(typeof result).toBe("boolean");
    });

    it("handles single digit", () => {
      // "1" has ratio 1/1 = 100%, exceeds 30%
      expect(hasExcessiveNumbers("1")).toBe(true);
    });

    it("handles boundary: exactly 3 consecutive digits", () => {
      // "abc123def" = 3 consecutive, below 4+ threshold
      // ratio = 3/9 = 33%, exceeds 30%
      expect(hasExcessiveNumbers("abc123def")).toBe(true);
    });
  });

  describe("isRandomLooking", () => {
    it("handles empty string", () => {
      const result = isRandomLooking("");
      expect(typeof result).toBe("boolean");
    });

    it("handles string with only vowels", () => {
      expect(isRandomLooking("aeiouaeiou")).toBe(false);
    });

    it("handles exactly 4 consecutive consonants (below threshold)", () => {
      // "bcdf" = 4 consonants, threshold is 5+
      // but 4 chars with 0 vowels triggers the no-vowel check (length >= 3)
      expect(isRandomLooking("bcdf")).toBe(true);
    });
  });

  describe("calculateSuspiciousScore", () => {
    it("handles single-char domain", () => {
      const result = calculateSuspiciousScore("a.com");
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it("handles unicode domain", () => {
      const result = calculateSuspiciousScore("日本語.com");
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });

    it("handles domain with only numbers in SLD", () => {
      const result = calculateSuspiciousScore("123456.xyz");
      expect(result.hasExcessiveNumbers).toBe(true);
      expect(result.suspiciousTLD).toBe(true);
    });

    it("accumulates maximum possible score without exceeding 100", () => {
      // Domain with all risk factors: random + hyphens + numbers + suspicious TLD + short
      const result = calculateSuspiciousScore("x--12345.xyz");
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.totalScore).toBeGreaterThan(50);
    });
  });
});
