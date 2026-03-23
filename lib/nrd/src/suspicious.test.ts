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
});
