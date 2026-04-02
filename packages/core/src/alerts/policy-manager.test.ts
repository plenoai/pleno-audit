import { describe, it, expect } from "vitest";
import { createPolicyManager } from "./policy-manager.js";
import type { PolicyConfig, DomainPolicyRule, ToolPolicyRule, AIPolicyRule, DataTransferPolicyRule } from "./policy-types.js";

function createTestConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    enabled: true,
    domainRules: [],
    toolRules: [],
    aiRules: [],
    dataTransferRules: [],
    ...overrides,
  };
}

describe("createPolicyManager", () => {
  describe("basic operations", () => {
    it("creates policy manager", () => {
      const pm = createPolicyManager();
      expect(pm).toBeDefined();
      expect(pm.getConfig).toBeDefined();
      expect(pm.checkDomain).toBeDefined();
    });

    it("returns initial config", () => {
      const pm = createPolicyManager(createTestConfig());
      const config = pm.getConfig();
      expect(config.enabled).toBe(true);
    });

    it("updates config", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.updateConfig({ enabled: false });
      expect(pm.getConfig().enabled).toBe(false);
    });
  });

  describe("checkDomain", () => {
    it("allows all domains when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      const result = pm.checkDomain("malicious.com");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("allows domain when no rules match", () => {
      const pm = createPolicyManager(createTestConfig());
      const result = pm.checkDomain("example.com");
      expect(result.allowed).toBe(true);
    });

    it("warns on domain with exact match rule (observe-only)", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn malicious.com",
        enabled: true,
        priority: 1,
        pattern: "malicious.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("malicious.com");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].action).toBe("warn");
    });

    it("warns on domain with suffix match rule (observe-only)", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn example.com and subdomains",
        enabled: true,
        priority: 1,
        pattern: "example.com",
        matchType: "suffix",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      // suffix match includes exact match and .{pattern}
      expect(pm.checkDomain("example.com").allowed).toBe(true);
      expect(pm.checkDomain("example.com").violations).toHaveLength(1);
      expect(pm.checkDomain("sub.example.com").allowed).toBe(true);
      expect(pm.checkDomain("sub.example.com").violations).toHaveLength(1);
      expect(pm.checkDomain("notexample.com").allowed).toBe(true);
      expect(pm.checkDomain("notexample.com").violations).toHaveLength(0);
    });

    it("warns on domain with prefix match rule (observe-only)", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn test-* domains",
        enabled: true,
        priority: 1,
        pattern: "test-",
        matchType: "prefix",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("test-site.com").allowed).toBe(true);
      expect(pm.checkDomain("test-site.com").violations).toHaveLength(1);
      expect(pm.checkDomain("mytest.com").allowed).toBe(true);
      expect(pm.checkDomain("mytest.com").violations).toHaveLength(0);
    });

    it("warns on domain with contains match rule (observe-only)", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn domains containing phishing",
        enabled: true,
        priority: 1,
        pattern: "phishing",
        matchType: "contains",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("my-phishing-site.com").allowed).toBe(true);
      expect(pm.checkDomain("my-phishing-site.com").violations).toHaveLength(1);
    });

    it("warns on domain with regex match rule (observe-only)", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn numeric domains",
        enabled: true,
        priority: 1,
        pattern: "^[0-9]+\\.com$",
        matchType: "regex",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("12345.com").allowed).toBe(true);
      expect(pm.checkDomain("12345.com").violations).toHaveLength(1);
      expect(pm.checkDomain("abc123.com").allowed).toBe(true);
      expect(pm.checkDomain("abc123.com").violations).toHaveLength(0);
    });

    it("handles invalid regex gracefully", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Invalid regex",
        enabled: true,
        priority: 1,
        pattern: "[invalid",
        matchType: "regex",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("test.com").allowed).toBe(true);
    });

    it("ignores disabled rules", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Disabled rule",
        enabled: false,
        priority: 1,
        pattern: "blocked.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("blocked.com").allowed).toBe(true);
    });

    it("creates warn violation without blocking", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Warn rule",
        enabled: true,
        priority: 1,
        pattern: "suspicious.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("suspicious.com");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].action).toBe("warn");
    });

    it("respects priority order", () => {
      const rules: DomainPolicyRule[] = [
        {
          id: "low",
          name: "Low priority",
          enabled: true,
          priority: 1,
          pattern: "test.com",
          matchType: "suffix",
          action: "warn",
        },
        {
          id: "high",
          name: "High priority",
          enabled: true,
          priority: 10,
          pattern: "test.com",
          matchType: "exact",
          action: "warn",
        },
      ];
      const pm = createPolicyManager(createTestConfig({ domainRules: rules }));
      const result = pm.checkDomain("test.com");
      expect(result.allowed).toBe(true);
      expect(result.violations[0].ruleId).toBe("high");
    });
  });

  describe("checkTool", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkTool("blocked.tool.com").allowed).toBe(true);
    });

    it("warns on tool matching pattern (observe-only)", () => {
      const rule: ToolPolicyRule = {
        id: "rule1",
        name: "Warn AI tools",
        enabled: true,
        priority: 1,
        patterns: ["openai.com", "anthropic.com"],
        category: "ai",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ toolRules: [rule] }));
      expect(pm.checkTool("api.openai.com").allowed).toBe(true);
      expect(pm.checkTool("api.openai.com").violations).toHaveLength(1);
      expect(pm.checkTool("claude.anthropic.com").allowed).toBe(true);
      expect(pm.checkTool("claude.anthropic.com").violations).toHaveLength(1);
      expect(pm.checkTool("google.com").allowed).toBe(true);
      expect(pm.checkTool("google.com").violations).toHaveLength(0);
    });
  });

  describe("checkAIService", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkAIService({ domain: "openai.com" }).allowed).toBe(true);
    });

    it("warns by provider (observe-only)", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn OpenAI",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "api.openai.com", provider: "openai" });
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matchedPattern).toBe("provider:openai");
    });

    it("warns by data types (observe-only)", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn credentials in AI",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "pii"],
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({
        domain: "openai.com",
        dataTypes: ["credentials"],
      });
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matchedPattern).toContain("data:");
    });

    it("warns all AI when no specific rules (observe-only)", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn all AI",
        enabled: true,
        priority: 1,
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "any-ai.com" });
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].matchedPattern).toBe("all_ai");
    });
  });

  describe("checkDataTransfer", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkDataTransfer({ destination: "external.com", sizeKB: 1000 }).allowed).toBe(true);
    });

    it("warns by size limit (observe-only)", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Warn large transfers",
        enabled: true,
        priority: 1,
        maxSizeKB: 100,
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 50 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 50 }).violations).toHaveLength(0);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 150 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 150 }).violations).toHaveLength(1);
    });

    it("warns by destination (observe-only)", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Warn external transfers",
        enabled: true,
        priority: 1,
        blockedDestinations: ["external.com", "suspicious.io"],
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "data.external.com", sizeKB: 10 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "data.external.com", sizeKB: 10 }).violations).toHaveLength(1);
      expect(pm.checkDataTransfer({ destination: "internal.com", sizeKB: 10 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "internal.com", sizeKB: 10 }).violations).toHaveLength(0);
    });

    it("warns on destinations not in whitelist (observe-only)", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Whitelist only",
        enabled: true,
        priority: 1,
        allowedDestinations: ["trusted.com", "internal.org"],
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "api.trusted.com", sizeKB: 10 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "api.trusted.com", sizeKB: 10 }).violations).toHaveLength(0);
      expect(pm.checkDataTransfer({ destination: "external.com", sizeKB: 10 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "external.com", sizeKB: 10 }).violations).toHaveLength(1);
    });
  });

  describe("rule management", () => {
    it("adds domain rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addDomainRule({
        id: "new1",
        name: "New rule",
        enabled: true,
        priority: 1,
        pattern: "blocked.com",
        matchType: "exact",
        action: "warn",
      });
      expect(pm.checkDomain("blocked.com").allowed).toBe(true);
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(1);
    });

    it("adds tool rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addToolRule({
        id: "new1",
        name: "New tool rule",
        enabled: true,
        priority: 1,
        patterns: ["blocked.tool.com"],
        category: "other",
        action: "warn",
      });
      expect(pm.checkTool("blocked.tool.com").allowed).toBe(true);
      expect(pm.checkTool("blocked.tool.com").violations).toHaveLength(1);
    });

    it("adds AI rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addAIRule({
        id: "new1",
        name: "New AI rule",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "warn",
      });
      expect(pm.checkAIService({ domain: "api.openai.com", provider: "openai" }).allowed).toBe(true);
      expect(pm.checkAIService({ domain: "api.openai.com", provider: "openai" }).violations).toHaveLength(1);
    });

    it("adds data transfer rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addDataTransferRule({
        id: "new1",
        name: "New transfer rule",
        enabled: true,
        priority: 1,
        maxSizeKB: 50,
        action: "warn",
      });
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).violations).toHaveLength(1);
    });

    it("removes rule", () => {
      const rule: DomainPolicyRule = {
        id: "removable",
        name: "Removable rule",
        enabled: true,
        priority: 1,
        pattern: "blocked.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(1);

      const removed = pm.removeRule("removable");
      expect(removed).toBe(true);
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(0);
    });

    it("returns false when removing non-existent rule", () => {
      const pm = createPolicyManager(createTestConfig());
      expect(pm.removeRule("non-existent")).toBe(false);
    });

    it("toggles rule enabled state", () => {
      const rule: DomainPolicyRule = {
        id: "toggleable",
        name: "Toggleable rule",
        enabled: true,
        priority: 1,
        pattern: "blocked.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(1);

      pm.toggleRule("toggleable", false);
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(0);

      pm.toggleRule("toggleable", true);
      expect(pm.checkDomain("blocked.com").violations).toHaveLength(1);
    });

    it("returns false when toggling non-existent rule", () => {
      const pm = createPolicyManager(createTestConfig());
      expect(pm.toggleRule("non-existent", true)).toBe(false);
    });
  });

  describe("violation details", () => {
    it("includes rule details in violation", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Test Rule",
        enabled: true,
        priority: 1,
        pattern: "test.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("test.com");

      expect(result.violations[0].ruleId).toBe("rule1");
      expect(result.violations[0].ruleName).toBe("Test Rule");
      expect(result.violations[0].ruleType).toBe("domain");
      expect(result.violations[0].matchedPattern).toBe("test.com");
      expect(result.violations[0].target).toBe("test.com");
      expect(result.violations[0].timestamp).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty domain string", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Test rule",
        enabled: true,
        priority: 1,
        pattern: "",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
    });

    it("handles case-sensitive domain matching", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Test rule",
        enabled: true,
        priority: 1,
        pattern: "Example.com",
        matchType: "exact",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      // Pattern matching is case-insensitive
      expect(pm.checkDomain("Example.com").allowed).toBe(true);
      expect(pm.checkDomain("Example.com").violations).toHaveLength(1);
    });

    it("multiple violations from different rules", () => {
      const rules: DomainPolicyRule[] = [
        {
          id: "rule1",
          name: "First rule",
          enabled: true,
          priority: 1,
          pattern: "test",
          matchType: "contains",
          action: "warn",
        },
        {
          id: "rule2",
          name: "Second rule",
          enabled: true,
          priority: 2,
          pattern: "test.com",
          matchType: "suffix",
          action: "warn",
        },
      ];
      const pm = createPolicyManager(createTestConfig({ domainRules: rules }));
      const result = pm.checkDomain("test.com");
      expect(result.violations.length).toBeGreaterThan(1);
    });

    it("handles very long domain names", () => {
      const longDomain = "a".repeat(255) + ".com";
      const pm = createPolicyManager(createTestConfig());
      const result = pm.checkDomain(longDomain);
      expect(result.allowed).toBe(true);
    });

    it("handles international domain names (IDN)", () => {
      const pm = createPolicyManager(createTestConfig());
      const result = pm.checkDomain("münchen.de");
      expect(result.allowed).toBe(true);
    });

    it("handles tool check with null/undefined", () => {
      const rule: ToolPolicyRule = {
        id: "rule1",
        name: "Test rule",
        enabled: true,
        priority: 1,
        patterns: ["blocked.com"],
        category: "other",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ toolRules: [rule] }));
      const resultNull = pm.checkTool(null as unknown as string);
      const resultUndef = pm.checkTool(undefined as unknown as string);
      expect(resultNull).toBeDefined();
      expect(resultUndef).toBeDefined();
    });

    it("handles AI check with partial provider match", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn OpenAI",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "api.openai.com" });
      expect(result.allowed).toBe(true); // provider not specified
    });

    it("handles data transfer at exact size boundary", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Warn large transfers",
        enabled: true,
        priority: 1,
        maxSizeKB: 100,
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).violations).toHaveLength(0);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 101 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 101 }).violations).toHaveLength(1);
    });

    it("handles multiple AI data types match", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn sensitive data",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "pii", "financial"],
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({
        domain: "openai.com",
        dataTypes: ["credentials", "pii"],
      });
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(1);
    });

    it("allows when AI check has only non-blocked data types", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Warn sensitive data",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "financial"],
        action: "warn",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({
        domain: "openai.com",
        dataTypes: ["email"],
      });
      expect(result.allowed).toBe(true);
    });
  });
});
