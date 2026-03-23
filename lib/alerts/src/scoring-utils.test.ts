import { describe, it, expect } from "vitest";
import {
  scoreToRiskLevel5,
  scoreToExtensionRiskLevel,
  RISK_SCORE_THRESHOLDS,
  type RiskLevel5,
  type ExtensionRiskLevel,
} from "./scoring-utils.js";

// ============================================================================
// Risk Score Thresholds Tests
// ============================================================================

describe("RISK_SCORE_THRESHOLDS", () => {
  it("defines correct threshold values", () => {
    expect(RISK_SCORE_THRESHOLDS.CRITICAL).toBe(80);
    expect(RISK_SCORE_THRESHOLDS.HIGH).toBe(60);
    expect(RISK_SCORE_THRESHOLDS.MEDIUM).toBe(40);
    expect(RISK_SCORE_THRESHOLDS.LOW).toBe(20);
  });

  it("exposes a stable thresholds object", () => {
    // Ensure thresholds reference is stable
    const thresholds1 = RISK_SCORE_THRESHOLDS;
    const thresholds2 = RISK_SCORE_THRESHOLDS;

    expect(thresholds1.CRITICAL).toBe(thresholds2.CRITICAL);
    expect(thresholds1.HIGH).toBe(thresholds2.HIGH);
    expect(thresholds1.MEDIUM).toBe(thresholds2.MEDIUM);
    expect(thresholds1.LOW).toBe(thresholds2.LOW);
  });
});

// ============================================================================
// scoreToRiskLevel5 Tests
// ============================================================================

describe("scoreToRiskLevel5", () => {
  describe("critical level (80+)", () => {
    it("returns critical for score >= 80", () => {
      expect(scoreToRiskLevel5(80)).toBe("critical");
      expect(scoreToRiskLevel5(85)).toBe("critical");
      expect(scoreToRiskLevel5(100)).toBe("critical");
    });
  });

  describe("high level (60-79)", () => {
    it("returns high for score 60-79", () => {
      expect(scoreToRiskLevel5(60)).toBe("high");
      expect(scoreToRiskLevel5(70)).toBe("high");
      expect(scoreToRiskLevel5(79)).toBe("high");
    });

    it("does not return high for 59", () => {
      expect(scoreToRiskLevel5(59)).not.toBe("high");
    });
  });

  describe("medium level (40-59)", () => {
    it("returns medium for score 40-59", () => {
      expect(scoreToRiskLevel5(40)).toBe("medium");
      expect(scoreToRiskLevel5(50)).toBe("medium");
      expect(scoreToRiskLevel5(59)).toBe("medium");
    });

    it("does not return medium for 39", () => {
      expect(scoreToRiskLevel5(39)).not.toBe("medium");
    });
  });

  describe("low level (20-39)", () => {
    it("returns low for score 20-39", () => {
      expect(scoreToRiskLevel5(20)).toBe("low");
      expect(scoreToRiskLevel5(30)).toBe("low");
      expect(scoreToRiskLevel5(39)).toBe("low");
    });

    it("does not return low for 19", () => {
      expect(scoreToRiskLevel5(19)).not.toBe("low");
    });
  });

  describe("info level (<20)", () => {
    it("returns info for score < 20", () => {
      expect(scoreToRiskLevel5(0)).toBe("info");
      expect(scoreToRiskLevel5(10)).toBe("info");
      expect(scoreToRiskLevel5(19)).toBe("info");
    });
  });

  describe("boundary cases", () => {
    it("handles exact threshold boundaries", () => {
      expect(scoreToRiskLevel5(80)).toBe("critical");
      expect(scoreToRiskLevel5(79)).toBe("high");
      expect(scoreToRiskLevel5(60)).toBe("high");
      expect(scoreToRiskLevel5(59)).toBe("medium");
      expect(scoreToRiskLevel5(40)).toBe("medium");
      expect(scoreToRiskLevel5(39)).toBe("low");
      expect(scoreToRiskLevel5(20)).toBe("low");
      expect(scoreToRiskLevel5(19)).toBe("info");
    });
  });

  describe("edge cases", () => {
    it("handles zero score", () => {
      expect(scoreToRiskLevel5(0)).toBe("info");
    });

    it("handles maximum score", () => {
      expect(scoreToRiskLevel5(100)).toBe("critical");
    });

    it("handles negative scores", () => {
      expect(scoreToRiskLevel5(-1)).toBe("info");
      expect(scoreToRiskLevel5(-100)).toBe("info");
    });

    it("handles decimal scores", () => {
      expect(scoreToRiskLevel5(80.5)).toBe("critical");
      expect(scoreToRiskLevel5(59.9)).toBe("medium");
      expect(scoreToRiskLevel5(40.1)).toBe("medium");
    });
  });

  describe("type consistency", () => {
    it("always returns valid RiskLevel5 type", () => {
      const validLevels: RiskLevel5[] = [
        "critical",
        "high",
        "medium",
        "low",
        "info",
      ];

      const testScores = [0, 19, 20, 39, 40, 59, 60, 79, 80, 100];

      for (const score of testScores) {
        const level = scoreToRiskLevel5(score);
        expect(validLevels).toContain(level);
      }
    });
  });
});

// ============================================================================
// scoreToExtensionRiskLevel Tests
// ============================================================================

describe("scoreToExtensionRiskLevel", () => {
  describe("critical level (80+)", () => {
    it("returns critical for score >= 80", () => {
      expect(scoreToExtensionRiskLevel(80)).toBe("critical");
      expect(scoreToExtensionRiskLevel(90)).toBe("critical");
      expect(scoreToExtensionRiskLevel(100)).toBe("critical");
    });
  });

  describe("high level (60-79)", () => {
    it("returns high for score 60-79", () => {
      expect(scoreToExtensionRiskLevel(60)).toBe("high");
      expect(scoreToExtensionRiskLevel(70)).toBe("high");
      expect(scoreToExtensionRiskLevel(79)).toBe("high");
    });
  });

  describe("medium level (40-59)", () => {
    it("returns medium for score 40-59", () => {
      expect(scoreToExtensionRiskLevel(40)).toBe("medium");
      expect(scoreToExtensionRiskLevel(50)).toBe("medium");
      expect(scoreToExtensionRiskLevel(59)).toBe("medium");
    });
  });

  describe("low level (20-39)", () => {
    it("returns low for score 20-39", () => {
      expect(scoreToExtensionRiskLevel(20)).toBe("low");
      expect(scoreToExtensionRiskLevel(30)).toBe("low");
      expect(scoreToExtensionRiskLevel(39)).toBe("low");
    });
  });

  describe("safe level (<20)", () => {
    it("returns safe for score < 20", () => {
      expect(scoreToExtensionRiskLevel(0)).toBe("safe");
      expect(scoreToExtensionRiskLevel(10)).toBe("safe");
      expect(scoreToExtensionRiskLevel(19)).toBe("safe");
    });
  });

  describe("boundary cases", () => {
    it("handles exact threshold boundaries", () => {
      expect(scoreToExtensionRiskLevel(80)).toBe("critical");
      expect(scoreToExtensionRiskLevel(79)).toBe("high");
      expect(scoreToExtensionRiskLevel(60)).toBe("high");
      expect(scoreToExtensionRiskLevel(59)).toBe("medium");
      expect(scoreToExtensionRiskLevel(40)).toBe("medium");
      expect(scoreToExtensionRiskLevel(39)).toBe("low");
      expect(scoreToExtensionRiskLevel(20)).toBe("low");
      expect(scoreToExtensionRiskLevel(19)).toBe("safe");
    });
  });

  describe("edge cases", () => {
    it("handles zero score", () => {
      expect(scoreToExtensionRiskLevel(0)).toBe("safe");
    });

    it("handles maximum score", () => {
      expect(scoreToExtensionRiskLevel(100)).toBe("critical");
    });

    it("handles negative scores", () => {
      expect(scoreToExtensionRiskLevel(-1)).toBe("safe");
      expect(scoreToExtensionRiskLevel(-100)).toBe("safe");
    });

    it("handles decimal scores", () => {
      expect(scoreToExtensionRiskLevel(80.5)).toBe("critical");
      expect(scoreToExtensionRiskLevel(59.9)).toBe("medium");
      expect(scoreToExtensionRiskLevel(40.1)).toBe("medium");
    });
  });

  describe("type consistency", () => {
    it("always returns valid ExtensionRiskLevel type", () => {
      const validLevels: ExtensionRiskLevel[] = [
        "critical",
        "high",
        "medium",
        "low",
        "safe",
      ];

      const testScores = [0, 19, 20, 39, 40, 59, 60, 79, 80, 100];

      for (const score of testScores) {
        const level = scoreToExtensionRiskLevel(score);
        expect(validLevels).toContain(level);
      }
    });
  });
});

// ============================================================================
// Comparison Tests
// ============================================================================

describe("scoreToRiskLevel5 vs scoreToExtensionRiskLevel", () => {
  it("returns same level names except for info/safe", () => {
    // Both functions should map the same score ranges to the same names
    // except for the lowest level (info vs safe)

    for (let score = 20; score <= 100; score += 5) {
      const level5 = scoreToRiskLevel5(score);
      const extensionLevel = scoreToExtensionRiskLevel(score);

      expect(level5).toBe(extensionLevel);
    }
  });

  it("differs only in lowest risk level", () => {
    // Score < 20 should return "info" for RiskLevel5
    // and "safe" for ExtensionRiskLevel
    expect(scoreToRiskLevel5(10)).toBe("info");
    expect(scoreToExtensionRiskLevel(10)).toBe("safe");

    expect(scoreToRiskLevel5(0)).toBe("info");
    expect(scoreToExtensionRiskLevel(0)).toBe("safe");
  });

  it("handles boundaries identically where both have the level", () => {
    const commonBoundaries = [20, 40, 60, 80];

    for (const boundary of commonBoundaries) {
      expect(scoreToRiskLevel5(boundary)).toBe(
        scoreToExtensionRiskLevel(boundary)
      );
    }
  });
});

// ============================================================================
// Distribution Tests
// ============================================================================

describe("score distribution", () => {
  it("covers full range 0-100", () => {
    const levels = new Set<RiskLevel5>();

    for (let score = 0; score <= 100; score++) {
      levels.add(scoreToRiskLevel5(score));
    }

    expect(levels.size).toBeGreaterThan(1);
    expect(levels).toContain("critical");
    expect(levels).toContain("high");
    expect(levels).toContain("medium");
    expect(levels).toContain("low");
    expect(levels).toContain("info");
  });

  it("extension levels cover full range", () => {
    const levels = new Set<ExtensionRiskLevel>();

    for (let score = 0; score <= 100; score++) {
      levels.add(scoreToExtensionRiskLevel(score));
    }

    expect(levels.size).toBeGreaterThan(1);
    expect(levels).toContain("critical");
    expect(levels).toContain("high");
    expect(levels).toContain("medium");
    expect(levels).toContain("low");
    expect(levels).toContain("safe");
  });
});
