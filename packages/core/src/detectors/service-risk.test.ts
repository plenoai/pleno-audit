import { describe, it, expect } from "vitest";
import {
  buildDismissPattern,
  computeServiceRiskScore,
  getRiskLevel,
  getServiceRiskFlags,
  isPatternDismissed,
} from "./service-risk.js";
import type { DetectedService } from "../types/index.js";

function makeService(overrides: Partial<DetectedService> = {}): DetectedService {
  return {
    domain: "example.com",
    detectedAt: 1742040000000,
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
    ...overrides,
  };
}

const nrdService = makeService({
  domain: "new.xyz",
  nrdResult: { isNRD: true, confidence: "high", domainAge: 3, checkedAt: 1742040000000 },
});
const typosquatService = makeService({
  domain: "g00gle.com",
  typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 80, checkedAt: 1742040000000 },
});

describe("buildDismissPattern", () => {
  it("joins category and domain with separator", () => {
    expect(buildDismissPattern("typosquat", "g00gle.com")).toBe("typosquat::g00gle.com");
  });
});

describe("isPatternDismissed", () => {
  it("returns true when matching pattern is in the set", () => {
    const set = new Set(["typosquat::g00gle.com"]);
    expect(isPatternDismissed(set, "typosquat", "g00gle.com")).toBe(true);
  });

  it("returns false for non-matching pattern", () => {
    const set = new Set(["nrd::new.xyz"]);
    expect(isPatternDismissed(set, "typosquat", "g00gle.com")).toBe(false);
  });

  it("returns false for undefined dismissedPatterns", () => {
    expect(isPatternDismissed(undefined, "typosquat", "g00gle.com")).toBe(false);
  });
});

describe("getServiceRiskFlags", () => {
  it("returns nrd and typosquat flags when not dismissed", () => {
    const service = makeService({
      domain: "bad.xyz",
      nrdResult: { isNRD: true, confidence: "high", domainAge: 5, checkedAt: 0 },
      typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 80, checkedAt: 0 },
    });
    const flags = getServiceRiskFlags(service);
    expect(flags.map((f) => f.kind)).toEqual(["nrd", "typosquat"]);
  });

  it("excludes dismissed nrd flag", () => {
    const flags = getServiceRiskFlags(
      nrdService,
      new Set(["nrd::new.xyz"]),
    );
    expect(flags).toEqual([]);
  });

  it("excludes dismissed typosquat flag", () => {
    const flags = getServiceRiskFlags(
      typosquatService,
      new Set(["typosquat::g00gle.com"]),
    );
    expect(flags).toEqual([]);
  });

  it("includes login, ai, and sensitive-data flags", () => {
    const service = makeService({
      hasLoginPage: true,
      aiDetected: { hasAIActivity: true, lastActivityAt: 0, providers: [] },
      sensitiveDataDetected: ["password", "credit-card"],
    });
    const flags = getServiceRiskFlags(service);
    expect(flags).toEqual([
      { kind: "login" },
      { kind: "ai" },
      { kind: "sensitive-data", dataType: "password" },
      { kind: "sensitive-data", dataType: "credit-card" },
    ]);
  });
});

describe("computeServiceRiskScore", () => {
  it("scores typosquat services and clamps under 100", () => {
    const score = computeServiceRiskScore({ service: typosquatService });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("removes typosquat contribution when dismissed", () => {
    const before = computeServiceRiskScore({ service: typosquatService });
    const after = computeServiceRiskScore({
      service: typosquatService,
      dismissedPatterns: new Set(["typosquat::g00gle.com"]),
    });
    expect(after).toBeLessThan(before);
    expect(after - before).toBeLessThanOrEqual(-25);
  });

  it("removes nrd contribution when dismissed", () => {
    const before = computeServiceRiskScore({ service: nrdService });
    const after = computeServiceRiskScore({
      service: nrdService,
      dismissedPatterns: new Set(["nrd::new.xyz"]),
    });
    expect(after).toBeLessThan(before);
    expect(after - before).toBeLessThanOrEqual(-40);
  });

  it("adds severity weight when alertSummary present", () => {
    const baseline = computeServiceRiskScore({ service: makeService() });
    const withAlert = computeServiceRiskScore({
      service: makeService(),
      alertSummary: { total: 1, maxSeverity: "critical" },
    });
    expect(withAlert - baseline).toBe(20);
  });
});

describe("getRiskLevel", () => {
  it("maps score thresholds to levels", () => {
    expect(getRiskLevel(0)).toBe("none");
    expect(getRiskLevel(8)).toBe("low");
    expect(getRiskLevel(15)).toBe("medium");
    expect(getRiskLevel(40)).toBe("high");
    expect(getRiskLevel(100)).toBe("high");
  });
});
