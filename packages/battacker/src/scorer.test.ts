import { describe, it, expect, vi } from "vitest";
import {
  calculateCategoryScore,
  calculateDefenseScore,
  runAllTests,
} from "./scorer";
import { scoreToGrade } from "./types";
import type { AttackTest, TestResult, AttackCategory, Severity } from "./types";

function makeTestResult(
  overrides: {
    category?: AttackCategory;
    severity?: Severity;
    blocked?: boolean;
    id?: string;
  } = {},
): TestResult {
  const category = overrides.category ?? "network";
  const severity = overrides.severity ?? "medium";
  return {
    test: {
      id: overrides.id ?? "test-1",
      name: "Test Attack",
      category,
      description: "A test attack",
      severity,
    },
    result: {
      blocked: overrides.blocked ?? false,
      executionTime: 10,
      details: "details",
    },
    timestamp: Date.now(),
  };
}

function makeAttackTest(
  overrides: {
    category?: AttackCategory;
    severity?: Severity;
    blocked?: boolean;
    shouldThrow?: boolean;
    id?: string;
  } = {},
): AttackTest {
  const category = overrides.category ?? "network";
  const severity = overrides.severity ?? "medium";
  return {
    id: overrides.id ?? "attack-1",
    name: "Test Attack",
    category,
    description: "A test attack",
    severity,
    simulate: overrides.shouldThrow
      ? () => Promise.reject(new Error("blocked by browser"))
      : () =>
          Promise.resolve({
            blocked: overrides.blocked ?? false,
            executionTime: 5,
            details: "simulated",
          }),
  };
}

describe("scoreToGrade", () => {
  it("returns A for score 95", () => {
    expect(scoreToGrade(95)).toBe("A");
  });

  it("returns A for boundary score 90", () => {
    expect(scoreToGrade(90)).toBe("A");
  });

  it("returns B for score 80", () => {
    expect(scoreToGrade(80)).toBe("B");
  });

  it("returns B for boundary score 75", () => {
    expect(scoreToGrade(75)).toBe("B");
  });

  it("returns C for score 65", () => {
    expect(scoreToGrade(65)).toBe("C");
  });

  it("returns D for score 50", () => {
    expect(scoreToGrade(50)).toBe("D");
  });

  it("returns F for score 30", () => {
    expect(scoreToGrade(30)).toBe("F");
  });

  it("returns F for score 0", () => {
    expect(scoreToGrade(0)).toBe("F");
  });
});

describe("calculateCategoryScore", () => {
  it("returns score 0 and maxScore 0 for empty results", () => {
    const result = calculateCategoryScore([]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.testResults).toEqual([]);
  });

  it("returns full score for single blocked critical test", () => {
    const result = calculateCategoryScore([
      makeTestResult({ severity: "critical", blocked: true }),
    ]);
    expect(result.score).toBe(30);
    expect(result.maxScore).toBe(30);
  });

  it("returns 0 score for single unblocked test", () => {
    const result = calculateCategoryScore([
      makeTestResult({ severity: "high", blocked: false }),
    ]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(20);
  });

  it("handles mixed blocked/unblocked with different severities", () => {
    const results = [
      makeTestResult({ severity: "critical", blocked: true, id: "t1" }),
      makeTestResult({ severity: "high", blocked: false, id: "t2" }),
      makeTestResult({ severity: "low", blocked: true, id: "t3" }),
    ];
    const score = calculateCategoryScore(results);
    // blocked: critical(30) + low(5) = 35
    // maxScore: critical(30) + high(20) + low(5) = 55
    expect(score.score).toBe(35);
    expect(score.maxScore).toBe(55);
  });

  it("preserves testResults array", () => {
    const input = [makeTestResult({ id: "preserve-me" })];
    const result = calculateCategoryScore(input);
    expect(result.testResults).toBe(input);
  });

  it("uses category from first result", () => {
    const result = calculateCategoryScore([
      makeTestResult({ category: "phishing" }),
    ]);
    expect(result.category).toBe("phishing");
  });
});

describe("calculateDefenseScore", () => {
  it("returns high score and grade A when all tests blocked", () => {
    const results = [
      makeTestResult({ category: "network", severity: "critical", blocked: true, id: "n1" }),
      makeTestResult({ category: "network", severity: "high", blocked: true, id: "n2" }),
      makeTestResult({ category: "phishing", severity: "medium", blocked: true, id: "p1" }),
    ];
    const score = calculateDefenseScore(results);
    // Both categories score 100% normalized, weighted average = 100
    expect(score.totalScore).toBe(100);
    expect(score.grade).toBe("A");
    expect(score.maxScore).toBe(100);
  });

  it("returns score 0 and grade F when no tests blocked", () => {
    const results = [
      makeTestResult({ category: "network", severity: "critical", blocked: false, id: "n1" }),
      makeTestResult({ category: "phishing", severity: "high", blocked: false, id: "p1" }),
    ];
    const score = calculateDefenseScore(results);
    expect(score.totalScore).toBe(0);
    expect(score.grade).toBe("F");
  });

  it("calculates weighted score for mixed categories", () => {
    // network weight=0.09, phishing weight=0.05
    const results = [
      makeTestResult({ category: "network", severity: "critical", blocked: true, id: "n1" }),
      makeTestResult({ category: "phishing", severity: "critical", blocked: false, id: "p1" }),
    ];
    const score = calculateDefenseScore(results);
    // network: 100% * 0.09, phishing: 0% * 0.05
    // weighted = (100*0.09 + 0*0.05) / (0.09+0.05) = 9/0.14 ≈ 64.28 → 64
    expect(score.totalScore).toBe(64);
    expect(score.grade).toBe("C");
  });

  it("has correct categoryScores entries", () => {
    const results = [
      makeTestResult({ category: "network", severity: "high", blocked: true, id: "n1" }),
      makeTestResult({ category: "storage", severity: "low", blocked: false, id: "s1" }),
    ];
    const score = calculateDefenseScore(results);
    expect(score.categories).toHaveLength(2);
    const cats = new Map(score.categories.map((c) => [c.category, c]));
    expect(cats.get("network")?.score).toBe(20);
    expect(cats.get("storage")?.score).toBe(0);
  });

  it("returns 0 for empty results", () => {
    const score = calculateDefenseScore([]);
    expect(score.totalScore).toBe(0);
    expect(score.grade).toBe("F");
    expect(score.categories).toHaveLength(0);
  });
});

describe("runAllTests", () => {
  it("returns results for each attack", async () => {
    const attacks = [
      makeAttackTest({ id: "a1", blocked: false }),
      makeAttackTest({ id: "a2", blocked: true }),
    ];
    const results = await runAllTests(attacks);
    expect(results).toHaveLength(2);
    expect(results[0].test.id).toBe("a1");
    expect(results[0].result.blocked).toBe(false);
    expect(results[1].test.id).toBe("a2");
    expect(results[1].result.blocked).toBe(true);
  });

  it("calls progress callback with (completed, total, currentAttack)", async () => {
    const onProgress = vi.fn();
    const attacks = [
      makeAttackTest({ id: "a1" }),
      makeAttackTest({ id: "a2" }),
    ];
    await runAllTests(attacks, onProgress);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(0, 2, attacks[0]);
    expect(onProgress).toHaveBeenCalledWith(1, 2, attacks[1]);
  });

  it("marks throwing attack as blocked with error details", async () => {
    const attacks = [makeAttackTest({ shouldThrow: true, id: "err-1" })];
    const results = await runAllTests(attacks);
    expect(results).toHaveLength(1);
    expect(results[0].result.blocked).toBe(true);
    expect(results[0].result.error).toContain("blocked by browser");
    expect(results[0].result.executionTime).toBe(0);
  });

  it("populates timestamp on each result", async () => {
    const before = Date.now();
    const results = await runAllTests([makeAttackTest()]);
    const after = Date.now();
    expect(results[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(results[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("copies test metadata without simulate function", async () => {
    const attack = makeAttackTest({ id: "meta-1", category: "phishing", severity: "critical" });
    const results = await runAllTests([attack]);
    const testMeta = results[0].test;
    expect(testMeta.id).toBe("meta-1");
    expect(testMeta.category).toBe("phishing");
    expect(testMeta.severity).toBe("critical");
    expect("simulate" in testMeta).toBe(false);
  });
});
