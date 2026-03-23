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

    it("blocks domain with exact match rule", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Block malicious.com",
        enabled: true,
        priority: 1,
        pattern: "malicious.com",
        matchType: "exact",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("malicious.com");
      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].action).toBe("block");
    });

    it("blocks domain with suffix match rule", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Block example.com and subdomains",
        enabled: true,
        priority: 1,
        pattern: "example.com",
        matchType: "suffix",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      // suffix match includes exact match and .{pattern}
      expect(pm.checkDomain("example.com").allowed).toBe(false);
      expect(pm.checkDomain("sub.example.com").allowed).toBe(false);
      expect(pm.checkDomain("notexample.com").allowed).toBe(true);
    });

    it("blocks domain with prefix match rule", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Block test-* domains",
        enabled: true,
        priority: 1,
        pattern: "test-",
        matchType: "prefix",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("test-site.com").allowed).toBe(false);
      expect(pm.checkDomain("mytest.com").allowed).toBe(true);
    });

    it("blocks domain with contains match rule", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Block domains containing phishing",
        enabled: true,
        priority: 1,
        pattern: "phishing",
        matchType: "contains",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("my-phishing-site.com").allowed).toBe(false);
    });

    it("blocks domain with regex match rule", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Block numeric domains",
        enabled: true,
        priority: 1,
        pattern: "^[0-9]+\\.com$",
        matchType: "regex",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("12345.com").allowed).toBe(false);
      expect(pm.checkDomain("abc123.com").allowed).toBe(true);
    });

    it("handles invalid regex gracefully", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Invalid regex",
        enabled: true,
        priority: 1,
        pattern: "[invalid",
        matchType: "regex",
        action: "block",
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
        action: "block",
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
          action: "block",
        },
      ];
      const pm = createPolicyManager(createTestConfig({ domainRules: rules }));
      const result = pm.checkDomain("test.com");
      expect(result.allowed).toBe(false);
      expect(result.violations[0].ruleId).toBe("high");
    });
  });

  describe("checkTool", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkTool("blocked.tool.com").allowed).toBe(true);
    });

    it("blocks tool matching pattern", () => {
      const rule: ToolPolicyRule = {
        id: "rule1",
        name: "Block AI tools",
        enabled: true,
        priority: 1,
        patterns: ["openai.com", "anthropic.com"],
        category: "ai",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ toolRules: [rule] }));
      expect(pm.checkTool("api.openai.com").allowed).toBe(false);
      expect(pm.checkTool("claude.anthropic.com").allowed).toBe(false);
      expect(pm.checkTool("google.com").allowed).toBe(true);
    });
  });

  describe("checkAIService", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkAIService({ domain: "openai.com" }).allowed).toBe(true);
    });

    it("blocks by provider", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Block OpenAI",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "api.openai.com", provider: "openai" });
      expect(result.allowed).toBe(false);
      expect(result.violations[0].matchedPattern).toBe("provider:openai");
    });

    it("blocks by data types", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Block credentials in AI",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "pii"],
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({
        domain: "openai.com",
        dataTypes: ["credentials"],
      });
      expect(result.allowed).toBe(false);
      expect(result.violations[0].matchedPattern).toContain("data:");
    });

    it("blocks all AI when no specific rules", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Block all AI",
        enabled: true,
        priority: 1,
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "any-ai.com" });
      expect(result.allowed).toBe(false);
      expect(result.violations[0].matchedPattern).toBe("all_ai");
    });
  });

  describe("checkDataTransfer", () => {
    it("allows all when disabled", () => {
      const pm = createPolicyManager(createTestConfig({ enabled: false }));
      expect(pm.checkDataTransfer({ destination: "external.com", sizeKB: 1000 }).allowed).toBe(true);
    });

    it("blocks by size limit", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Block large transfers",
        enabled: true,
        priority: 1,
        maxSizeKB: 100,
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 50 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 150 }).allowed).toBe(false);
    });

    it("blocks by destination", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Block external transfers",
        enabled: true,
        priority: 1,
        blockedDestinations: ["external.com", "suspicious.io"],
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "data.external.com", sizeKB: 10 }).allowed).toBe(false);
      expect(pm.checkDataTransfer({ destination: "internal.com", sizeKB: 10 }).allowed).toBe(true);
    });

    it("blocks destinations not in whitelist", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Whitelist only",
        enabled: true,
        priority: 1,
        allowedDestinations: ["trusted.com", "internal.org"],
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "api.trusted.com", sizeKB: 10 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "external.com", sizeKB: 10 }).allowed).toBe(false);
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
        action: "block",
      });
      expect(pm.checkDomain("blocked.com").allowed).toBe(false);
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
        action: "block",
      });
      expect(pm.checkTool("blocked.tool.com").allowed).toBe(false);
    });

    it("adds AI rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addAIRule({
        id: "new1",
        name: "New AI rule",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "block",
      });
      expect(pm.checkAIService({ domain: "api.openai.com", provider: "openai" }).allowed).toBe(false);
    });

    it("adds data transfer rule", () => {
      const pm = createPolicyManager(createTestConfig());
      pm.addDataTransferRule({
        id: "new1",
        name: "New transfer rule",
        enabled: true,
        priority: 1,
        maxSizeKB: 50,
        action: "block",
      });
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).allowed).toBe(false);
    });

    it("removes rule", () => {
      const rule: DomainPolicyRule = {
        id: "removable",
        name: "Removable rule",
        enabled: true,
        priority: 1,
        pattern: "blocked.com",
        matchType: "exact",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("blocked.com").allowed).toBe(false);

      const removed = pm.removeRule("removable");
      expect(removed).toBe(true);
      expect(pm.checkDomain("blocked.com").allowed).toBe(true);
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
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      expect(pm.checkDomain("blocked.com").allowed).toBe(false);

      pm.toggleRule("toggleable", false);
      expect(pm.checkDomain("blocked.com").allowed).toBe(true);

      pm.toggleRule("toggleable", true);
      expect(pm.checkDomain("blocked.com").allowed).toBe(false);
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
        action: "block",
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
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      const result = pm.checkDomain("");
      expect(result.allowed).toBe(false);
    });

    it("handles case-sensitive domain matching", () => {
      const rule: DomainPolicyRule = {
        id: "rule1",
        name: "Test rule",
        enabled: true,
        priority: 1,
        pattern: "Example.com",
        matchType: "exact",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ domainRules: [rule] }));
      // Pattern matching is case-sensitive
      expect(pm.checkDomain("Example.com").allowed).toBe(false);
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
        action: "block",
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
        name: "Block OpenAI",
        enabled: true,
        priority: 1,
        provider: "openai",
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({ domain: "api.openai.com" });
      expect(result.allowed).toBe(true); // provider not specified
    });

    it("handles data transfer at exact size boundary", () => {
      const rule: DataTransferPolicyRule = {
        id: "rule1",
        name: "Block large transfers",
        enabled: true,
        priority: 1,
        maxSizeKB: 100,
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ dataTransferRules: [rule] }));
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 100 }).allowed).toBe(true);
      expect(pm.checkDataTransfer({ destination: "any.com", sizeKB: 101 }).allowed).toBe(false);
    });

    it("handles multiple AI data types match", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Block sensitive data",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "pii", "financial"],
        action: "block",
      };
      const pm = createPolicyManager(createTestConfig({ aiRules: [rule] }));
      const result = pm.checkAIService({
        domain: "openai.com",
        dataTypes: ["credentials", "pii"],
      });
      expect(result.allowed).toBe(false);
    });

    it("allows when AI check has only non-blocked data types", () => {
      const rule: AIPolicyRule = {
        id: "rule1",
        name: "Block sensitive data",
        enabled: true,
        priority: 1,
        blockedDataTypes: ["credentials", "financial"],
        action: "block",
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
