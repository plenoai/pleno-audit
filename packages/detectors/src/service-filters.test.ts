import { describe, it, expect } from "vitest";
import {
  filterNRDServices,
  filterLoginServices,
  filterTyposquatServices,
  filterAIServices,
} from "./service-filters.js";
import type { DetectedService } from "@libztbs/types";

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
const loginService = makeService({ domain: "login.com", hasLoginPage: true });
const typosquatService = makeService({
  domain: "g00gle.com",
  typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 80, checkedAt: 1742040000000 },
});
const aiService = makeService({
  domain: "chat.ai",
  aiDetected: { hasAIActivity: true, lastActivityAt: 1742040000000, providers: [] },
});
const normalService = makeService({ domain: "safe.com" });

const all = [nrdService, loginService, typosquatService, aiService, normalService];

describe("filterNRDServices", () => {
  it("returns only NRD services", () => {
    expect(filterNRDServices(all)).toEqual([nrdService]);
  });

  it("returns empty for no matches", () => {
    expect(filterNRDServices([normalService])).toEqual([]);
  });
});

describe("filterLoginServices", () => {
  it("returns only login services", () => {
    expect(filterLoginServices(all)).toEqual([loginService]);
  });
});

describe("filterTyposquatServices", () => {
  it("returns only typosquat services", () => {
    expect(filterTyposquatServices(all)).toEqual([typosquatService]);
  });
});

describe("filterAIServices", () => {
  it("returns only AI services", () => {
    expect(filterAIServices(all)).toEqual([aiService]);
  });
});
