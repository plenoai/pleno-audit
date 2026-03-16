import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateCategoryScore, calculateDefenseScore } from "./scorer";
import { scoreToGrade } from "./types";
import type { AttackCategory, Severity, TestResult, Grade } from "./types";

const GRADE_ORDER: Record<Grade, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };

const categoryArb: fc.Arbitrary<AttackCategory> = fc.constantFrom(
  "network",
  "phishing",
  "client-side",
  "download",
  "persistence",
  "side-channel",
  "fingerprinting",
  "cryptojacking",
  "privacy",
  "media",
  "storage",
  "worker",
  "injection",
  "covert",
  "advanced",
);

const severityArb: fc.Arbitrary<Severity> = fc.constantFrom(
  "critical",
  "high",
  "medium",
  "low",
);

const testResultArb = (category?: fc.Arbitrary<AttackCategory>): fc.Arbitrary<TestResult> =>
  fc.record({
    test: fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      category: category ?? categoryArb,
      description: fc.string({ minLength: 1, maxLength: 50 }),
      severity: severityArb,
    }),
    result: fc.record({
      blocked: fc.boolean(),
      executionTime: fc.nat({ max: 10000 }),
      details: fc.string({ minLength: 0, maxLength: 50 }),
    }),
    timestamp: fc.nat(),
  });

describe("scoreToGrade properties", () => {
  it("is monotonic: higher score yields equal or higher grade", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (a, b) => {
          const [high, low] = a >= b ? [a, b] : [b, a];
          expect(GRADE_ORDER[scoreToGrade(high)]).toBeGreaterThanOrEqual(
            GRADE_ORDER[scoreToGrade(low)],
          );
        },
      ),
    );
  });

  it("always returns a valid grade for scores 0-100", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
        const grade = scoreToGrade(score);
        expect(["A", "B", "C", "D", "F"]).toContain(grade);
      }),
    );
  });
});

describe("calculateCategoryScore properties", () => {
  it("score is always <= maxScore", () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb(fc.constant("network" as AttackCategory)), {
          minLength: 0,
          maxLength: 20,
        }),
        (results) => {
          const { score, maxScore } = calculateCategoryScore(results);
          expect(score).toBeLessThanOrEqual(maxScore);
        },
      ),
    );
  });

  it("score and maxScore are non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb(fc.constant("network" as AttackCategory)), {
          minLength: 0,
          maxLength: 20,
        }),
        (results) => {
          const { score, maxScore } = calculateCategoryScore(results);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(maxScore).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe("calculateDefenseScore properties", () => {
  it("totalScore is always between 0 and 100 inclusive", () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb(), { minLength: 0, maxLength: 30 }),
        (results) => {
          const { totalScore } = calculateDefenseScore(results);
          expect(totalScore).toBeGreaterThanOrEqual(0);
          expect(totalScore).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it("grade is consistent with totalScore", () => {
    fc.assert(
      fc.property(
        fc.array(testResultArb(), { minLength: 1, maxLength: 20 }),
        (results) => {
          const { totalScore, grade } = calculateDefenseScore(results);
          expect(grade).toBe(scoreToGrade(totalScore));
        },
      ),
    );
  });
});
