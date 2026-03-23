import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBlockingEngine, type BlockingConfig } from "./blocking-engine.js";
import { DEFAULT_BLOCKING_CONFIG } from "./storage-types.js";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-" + Math.random().toString(36).substr(2, 9),
});

// Mock logger
vi.mock("./logger.js", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("createBlockingEngine", () => {
  describe("initialization", () => {
    it("creates engine with default config", () => {
      const engine = createBlockingEngine();
      const config = engine.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.userConsentGiven).toBe(false);
    });

    it("creates engine with custom config", () => {
      const customConfig: BlockingConfig = {
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
      };
      const engine = createBlockingEngine(customConfig);
      expect(engine.isEnabled()).toBe(true);
    });
  });

  describe("isEnabled", () => {
    it("returns false when disabled", () => {
      const engine = createBlockingEngine();
      expect(engine.isEnabled()).toBe(false);
    });

    it("returns false when enabled but no consent", () => {
      const engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: false,
      });
      expect(engine.isEnabled()).toBe(false);
    });

    it("returns true when enabled and consent given", () => {
      const engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
      });
      expect(engine.isEnabled()).toBe(true);
    });
  });

  describe("config management", () => {
    it("updates config", () => {
      const engine = createBlockingEngine();
      engine.updateConfig({ enabled: true });
      expect(engine.getConfig().enabled).toBe(true);
    });

    it("records consent", () => {
      const engine = createBlockingEngine();
      engine.recordConsent();
      const config = engine.getConfig();
      expect(config.userConsentGiven).toBe(true);
      expect(config.consentTimestamp).toBeGreaterThan(0);
    });
  });

  describe("checkTyposquat", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockTyposquat: true,
      });
    });

    it("blocks high confidence typosquat", () => {
      const decision = engine.checkTyposquat({
        domain: "g00gle.com",
        confidence: "high",
      });
      expect(decision.shouldBlock).toBe(true);
      expect(decision.target).toBe("typosquat");
    });

    it("blocks medium confidence typosquat", () => {
      const decision = engine.checkTyposquat({
        domain: "gooogle.com",
        confidence: "medium",
      });
      expect(decision.shouldBlock).toBe(true);
    });

    it("does not block low confidence", () => {
      const decision = engine.checkTyposquat({
        domain: "legitimate.com",
        confidence: "low",
      });
      expect(decision.shouldBlock).toBe(false);
    });

    it("does not block when disabled", () => {
      engine.updateConfig({ blockTyposquat: false });
      const decision = engine.checkTyposquat({
        domain: "g00gle.com",
        confidence: "high",
      });
      expect(decision.shouldBlock).toBe(false);
    });

    it("records block event", () => {
      engine.checkTyposquat({
        domain: "g00gle.com",
        confidence: "high",
      });
      const events = engine.getBlockEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe("typosquat");
      expect(events[0].decision).toBe("blocked");
    });
  });

  describe("checkNRDLogin", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockNRDLogin: true,
      });
    });

    it("blocks NRD login", () => {
      const decision = engine.checkNRDLogin({
        domain: "new-site.xyz",
        isNRD: true,
        hasLoginForm: true,
      });
      expect(decision.shouldBlock).toBe(true);
      expect(decision.target).toBe("nrd_login");
    });

    it("does not block when not NRD", () => {
      const decision = engine.checkNRDLogin({
        domain: "google.com",
        isNRD: false,
        hasLoginForm: true,
      });
      expect(decision.shouldBlock).toBe(false);
    });

    it("does not block when no login form", () => {
      const decision = engine.checkNRDLogin({
        domain: "new-site.xyz",
        isNRD: true,
        hasLoginForm: false,
      });
      expect(decision.shouldBlock).toBe(false);
    });

    it("records warn event", () => {
      engine.checkNRDLogin({
        domain: "new-site.xyz",
        isNRD: true,
        hasLoginForm: true,
      });
      const events = engine.getBlockEvents();
      expect(events[0].decision).toBe("warned");
    });
  });

  describe("checkHighRiskExtension", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockHighRiskExtension: true,
      });
    });

    it("blocks critical risk level", () => {
      const decision = engine.checkHighRiskExtension({
        extensionId: "ext-123",
        extensionName: "Malicious Extension",
        riskScore: 95,
        riskLevel: "critical",
      });
      expect(decision.shouldBlock).toBe(true);
      expect(decision.target).toBe("high_risk_extension");
    });

    it("blocks high risk score (>=80)", () => {
      const decision = engine.checkHighRiskExtension({
        extensionId: "ext-456",
        extensionName: "High Risk Extension",
        riskScore: 85,
        riskLevel: "high",
      });
      expect(decision.shouldBlock).toBe(true);
    });

    it("does not block acceptable risk", () => {
      const decision = engine.checkHighRiskExtension({
        extensionId: "ext-789",
        extensionName: "Safe Extension",
        riskScore: 30,
        riskLevel: "low",
      });
      expect(decision.shouldBlock).toBe(false);
    });
  });

  describe("checkSensitiveDataToAI", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockSensitiveDataToAI: true,
      });
    });

    it("blocks credentials", () => {
      const decision = engine.checkSensitiveDataToAI({
        domain: "chat.openai.com",
        provider: "openai",
        hasCredentials: true,
        hasFinancial: false,
        hasPII: false,
        riskLevel: "high",
      });
      expect(decision.shouldBlock).toBe(true);
      expect(decision.details?.dataTypes).toContain("credentials");
    });

    it("warns on financial data", () => {
      const decision = engine.checkSensitiveDataToAI({
        domain: "chat.openai.com",
        provider: "openai",
        hasCredentials: false,
        hasFinancial: true,
        hasPII: false,
        riskLevel: "medium",
      });
      expect(decision.shouldBlock).toBe(true);
      expect(decision.details?.dataTypes).toContain("financial");
    });

    it("does not block PII only", () => {
      const decision = engine.checkSensitiveDataToAI({
        domain: "chat.openai.com",
        provider: "openai",
        hasCredentials: false,
        hasFinancial: false,
        hasPII: true,
        riskLevel: "low",
      });
      expect(decision.shouldBlock).toBe(false);
    });

    it("does not block when no sensitive data", () => {
      const decision = engine.checkSensitiveDataToAI({
        domain: "chat.openai.com",
        provider: "openai",
        hasCredentials: false,
        hasFinancial: false,
        hasPII: false,
        riskLevel: "low",
      });
      expect(decision.shouldBlock).toBe(false);
    });
  });

  describe("event management", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockTyposquat: true,
        blockNRDLogin: true,
      });
    });

    it("stores events with unique IDs", () => {
      engine.checkTyposquat({ domain: "test1.com", confidence: "high" });
      engine.checkTyposquat({ domain: "test2.com", confidence: "high" });
      const events = engine.getBlockEvents();
      expect(events[0].id).not.toBe(events[1].id);
    });

    it("filters events by target", () => {
      engine.checkTyposquat({ domain: "test.com", confidence: "high" });
      engine.checkNRDLogin({ domain: "nrd.com", isNRD: true, hasLoginForm: true });

      const typosquatEvents = engine.getBlockEvents({ target: "typosquat" });
      const nrdEvents = engine.getBlockEvents({ target: "nrd_login" });

      expect(typosquatEvents.length).toBe(1);
      expect(nrdEvents.length).toBe(1);
    });

    it("limits returned events", () => {
      for (let i = 0; i < 10; i++) {
        engine.checkTyposquat({ domain: `test${i}.com`, confidence: "high" });
      }
      const limited = engine.getBlockEvents({ limit: 5 });
      expect(limited.length).toBe(5);
    });

    it("returns events in reverse chronological order", () => {
      engine.checkTyposquat({ domain: "first.com", confidence: "high" });
      engine.checkTyposquat({ domain: "second.com", confidence: "high" });
      const events = engine.getBlockEvents();
      expect(events[0].domain).toBe("second.com");
      expect(events[1].domain).toBe("first.com");
    });

    it("clears events", () => {
      engine.checkTyposquat({ domain: "test.com", confidence: "high" });
      engine.clearEvents();
      expect(engine.getBlockEvents().length).toBe(0);
    });
  });

  describe("statistics", () => {
    let engine: ReturnType<typeof createBlockingEngine>;

    beforeEach(() => {
      engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockTyposquat: true,
        blockNRDLogin: true,
        blockSensitiveDataToAI: true,
      });
    });

    it("counts blocked events", () => {
      engine.checkTyposquat({ domain: "test.com", confidence: "high" });
      const stats = engine.getStats();
      expect(stats.totalBlocked).toBe(1);
    });

    it("counts warned events", () => {
      engine.checkNRDLogin({ domain: "nrd.com", isNRD: true, hasLoginForm: true });
      const stats = engine.getStats();
      expect(stats.totalWarned).toBe(1);
    });

    it("counts by target", () => {
      engine.checkTyposquat({ domain: "typo.com", confidence: "high" });
      engine.checkTyposquat({ domain: "typo2.com", confidence: "high" });
      engine.checkNRDLogin({ domain: "nrd.com", isNRD: true, hasLoginForm: true });

      const stats = engine.getStats();
      expect(stats.byTarget.typosquat).toBe(2);
      expect(stats.byTarget.nrd_login).toBe(1);
    });

    it("returns zero stats when no events", () => {
      const stats = engine.getStats();
      expect(stats.totalBlocked).toBe(0);
      expect(stats.totalWarned).toBe(0);
      expect(stats.totalAllowed).toBe(0);
    });
  });

  describe("event limit", () => {
    it("maintains max event limit", () => {
      const engine = createBlockingEngine({
        ...DEFAULT_BLOCKING_CONFIG,
        enabled: true,
        userConsentGiven: true,
        blockTyposquat: true,
      });

      // Generate more than 1000 events
      for (let i = 0; i < 1050; i++) {
        engine.checkTyposquat({ domain: `test${i}.com`, confidence: "high" });
      }

      const events = engine.getBlockEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });
});
