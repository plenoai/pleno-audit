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

  it("returns 0 for single character (maxEntropy is 0, guard branch)", () => {
    // Math.log2(1) === 0, so maxEntropy > 0 is false, returns 0
    expect(calculateEntropy("a")).toBe(0);
  });

  it("returns 0 for uniform string (all same chars)", () => {
    // All identical chars -> Shannon entropy is 0, 0/maxEntropy = 0
    expect(calculateEntropy("aaaaaaa")).toBe(0);
  });

  it("returns exactly 1 for maximally varied string", () => {
    // "abcd" has 4 unique chars out of 4 = max entropy, normalized = 1
    expect(calculateEntropy("abcd")).toBe(1);
  });

  it("returns exactly 1 for two distinct chars", () => {
    // "ab": entropy = 1 bit, maxEntropy = log2(2) = 1 bit, ratio = 1
    expect(calculateEntropy("ab")).toBe(1);
  });

  it("uses Math.min to cap at 1 (floating point guard)", () => {
    // Various strings should never exceed 1
    const values = ["ab", "abc", "abcdef", "abcdefghij"];
    for (const v of values) {
      expect(calculateEntropy(v)).toBeLessThanOrEqual(1);
    }
  });

  it("returns higher entropy for random-looking strings", () => {
    const lowEntropy = calculateEntropy("aaaaaa");
    const highEntropy = calculateEntropy("abc123xyz");
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it("computes correct normalized entropy for 'google'", () => {
    // 'google' has chars: g(2), o(2), l(1), e(1) in 6 chars
    // p(g)=2/6, p(o)=2/6, p(l)=1/6, p(e)=1/6
    // entropy = -2*(2/6*log2(2/6)) - 2*(1/6*log2(1/6))
    // maxEntropy = log2(6)
    const result = calculateEntropy("google");
    expect(result).toBeCloseTo(0.7420981285103055, 10);
  });

  it("computes correct normalized entropy for 'example'", () => {
    const result = calculateEntropy("example");
    expect(result).toBeCloseTo(0.8982265179691366, 10);
  });

  it("handles unicode characters", () => {
    expect(calculateEntropy("日本語テスト")).toBeGreaterThan(0);
  });

  it("handles very long strings", () => {
    const longStr = "a".repeat(10000) + "b".repeat(10000);
    const result = calculateEntropy(longStr);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("accumulates frequency correctly via (freq[char] || 0) + 1", () => {
    // "aab": a=2, b=1. Verify by computing exact entropy.
    // p(a)=2/3, p(b)=1/3
    // entropy = -(2/3*log2(2/3) + 1/3*log2(1/3))
    // maxEntropy = log2(3)
    const expected =
      -(2 / 3) * Math.log2(2 / 3) - (1 / 3) * Math.log2(1 / 3);
    const maxEntropy = Math.log2(3);
    expect(calculateEntropy("aab")).toBeCloseTo(expected / maxEntropy, 10);
  });
});

describe("extractSLD", () => {
  it("extracts SLD from simple domain", () => {
    expect(extractSLD("example.com")).toBe("example");
  });

  it("extracts SLD from subdomain", () => {
    expect(extractSLD("www.example.com")).toBe("example");
  });

  it("handles country-code SLDs (co.jp, co.uk)", () => {
    expect(extractSLD("example.co.jp")).toBe("example");
    expect(extractSLD("sub.example.co.uk")).toBe("example");
  });

  it("handles .com.au style SLDs", () => {
    expect(extractSLD("example.com.au")).toBe("example");
  });

  it("handles .net.jp style SLDs", () => {
    expect(extractSLD("example.net.jp")).toBe("example");
  });

  it("handles single part domains", () => {
    expect(extractSLD("localhost")).toBe("localhost");
  });

  it("handles domain with many subdomains", () => {
    expect(extractSLD("a.b.c.d.e.example.com")).toBe("example");
  });

  it("ccSLD length boundary: length 3 is treated as ccSLD candidate", () => {
    // 'com' has length 3 <= 3 AND is in ccSLDs -> treated as ccSLD
    expect(extractSLD("example.com.au")).toBe("example");
    // 'net' has length 3 <= 3 AND is in ccSLDs -> treated as ccSLD
    expect(extractSLD("example.net.jp")).toBe("example");
    // 'org' has length 3 <= 3 AND is in ccSLDs -> treated as ccSLD
    expect(extractSLD("example.org.uk")).toBe("example");
  });

  it("ccSLD length boundary: length 4 is NOT treated as ccSLD", () => {
    // 'info' has length 4 > 3 -> NOT treated as ccSLD
    // So extractSLD('example.info.jp') returns 'info' (parts[-2])
    expect(extractSLD("example.info.jp")).toBe("info");
  });

  it("length <= 3 but NOT in ccSLDs list is not treated as ccSLD", () => {
    // 'foo' has length 3 <= 3 but 'foo' is NOT in ccSLDs
    // So it falls through to else: returns parts[-2] = 'foo'
    expect(extractSLD("example.foo.jp")).toBe("foo");
  });

  it("ccSLD with only 2 parts returns parts[0]", () => {
    // 'co.jp' has parts ['co', 'jp'], lastTwo=['co','jp']
    // 'co' length 2 <= 3 AND in ccSLDs -> parts.length (2) < 3 -> return parts[0] = 'co'
    expect(extractSLD("co.jp")).toBe("co");
  });

  it("handles domain with only dots", () => {
    const result = extractSLD("...");
    expect(typeof result).toBe("string");
  });

  it("handles empty string", () => {
    const result = extractSLD("");
    expect(typeof result).toBe("string");
  });

  it("handles each recognized ccSLD", () => {
    // All ccSLDs in the list: co, com, net, org, gov, edu, ac, go
    for (const ccSLD of ["co", "com", "net", "org", "gov", "edu", "ac", "go"]) {
      expect(extractSLD(`example.${ccSLD}.jp`)).toBe("example");
    }
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
    expect(extractTLD("example.XyZ")).toBe("xyz");
  });

  it("handles domain with no dots", () => {
    expect(extractTLD("localhost")).toBe("localhost");
  });

  it("handles empty string", () => {
    const result = extractTLD("");
    expect(typeof result).toBe("string");
  });
});

describe("hasExcessiveHyphens", () => {
  it("returns true for leading hyphen", () => {
    expect(hasExcessiveHyphens("-example")).toBe(true);
  });

  it("returns true for trailing hyphen", () => {
    expect(hasExcessiveHyphens("example-")).toBe(true);
  });

  it("returns true for consecutive hyphens (--)", () => {
    expect(hasExcessiveHyphens("ex--ample")).toBe(true);
  });

  it("returns true for exactly 3 hyphens (boundary: >= 3)", () => {
    // 3 hyphens, none leading/trailing, no consecutive
    expect(hasExcessiveHyphens("a-b-c-d")).toBe(true);
  });

  it("returns false for exactly 2 hyphens (boundary: < 3)", () => {
    // 2 hyphens, none leading/trailing, no consecutive
    expect(hasExcessiveHyphens("a-b-c")).toBe(false);
  });

  it("returns false for exactly 1 hyphen", () => {
    expect(hasExcessiveHyphens("my-example")).toBe(false);
  });

  it("returns false for no hyphens", () => {
    expect(hasExcessiveHyphens("example")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasExcessiveHyphens("")).toBe(false);
  });

  it("returns true for string of only hyphens", () => {
    expect(hasExcessiveHyphens("---")).toBe(true);
  });

  it("returns true for single hyphen (both leading and trailing)", () => {
    expect(hasExcessiveHyphens("-")).toBe(true);
  });

  it("returns true for 4+ hyphens", () => {
    expect(hasExcessiveHyphens("a-b-c-d-e")).toBe(true);
  });
});

describe("hasExcessiveNumbers", () => {
  it("returns true for exactly 4 consecutive digits (boundary: \\d{4,})", () => {
    expect(hasExcessiveNumbers("abcdefg1234")).toBe(true);
  });

  it("returns false for exactly 3 consecutive digits with ratio < 0.3", () => {
    // 'abcdefghij123' = 3 consecutive digits, ratio 3/13 ≈ 0.23 < 0.3
    expect(hasExcessiveNumbers("abcdefghij123")).toBe(false);
  });

  it("returns true for ratio exactly at 0.3 (boundary: >= 0.3)", () => {
    // 'abcdefg123' = 3 digits in 10 chars = 0.3 exactly, >= 0.3 -> true
    expect(hasExcessiveNumbers("abcdefg123")).toBe(true);
  });

  it("returns false for ratio just below 0.3", () => {
    // 'abcdefgh12' = 2 digits in 10 chars = 0.2 < 0.3
    expect(hasExcessiveNumbers("abcdefgh12")).toBe(false);
  });

  it("returns true for 5+ consecutive digits", () => {
    expect(hasExcessiveNumbers("12345example")).toBe(true);
  });

  it("returns false for normal number usage", () => {
    expect(hasExcessiveNumbers("example1")).toBe(false);
    expect(hasExcessiveNumbers("version2")).toBe(false);
  });

  it("returns false for no numbers", () => {
    expect(hasExcessiveNumbers("example")).toBe(false);
  });

  it("returns true for all-digit string", () => {
    expect(hasExcessiveNumbers("12345")).toBe(true);
  });

  it("returns true for single digit (ratio 1.0 >= 0.3)", () => {
    expect(hasExcessiveNumbers("1")).toBe(true);
  });

  it("handles empty string", () => {
    const result = hasExcessiveNumbers("");
    expect(typeof result).toBe("boolean");
  });

  it("uses (match || []).length pattern for null-safe counting", () => {
    // A string with no digits returns null from match, fallback to []
    expect(hasExcessiveNumbers("abcdefghij")).toBe(false);
  });
});

describe("isRandomLooking", () => {
  it("returns true for exactly 5 consecutive consonants (boundary: {5,})", () => {
    // 'bcdfga' has 'bcdfg' = 5 consecutive consonants
    expect(isRandomLooking("bcdfga")).toBe(true);
  });

  it("returns false for exactly 4 consecutive consonants (below 5 threshold)", () => {
    // 'bcdfa' has 'bcdf' = 4 consecutive consonants, 1 vowel 'a'
    // length 5 >= 3, vowelCount 1 > 0, ratio 1/5=0.2 but length < 6
    expect(isRandomLooking("bcdfa")).toBe(false);
  });

  it("returns true for no vowels in 3+ char domain (vowelCount === 0)", () => {
    expect(isRandomLooking("xyz")).toBe(true);
    expect(isRandomLooking("bcd")).toBe(true);
  });

  it("returns false for 2-char domain with no vowels (length < 3)", () => {
    // 'bc' length 2 < 3, skip the >= 3 block entirely
    expect(isRandomLooking("bc")).toBe(false);
  });

  it("returns false for 1-char domain", () => {
    expect(isRandomLooking("b")).toBe(false);
  });

  it("boundary: length exactly 3 triggers zero-vowel check", () => {
    // length 3 >= 3, zero vowels -> true
    expect(isRandomLooking("bcd")).toBe(true);
    // length 3, has vowel -> false (no 5-consecutive, ratio check needs length >= 6)
    expect(isRandomLooking("abc")).toBe(false);
  });

  it("boundary: length exactly 6 triggers vowel ratio check", () => {
    // 'b1c1da' = 6 chars, 1 vowel, ratio 1/6=0.1666 >= 0.15 -> false
    expect(isRandomLooking("b1c1da")).toBe(false);
    // 'b1c1d1' = 6 chars, 0 vowels -> true (via zero-vowel check, not ratio)
    expect(isRandomLooking("b1c1d1")).toBe(true);
  });

  it("boundary: length 5 does NOT trigger vowel ratio check even with low ratio", () => {
    // 'bcdfa' = 5 chars, 1 vowel, ratio 0.2. Length 5 < 6, ratio check NOT applied.
    // No 5-consecutive consonants (bcdf=4). vowelCount=1>0. -> false
    expect(isRandomLooking("bcdfa")).toBe(false);
  });

  it("vowel ratio boundary: 1/7 < 0.15 -> random (length >= 6)", () => {
    // 'b1c1d1a' = 7 chars, 1 vowel 'a', ratio 1/7 ≈ 0.143 < 0.15
    // No 5-consecutive consonants (digits break chain). length >= 6 -> true
    expect(isRandomLooking("b1c1d1a")).toBe(true);
  });

  it("vowel ratio boundary: 1/6 >= 0.15 -> NOT random (length >= 6)", () => {
    // 'b1c1da' = 6 chars, 1 vowel 'a', ratio 1/6 ≈ 0.167 >= 0.15
    // No 5-consecutive consonants. vowelCount>0. -> false
    expect(isRandomLooking("b1c1da")).toBe(false);
  });

  it("returns false for normal domains", () => {
    expect(isRandomLooking("example")).toBe(false);
    expect(isRandomLooking("google")).toBe(false);
    expect(isRandomLooking("amazon")).toBe(false);
  });

  it("returns false for all vowels", () => {
    expect(isRandomLooking("aeiouaeiou")).toBe(false);
  });

  it("handles empty string", () => {
    expect(isRandomLooking("")).toBe(false);
  });
});

describe("calculateSuspiciousScore", () => {
  it("entropy contribution is exactly Math.min(entropy * 40, 30)", () => {
    // 'google.com' - only entropy contributes (no other factors)
    // google entropy = 0.7420981285103055, * 40 = 29.683..., min(29.683, 30) = 29.683
    // SLD 'google' length 6 > 2, no hyphens, no numbers, not random
    const score = calculateSuspiciousScore("google.com");
    const expectedEntropy = calculateEntropy("google");
    const expectedContrib = Math.min(expectedEntropy * 40, 30);
    expect(score.totalScore).toBeCloseTo(expectedContrib, 10);
    expect(score.suspiciousTLD).toBe(false);
    expect(score.hasExcessiveHyphens).toBe(false);
    expect(score.hasExcessiveNumbers).toBe(false);
    expect(score.isRandomLooking).toBe(false);
  });

  it("entropy cap at 30: high entropy * 40 > 30 is capped", () => {
    // 'abcdefghij' has entropy 1.0, * 40 = 40, capped at 30
    // No other factors (normal chars, .com TLD, length > 2)
    const score = calculateSuspiciousScore("abcdefghij.com");
    expect(score.entropy).toBe(1);
    // Score should be exactly 30 (capped), not 40
    expect(score.totalScore).toBe(30);
  });

  it("entropy below cap: entropy * 40 < 30 is not capped", () => {
    // 'aaa' has entropy 0, * 40 = 0
    const score = calculateSuspiciousScore("aaa.com");
    expect(score.entropy).toBe(0);
    // Only factor: no others triggered. Total should be 0.
    expect(score.totalScore).toBe(0);
  });

  it("suspiciousTLD adds exactly 25 points", () => {
    // Compare same SLD with suspicious vs non-suspicious TLD
    const withSuspicious = calculateSuspiciousScore("google.xyz");
    const withoutSuspicious = calculateSuspiciousScore("google.com");
    expect(withSuspicious.suspiciousTLD).toBe(true);
    expect(withoutSuspicious.suspiciousTLD).toBe(false);
    expect(withSuspicious.totalScore - withoutSuspicious.totalScore).toBe(25);
  });

  it("excessive hyphens adds exactly 15 points", () => {
    // 'one-two-thr-ee' has 3 hyphens, vowels present, not random
    // Compare with 'one-two-three' which has 2 hyphens
    const with3 = calculateSuspiciousScore("one-two-thr-ee.com");
    const with2 = calculateSuspiciousScore("one-two-three.com");
    expect(with3.hasExcessiveHyphens).toBe(true);
    expect(with2.hasExcessiveHyphens).toBe(false);
    // Difference should be exactly 15 (plus any entropy difference)
    const entropyDiff =
      Math.min(calculateEntropy("one-two-thr-ee") * 40, 30) -
      Math.min(calculateEntropy("one-two-three") * 40, 30);
    expect(with3.totalScore - with2.totalScore).toBeCloseTo(15 + entropyDiff, 10);
  });

  it("excessive numbers adds exactly 15 points", () => {
    // Use domains where only numbers factor differs
    // 'abcdefg1234.com' has excessive numbers (4 consecutive digits)
    // 'abcdefg1.com' does not
    const withNumbers = calculateSuspiciousScore("abcdefg1234.com");
    const withoutNumbers = calculateSuspiciousScore("abcdefghij1.com");
    expect(withNumbers.hasExcessiveNumbers).toBe(true);
    expect(withoutNumbers.hasExcessiveNumbers).toBe(false);
    // Account for entropy difference
    const entropyDiff =
      Math.min(calculateEntropy("abcdefg1234") * 40, 30) -
      Math.min(calculateEntropy("abcdefghij1") * 40, 30);
    expect(withNumbers.totalScore - withoutNumbers.totalScore).toBeCloseTo(
      15 + entropyDiff,
      10
    );
  });

  it("random looking adds exactly 20 points", () => {
    // 'xyzqwrt.com' is random-looking (5+ consecutive consonants)
    const score = calculateSuspiciousScore("xyzqwrt.com");
    expect(score.isRandomLooking).toBe(true);
    const entropyContrib = Math.min(calculateEntropy("xyzqwrt") * 40, 30);
    expect(score.totalScore).toBeCloseTo(entropyContrib + 20, 10);
  });

  it("short SLD (length <= 2) adds exactly 10 points", () => {
    // 'aa.com' has entropy 0, SLD length 2 -> only short SLD factor
    const score = calculateSuspiciousScore("aa.com");
    expect(score.entropy).toBe(0);
    expect(score.totalScore).toBe(10);
  });

  it("short SLD boundary: length 2 gets 10 pts, length 3 does not", () => {
    // 'aa.com': SLD 'aa', length 2, entropy 0 -> score 10
    const short = calculateSuspiciousScore("aa.com");
    expect(short.totalScore).toBe(10);

    // 'aaa.com': SLD 'aaa', length 3, entropy 0 -> score 0
    const notShort = calculateSuspiciousScore("aaa.com");
    expect(notShort.totalScore).toBe(0);
  });

  it("short SLD with high entropy: ab.com", () => {
    // 'ab' has entropy 1.0, contrib = min(40, 30) = 30. Short SLD = 10. Total = 40.
    const score = calculateSuspiciousScore("ab.com");
    expect(score.totalScore).toBe(40);
  });

  it("caps total score at 100 via Math.min(score, 100)", () => {
    // Domain with ALL risk factors to exceed 100 raw
    // entropy max 30 + suspiciousTLD 25 + hyphens 15 + numbers 15 + random 20 + short 10 = 115
    // Should be capped at 100
    const score = calculateSuspiciousScore("x--12345.xyz");
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it("score does not exceed 100 even when all factors fire", () => {
    // Construct domain: short SLD, suspicious TLD, hyphens, numbers, random
    // '-1.xyz' -> SLD is '-1', leading hyphen, has digit, short, suspicious TLD
    const score = calculateSuspiciousScore("-1.xyz");
    expect(score.totalScore).toBeLessThanOrEqual(100);
    // Verify multiple factors triggered
    expect(score.suspiciousTLD).toBe(true);
    expect(score.hasExcessiveHyphens).toBe(true);
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

  it("compound risk factors accumulate additively", () => {
    // 'xyzqwrt.xyz' = entropy + suspiciousTLD + randomLooking
    const compound = calculateSuspiciousScore("xyzqwrt.xyz");
    const entropyContrib = Math.min(calculateEntropy("xyzqwrt") * 40, 30);
    expect(compound.totalScore).toBeCloseTo(entropyContrib + 25 + 20, 10);
  });

  it("single-char domain scores correctly", () => {
    // 'a.com' -> SLD 'a', length 1, entropy 0 (single char)
    // Short SLD (1 <= 2) = 10. Total = 10.
    const score = calculateSuspiciousScore("a.com");
    expect(score.entropy).toBe(0);
    expect(score.totalScore).toBe(10);
  });

  it("uses extractSLD correctly for ccSLD domains", () => {
    const score = calculateSuspiciousScore("example.co.jp");
    // SLD should be 'example', not 'co'
    expect(score.entropy).toBe(calculateEntropy("example"));
  });

  it("uses extractTLD correctly (last part)", () => {
    // 'example.co.jp' -> TLD is 'jp', not suspicious
    const score = calculateSuspiciousScore("example.co.jp");
    expect(score.suspiciousTLD).toBe(false);
  });
});

describe("isHighRiskDomain", () => {
  it("returns true when score exceeds threshold (>)", () => {
    const scores = calculateSuspiciousScore("xyzqwrt.xyz");
    expect(isHighRiskDomain(scores, 30)).toBe(true);
  });

  it("returns false when score is below threshold", () => {
    const scores = calculateSuspiciousScore("google.com");
    expect(isHighRiskDomain(scores, 50)).toBe(false);
  });

  it("returns true when score equals threshold (>= is inclusive)", () => {
    const scores = calculateSuspiciousScore("xyzqwrt.xyz");
    // Use exact score as threshold - must return true (>=), not false (>)
    expect(isHighRiskDomain(scores, scores.totalScore)).toBe(true);
  });

  it("returns false when threshold is score + 1", () => {
    const scores = calculateSuspiciousScore("google.com");
    expect(isHighRiskDomain(scores, scores.totalScore + 1)).toBe(false);
  });

  it("returns true when threshold is 0 and score > 0", () => {
    const scores = calculateSuspiciousScore("google.com");
    // google.com has non-zero entropy contribution
    expect(scores.totalScore).toBeGreaterThan(0);
    expect(isHighRiskDomain(scores, 0)).toBe(true);
  });

  it("returns true when threshold equals totalScore exactly", () => {
    // Construct a known score: 'aa.com' = 10 points
    const scores = calculateSuspiciousScore("aa.com");
    expect(scores.totalScore).toBe(10);
    expect(isHighRiskDomain(scores, 10)).toBe(true);
    expect(isHighRiskDomain(scores, 11)).toBe(false);
  });
});

describe("SUSPICIOUS_TLDS", () => {
  it("contains all expected suspicious TLDs", () => {
    const expected = [
      "xyz", "top", "tk", "ml", "ga", "cf", "gq", "buzz", "cam", "icu",
      "club", "online", "work", "click", "link", "site", "website", "space",
      "fun", "monster", "rest", "surf", "hair", "quest", "bond", "cyou", "cfd",
    ];
    for (const tld of expected) {
      expect(SUSPICIOUS_TLDS.has(tld)).toBe(true);
    }
    expect(SUSPICIOUS_TLDS.size).toBe(expected.length);
  });

  it("does not contain common legitimate TLDs", () => {
    expect(SUSPICIOUS_TLDS.has("com")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("org")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("net")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("io")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("dev")).toBe(false);
  });

  it("does not contain country TLDs", () => {
    expect(SUSPICIOUS_TLDS.has("jp")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("uk")).toBe(false);
    expect(SUSPICIOUS_TLDS.has("de")).toBe(false);
  });
});
