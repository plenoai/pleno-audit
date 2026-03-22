import { describe, it, expect } from "vitest";
import { calculateSecurityPosture, type PostureInput } from "./security-posture.js";

const clean: PostureInput = { nrdCount: 0, typosquatCount: 0, cspViolationCount: 0, aiPromptCount: 0 };

describe("calculateSecurityPosture", () => {
  it("returns 100 for clean state", () => {
    const result = calculateSecurityPosture(clean);
    expect(result.score).toBe(100);
    expect(result.status).toBe("normal");
    expect(result.level).toBe("info");
  });

  it("deducts 20pt per NRD", () => {
    const result = calculateSecurityPosture({ ...clean, nrdCount: 2 });
    expect(result.score).toBe(60);
    expect(result.status).toBe("danger");
  });

  it("deducts 30pt per typosquat", () => {
    const result = calculateSecurityPosture({ ...clean, typosquatCount: 1 });
    expect(result.score).toBe(70);
    expect(result.status).toBe("danger");
  });

  it("deducts 5pt per 10 CSP violations", () => {
    const result = calculateSecurityPosture({ ...clean, cspViolationCount: 25 });
    expect(result.score).toBe(90);
    expect(result.status).toBe("warning");
  });

  it("does not go below 0", () => {
    const result = calculateSecurityPosture({ ...clean, nrdCount: 3, typosquatCount: 2 });
    expect(result.score).toBe(0);
  });

  it("AI prompts do not reduce score but set monitoring status", () => {
    const result = calculateSecurityPosture({ ...clean, aiPromptCount: 5 });
    expect(result.score).toBe(100);
    expect(result.status).toBe("monitoring");
  });

  it("danger takes priority over monitoring", () => {
    const result = calculateSecurityPosture({ ...clean, nrdCount: 1, aiPromptCount: 10 });
    expect(result.status).toBe("danger");
  });

  it("provides breakdown for each category", () => {
    const result = calculateSecurityPosture({
      nrdCount: 1, typosquatCount: 1, cspViolationCount: 20, aiPromptCount: 3,
    });
    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown.find(b => b.category === "nrd")?.penalty).toBe(20);
    expect(result.breakdown.find(b => b.category === "typosquat")?.penalty).toBe(30);
    expect(result.breakdown.find(b => b.category === "csp_violation")?.penalty).toBe(10);
    expect(result.breakdown.find(b => b.category === "ai_monitoring")?.penalty).toBe(0);
    expect(result.score).toBe(40);
  });

  it("maps score to correct risk level", () => {
    // score=0 → 100-score=100 → critical
    expect(calculateSecurityPosture({ ...clean, nrdCount: 5 }).level).toBe("critical");
    // score=40 → 100-score=60 → high
    expect(calculateSecurityPosture({ ...clean, nrdCount: 3 }).level).toBe("high");
    // score=100 → 100-score=0 → info
    expect(calculateSecurityPosture(clean).level).toBe("info");
  });
});
