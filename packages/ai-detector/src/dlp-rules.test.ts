import { describe, it, expect, beforeEach } from "vitest";
import {
  createDLPManager,
  EXTENDED_DLP_RULES,
  ALL_DLP_RULES,
  DEFAULT_DLP_CONFIG,
  type DLPManager,
} from "./dlp-rules.js";

// Helper to build test patterns without triggering secret scanning
const buildTestKey = (prefix: string, suffix: string) => prefix + suffix;

describe("EXTENDED_DLP_RULES", () => {
  describe("API key patterns", () => {
    it("detects Google API keys", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "google-api-key");
      expect(rule).toBeDefined();
      // Google API keys: AIza + 35 characters
      const testKey = buildTestKey("AIza", "SyAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq");
      expect(testKey.match(rule!.pattern)).not.toBeNull();
    });

    it("detects Stripe API keys", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "stripe-key");
      expect(rule).toBeDefined();
      // Build test keys dynamically to avoid secret scanning
      const testKey = buildTestKey("sk_", "test_AAAAAAAAAAAAAAAAAAAAAAAA");
      const liveKey = buildTestKey("pk_", "live_BBBBBBBBBBBBBBBBBBBBBBBB");
      expect(testKey.match(rule!.pattern)).not.toBeNull();
      expect(liveKey.match(rule!.pattern)).not.toBeNull();
    });

    it("detects Slack tokens", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "slack-token");
      expect(rule).toBeDefined();
      // Build dynamically
      const testToken = buildTestKey("xoxb-", "0000000000-0000000000-AAAAAAAAAAAAAAAA");
      expect(testToken.match(rule!.pattern)).not.toBeNull();
    });

    it("detects Twilio keys", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "twilio-key");
      expect(rule).toBeDefined();
      // Twilio: AC/SK + 32 hex characters
      const testKey = buildTestKey("AC", "00000000000000000000000000000000");
      expect(testKey.match(rule!.pattern)).not.toBeNull();
    });

    it("detects SendGrid API keys", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "sendgrid-key");
      expect(rule).toBeDefined();
      const testKey = buildTestKey("SG.", "1234567890123456789012.1234567890123456789012345678901234567890123");
      expect(testKey.match(rule!.pattern)).not.toBeNull();
    });

    it("detects JWT tokens", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "jwt-token");
      expect(rule).toBeDefined();
      // JWT has three parts
      const testJwt = buildTestKey(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
        "eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
      );
      expect(testJwt.match(rule!.pattern)).not.toBeNull();
    });

    it("detects Basic Auth headers", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "basic-auth");
      expect(rule).toBeDefined();
      const testAuth = buildTestKey("Basic ", "dXNlcm5hbWU6cGFzc3dvcmQ=");
      expect(testAuth.match(rule!.pattern)).not.toBeNull();
    });

    it("detects Bearer tokens", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "bearer-token");
      expect(rule).toBeDefined();
      const testBearer = buildTestKey("Bearer ", "abc123def456");
      expect(testBearer.match(rule!.pattern)).not.toBeNull();
    });
  });

  describe("Japan-specific patterns", () => {
    it("detects マイナンバー", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "my-number");
      expect(rule).toBeDefined();
      expect("マイナンバー: 1234-5678-9012".match(rule!.pattern)).not.toBeNull();
      expect("個人番号：123456789012".match(rule!.pattern)).not.toBeNull();
    });

    it("detects 運転免許証番号", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "jp-drivers-license");
      expect(rule).toBeDefined();
      expect("運転免許: 123456789012".match(rule!.pattern)).not.toBeNull();
    });

    it("detects 旅券番号", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "jp-passport");
      expect(rule).toBeDefined();
      expect("旅券番号: TK1234567".match(rule!.pattern)).not.toBeNull();
    });

    it("detects 銀行コード", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "jp-bank-code");
      expect(rule).toBeDefined();
      expect("銀行コード: 0001".match(rule!.pattern)).not.toBeNull();
      expect("支店コード：123".match(rule!.pattern)).not.toBeNull();
    });
  });

  describe("Network/URL patterns", () => {
    it("detects URLs with tokens", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "url-with-token");
      expect(rule).toBeDefined();
      expect(
        "https://api.example.com?token=abc123def456".match(rule!.pattern)
      ).not.toBeNull();
      expect(
        "https://api.example.com?api_key=secret123".match(rule!.pattern)
      ).not.toBeNull();
    });

    it("detects connection strings", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "connection-string");
      expect(rule).toBeDefined();
      expect(
        "mongodb://user:password@localhost:27017/db".match(rule!.pattern)
      ).not.toBeNull();
      expect(
        "postgresql://admin:secret@db.example.com:5432".match(rule!.pattern)
      ).not.toBeNull();
    });
  });

  describe("Environment variables", () => {
    it("detects environment variable assignments", () => {
      const rule = EXTENDED_DLP_RULES.find((r) => r.id === "env-variable");
      expect(rule).toBeDefined();
      expect('export DATABASE_URL="postgres://..."'.match(rule!.pattern)).not.toBeNull();
      expect("API_SECRET=mysupersecretkey123".match(rule!.pattern)).not.toBeNull();
    });
  });
});

describe("createDLPManager", () => {
  let manager: DLPManager;

  beforeEach(() => {
    manager = createDLPManager();
  });

  describe("analyze", () => {
    it("detects credentials in text", () => {
      const testKey = buildTestKey("sk_", "test_AAAAAAAAAAAAAAAAAAAAAAAA");
      const result = manager.analyze("API key is " + testKey);
      expect(result.detected.length).toBeGreaterThan(0);
      expect(result.detected.some((d) => d.classification === "credentials")).toBe(true);
    });

    it("returns empty result when disabled", () => {
      manager.updateConfig({ enabled: false });
      const testKey = buildTestKey("sk_", "test_AAAAAAAAAAAAAAAAAAAAAAAA");
      const result = manager.analyze(testKey);
      expect(result.detected).toHaveLength(0);
      expect(result.riskLevel).toBe("none");
    });

    it("detects Japanese PII", () => {
      const result = manager.analyze("マイナンバー: 1234-5678-9012");
      expect(result.detected.some((d) => d.classification === "pii")).toBe(true);
    });

    it("detects multiple patterns", () => {
      const stripeKey = buildTestKey("sk_", "live_CCCCCCCCCCCCCCCCCCCCCCCC");
      const text = `
        Stripe key: ${stripeKey}
        Email: user@example.com
        マイナンバー: 1234-5678-9012
      `;
      const result = manager.analyze(text);
      expect(result.detected.length).toBeGreaterThanOrEqual(2);
    });

    it("blocks high-risk credentials when enabled", () => {
      manager.updateConfig({ blockOnHighRisk: true });
      const stripeKey = buildTestKey("sk_", "live_CCCCCCCCCCCCCCCCCCCCCCCC");
      const result = manager.analyze("Stripe: " + stripeKey);
      expect(result.blocked).toBe(true);
      expect(result.detected.some((d) => d.blocked)).toBe(true);
    });

    it("does not block when blockOnHighRisk is disabled", () => {
      manager.updateConfig({ blockOnHighRisk: false });
      const stripeKey = buildTestKey("sk_", "live_CCCCCCCCCCCCCCCCCCCCCCCC");
      const result = manager.analyze("Stripe: " + stripeKey);
      expect(result.blocked).toBe(false);
    });

    it("calculates correct risk level", () => {
      // Critical for high confidence credentials
      const stripeKey = buildTestKey("sk_", "live_CCCCCCCCCCCCCCCCCCCCCCCC");
      const credResult = manager.analyze(stripeKey);
      expect(credResult.riskLevel).toBe("critical");

      // None for clean text
      const cleanResult = manager.analyze("Hello world");
      expect(cleanResult.riskLevel).toBe("none");
    });

    it("provides correct summary", () => {
      const testKey = buildTestKey("sk_", "test_AAAAAAAAAAAAAAAAAAAAAAAA");
      const result = manager.analyze(testKey + " user@example.com");
      expect(result.summary.total).toBeGreaterThan(0);
      expect(typeof result.summary.byClassification.credentials).toBe("number");
      expect(typeof result.summary.highConfidenceCount).toBe("number");
    });

    it("masks detected text in results", () => {
      const testKey = buildTestKey("sk_", "test_AAAAAAAAAAAAAAAAAAAAAAAA");
      const result = manager.analyze(testKey);
      const detected = result.detected.find((d) => d.ruleId === "stripe-key");
      if (detected) {
        expect(detected.matchedText).toContain("*");
        expect(detected.matchedText).not.toBe(testKey);
      }
    });
  });

  describe("rule management", () => {
    it("enables and disables rules", () => {
      const initialRules = manager.getEnabledRules();
      const ruleToDisable = initialRules[0];

      manager.setRuleEnabled(ruleToDisable.id, false);

      const updatedRules = manager.getEnabledRules();
      expect(updatedRules.find((r) => r.id === ruleToDisable.id)).toBeUndefined();
    });

    it("returns false when disabling non-existent rule", () => {
      const result = manager.setRuleEnabled("non-existent-rule", false);
      expect(result).toBe(false);
    });

    it("adds custom rules", () => {
      const initialCount = manager.getAllRules().length;

      manager.addCustomRule({
        id: "custom-test-rule",
        name: "Custom Test Rule",
        description: "A test rule",
        classification: "internal",
        pattern: /test-pattern-[0-9]+/g,
        confidence: "medium",
        enabled: true,
      });

      const updatedRules = manager.getAllRules();
      expect(updatedRules.length).toBe(initialCount + 1);
      expect(updatedRules.find((r) => r.id === "custom-test-rule")).toBeDefined();
      expect(updatedRules.find((r) => r.id === "custom-test-rule")?.custom).toBe(true);
    });

    it("removes custom rules", () => {
      manager.addCustomRule({
        id: "rule-to-remove",
        name: "Rule to Remove",
        description: "Will be removed",
        classification: "internal",
        pattern: /remove-me/g,
        confidence: "low",
        enabled: true,
      });

      const addedRule = manager.getAllRules().find((r) => r.id === "rule-to-remove");
      expect(addedRule).toBeDefined();

      const removed = manager.removeCustomRule("rule-to-remove");
      expect(removed).toBe(true);

      const removedRule = manager.getAllRules().find((r) => r.id === "rule-to-remove");
      expect(removedRule).toBeUndefined();
    });

    it("cannot remove non-custom rules", () => {
      const builtInRule = manager.getAllRules().find((r) => !r.custom);
      expect(builtInRule).toBeDefined();

      const removed = manager.removeCustomRule(builtInRule!.id);
      expect(removed).toBe(false);
    });
  });

  describe("configuration", () => {
    it("updates configuration", () => {
      manager.updateConfig({ alertOnDetection: false });
      const config = manager.getConfig();
      expect(config.alertOnDetection).toBe(false);
    });

    it("returns copy of configuration", () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it("returns copy of rules", () => {
      const rules1 = manager.getAllRules();
      const rules2 = manager.getAllRules();
      expect(rules1).not.toBe(rules2);
    });
  });
});

describe("DEFAULT_DLP_CONFIG", () => {
  it("has expected default values", () => {
    expect(DEFAULT_DLP_CONFIG.enabled).toBe(true);
    expect(DEFAULT_DLP_CONFIG.alertOnDetection).toBe(true);
    expect(DEFAULT_DLP_CONFIG.blockOnHighRisk).toBe(false);
    expect(DEFAULT_DLP_CONFIG.rules.length).toBeGreaterThan(0);
  });

  it("includes all rules", () => {
    expect(DEFAULT_DLP_CONFIG.rules).toEqual(ALL_DLP_RULES);
  });
});

describe("ReDoS耐性", () => {
  const BUDGET_MS = 50;
  const SPIKE_FACTOR = 2;

  function measureExecution(
    action: () => void,
    options: { warmup?: number; samples?: number } = {}
  ): { median: number; max: number } {
    const warmup = options.warmup ?? 2;
    const samples = options.samples ?? 7;

    for (let i = 0; i < warmup; i++) {
      action();
    }

    const durations: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      action();
      durations.push(performance.now() - start);
    }

    durations.sort((a, b) => a - b);
    return {
      median: durations[Math.floor(durations.length / 2)],
      max: durations[durations.length - 1],
    };
  }

  function expectWithinBudget(
    action: () => void,
    budgetMs: number = BUDGET_MS
  ): void {
    const { median, max } = measureExecution(action);
    // CI上の一時的ノイズは吸収しつつ、中央値と最大値で回帰を検知する。
    expect(median).toBeLessThan(budgetMs);
    expect(max).toBeLessThan(budgetMs * SPIKE_FACTOR);
  }

  it(`url-with-token: ?&なし長大URLで ${BUDGET_MS}ms 以内`, () => {
    const rule = EXTENDED_DLP_RULES.find((r) => r.id === "url-with-token")!;
    // ?&がないため旧パターンでは[^\s]*が全部食ってバックトラック
    const malicious = "https://example.com/" + "a".repeat(100_000);
    expectWithinBudget(() => {
      rule.pattern.test(malicious);
    });
  });

  it(`connection-string: @なし長大文字列で ${BUDGET_MS}ms 以内`, () => {
    const rule = EXTENDED_DLP_RULES.find((r) => r.id === "connection-string")!;
    const malicious = "mongodb://" + "a:".repeat(50_000);
    expectWithinBudget(() => {
      rule.pattern.test(malicious);
    });
  });

  it(`全DLPルールが100KBテキストで ${BUDGET_MS}ms 以内`, () => {
    const big = "x".repeat(100_000);
    expectWithinBudget(() => {
      for (const rule of EXTENDED_DLP_RULES) {
        const re = new RegExp(rule.pattern.source, rule.pattern.flags);
        re.test(big);
      }
    });
  });
});
