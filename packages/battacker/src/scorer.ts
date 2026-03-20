import type {
  AttackCategory,
  AttackTest,
  CategoryScore,
  DefenseScore,
  TestResult,
} from "./types.js";
import { CATEGORY_WEIGHTS, scoreToGrade } from "./types.js";

const SEVERITY_SCORES = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

export function calculateCategoryScore(results: TestResult[]): CategoryScore {
  if (results.length === 0) {
    return {
      category: "network",
      score: 0,
      maxScore: 0,
      testResults: [],
    };
  }

  const category = results[0].test.category;
  let score = 0;
  let maxScore = 0;

  for (const result of results) {
    const testMaxScore = SEVERITY_SCORES[result.test.severity];
    maxScore += testMaxScore;

    if (result.result.blocked) {
      score += testMaxScore;
    }
  }

  return {
    category,
    score,
    maxScore,
    testResults: results,
  };
}

export function calculateDefenseScore(allResults: TestResult[]): DefenseScore {
  const resultsByCategory = new Map<AttackCategory, TestResult[]>();

  for (const result of allResults) {
    const category = result.test.category;
    const existing = resultsByCategory.get(category) ?? [];
    existing.push(result);
    resultsByCategory.set(category, existing);
  }

  const categories: CategoryScore[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [category, results] of resultsByCategory) {
    const categoryScore = calculateCategoryScore(results);
    categories.push(categoryScore);

    const weight = CATEGORY_WEIGHTS[category];
    const normalizedScore =
      categoryScore.maxScore > 0
        ? (categoryScore.score / categoryScore.maxScore) * 100
        : 0;

    weightedScore += normalizedScore * weight;
    totalWeight += weight;
  }

  const totalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  return {
    totalScore,
    maxScore: 100,
    grade: scoreToGrade(totalScore),
    categories,
    testedAt: Date.now(),
  };
}

export async function runAllTests(
  attacks: AttackTest[],
  onProgress?: (completed: number, total: number, current: AttackTest) => void,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const total = attacks.length;

  for (let i = 0; i < attacks.length; i++) {
    const attack = attacks[i];
    onProgress?.(i, total, attack);

    try {
      const result = await attack.simulate();
      results.push({
        test: {
          id: attack.id,
          name: attack.name,
          category: attack.category,
          description: attack.description,
          severity: attack.severity,
        },
        result,
        timestamp: Date.now(),
      });
    } catch (error) {
      results.push({
        test: {
          id: attack.id,
          name: attack.name,
          category: attack.category,
          description: attack.description,
          severity: attack.severity,
        },
        result: {
          blocked: true,
          executionTime: 0,
          details: `Test error: ${error instanceof Error ? error.message : String(error)}`,
          error: String(error),
        },
        timestamp: Date.now(),
      });
    }
  }

  // Note: completion notification is handled by caller (content.ts)
  return results;
}
