import { describe, it, expect } from "vitest";
import {
  createPolicyGenerator,
  type PolicyGenerationInput,
  type AIUsageData,
  type DLPDetectionData,
  type ExtensionRiskData,
  type DomainVisitData,
} from "./policy-generator.js";

describe("createPolicyGenerator", () => {
  describe("basic functionality", () => {
    it("creates policy generator", () => {
      const generator = createPolicyGenerator();
      expect(generator).toBeDefined();
      expect(generator.generate).toBeDefined();
    });

    it("generates empty result for empty input", () => {
      const generator = createPolicyGenerator();
      const result = generator.generate({});
      expect(result.rules.length).toBe(0);
      expect(result.summary.totalSuggestions).toBe(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe("AI policies", () => {
    it("generates policy for unknown AI providers", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          {
            provider: "unknown",
            domain: "unknown-ai.com",
            promptCount: 10,
            hasSensitiveData: false,
            riskLevel: "medium",
          },
        ],
      };
      const result = generator.generate(input);
      const unknownRule = result.rules.find((r) => r.id === "ai-unknown-provider");
      expect(unknownRule).toBeDefined();
      expect(unknownRule?.severity).toBe("high");
      expect(unknownRule?.action).toBe("alert");
      expect(unknownRule?.category).toBe("ai_usage");
    });

    it("generates policy for non-approved providers", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          {
            provider: "cohere",
            domain: "cohere.ai",
            promptCount: 5,
            hasSensitiveData: false,
            riskLevel: "low",
          },
        ],
      };
      const result = generator.generate(input);
      const unknownRule = result.rules.find((r) => r.id === "ai-unknown-provider");
      expect(unknownRule).toBeDefined();
    });

    it("does not generate unknown provider policy for approved providers", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          {
            provider: "openai",
            domain: "chat.openai.com",
            promptCount: 10,
            hasSensitiveData: false,
            riskLevel: "low",
          },
          {
            provider: "anthropic",
            domain: "claude.ai",
            promptCount: 5,
            hasSensitiveData: false,
            riskLevel: "low",
          },
        ],
      };
      const result = generator.generate(input);
      const unknownRule = result.rules.find((r) => r.id === "ai-unknown-provider");
      expect(unknownRule).toBeUndefined();
    });

    it("generates policy for sensitive data in AI prompts", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          {
            provider: "openai",
            domain: "chat.openai.com",
            promptCount: 10,
            hasSensitiveData: true,
            riskLevel: "high",
          },
        ],
      };
      const result = generator.generate(input);
      const sensitiveRule = result.rules.find((r) => r.id === "ai-sensitive-data");
      expect(sensitiveRule).toBeDefined();
      expect(sensitiveRule?.severity).toBe("critical");
      expect(sensitiveRule?.action).toBe("warn");
    });

    it("generates policy for regional AI providers", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          {
            provider: "deepseek",
            domain: "deepseek.com",
            promptCount: 10,
            hasSensitiveData: false,
            riskLevel: "medium",
          },
        ],
      };
      const result = generator.generate(input);
      const regionalRule = result.rules.find((r) => r.id === "ai-regional-provider");
      expect(regionalRule).toBeDefined();
      expect(regionalRule?.severity).toBe("medium");
      expect(regionalRule?.action).toBe("log");
    });

    it("includes multiple domains in reason for unknown providers", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai1.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
          { provider: "unknown", domain: "ai2.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
          { provider: "unknown", domain: "ai3.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
          { provider: "unknown", domain: "ai4.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
        ],
      };
      const result = generator.generate(input);
      const unknownRule = result.rules.find((r) => r.id === "ai-unknown-provider");
      expect(unknownRule?.reason).toContain("...");
    });
  });

  describe("DLP policies", () => {
    it("generates policy for credentials detection", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        dlpDetections: [
          {
            classification: "credentials",
            detectionCount: 5,
            highConfidenceCount: 3,
            affectedDomains: ["example.com"],
          },
        ],
      };
      const result = generator.generate(input);
      const credRule = result.rules.find((r) => r.id === "dlp-credentials");
      expect(credRule).toBeDefined();
      expect(credRule?.severity).toBe("critical");
      expect(credRule?.action).toBe("block");
      expect(credRule?.category).toBe("data_protection");
    });

    it("generates policy for financial data detection", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        dlpDetections: [
          {
            classification: "financial",
            detectionCount: 3,
            highConfidenceCount: 2,
            affectedDomains: ["shop.example.com"],
          },
        ],
      };
      const result = generator.generate(input);
      const finRule = result.rules.find((r) => r.id === "dlp-financial");
      expect(finRule).toBeDefined();
      expect(finRule?.severity).toBe("high");
      expect(finRule?.action).toBe("warn");
    });

    it("generates policy for PII detection", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        dlpDetections: [
          {
            classification: "pii",
            detectionCount: 10,
            highConfidenceCount: 5,
            affectedDomains: ["site1.com", "site2.com"],
          },
        ],
      };
      const result = generator.generate(input);
      const piiRule = result.rules.find((r) => r.id === "dlp-pii");
      expect(piiRule).toBeDefined();
      expect(piiRule?.severity).toBe("medium");
      expect(piiRule?.action).toBe("alert");
      expect(piiRule?.reason).toContain("2ドメイン");
    });

    it("sums detection counts for credentials", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        dlpDetections: [
          { classification: "credentials", detectionCount: 5, highConfidenceCount: 3, affectedDomains: ["a.com"] },
          { classification: "credentials", detectionCount: 3, highConfidenceCount: 2, affectedDomains: ["b.com"] },
        ],
      };
      const result = generator.generate(input);
      const credRule = result.rules.find((r) => r.id === "dlp-credentials");
      expect(credRule?.reason).toContain("8件");
    });
  });

  describe("extension policies", () => {
    it("generates policy for critical risk extensions", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        extensionRisks: [
          {
            extensionId: "ext-critical",
            extensionName: "Dangerous Extension",
            riskScore: 95,
            riskLevel: "critical",
            flags: ["excessive_permissions", "network_abuse"],
          },
        ],
      };
      const result = generator.generate(input);
      const extRule = result.rules.find((r) => r.id === "ext-ext-critical");
      expect(extRule).toBeDefined();
      expect(extRule?.severity).toBe("critical");
      expect(extRule?.action).toBe("alert");
      expect(extRule?.category).toBe("extension");
    });

    it("generates policy for high risk extensions", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        extensionRisks: [
          {
            extensionId: "ext-high",
            extensionName: "Risky Extension",
            riskScore: 75,
            riskLevel: "high",
            flags: ["sensitive_permissions"],
          },
        ],
      };
      const result = generator.generate(input);
      const extRule = result.rules.find((r) => r.id === "ext-ext-high");
      expect(extRule).toBeDefined();
      expect(extRule?.severity).toBe("high");
    });

    it("limits extension policies to 3", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        extensionRisks: [
          { extensionId: "ext1", extensionName: "Ext1", riskScore: 90, riskLevel: "critical", flags: [] },
          { extensionId: "ext2", extensionName: "Ext2", riskScore: 85, riskLevel: "critical", flags: [] },
          { extensionId: "ext3", extensionName: "Ext3", riskScore: 80, riskLevel: "high", flags: [] },
          { extensionId: "ext4", extensionName: "Ext4", riskScore: 75, riskLevel: "high", flags: [] },
          { extensionId: "ext5", extensionName: "Ext5", riskScore: 70, riskLevel: "high", flags: [] },
        ],
      };
      const result = generator.generate(input);
      const extRules = result.rules.filter((r) => r.category === "extension");
      expect(extRules.length).toBe(3);
    });

    it("does not generate policies for medium/low risk extensions", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        extensionRisks: [
          { extensionId: "ext-med", extensionName: "Medium", riskScore: 50, riskLevel: "medium", flags: [] },
          { extensionId: "ext-low", extensionName: "Low", riskScore: 20, riskLevel: "low", flags: [] },
        ],
      };
      const result = generator.generate(input);
      const extRules = result.rules.filter((r) => r.category === "extension");
      expect(extRules.length).toBe(0);
    });

    it("includes flags in description", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        extensionRisks: [
          {
            extensionId: "ext1",
            extensionName: "Bad Extension",
            riskScore: 90,
            riskLevel: "critical",
            flags: ["flag1", "flag2", "flag3"],
          },
        ],
      };
      const result = generator.generate(input);
      const extRule = result.rules.find((r) => r.id === "ext-ext1");
      expect(extRule?.description).toContain("flag1");
      expect(extRule?.description).toContain("flag2");
      // Only first 2 flags included
      expect(extRule?.description).not.toContain("flag3");
    });
  });

  describe("domain policies", () => {
    it("generates policy for NRD with login", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        domainVisits: [
          {
            domain: "new-site.xyz",
            visitCount: 1,
            hasLogin: true,
            isNRD: true,
            isTyposquat: false,
          },
        ],
      };
      const result = generator.generate(input);
      const nrdRule = result.rules.find((r) => r.id === "domain-nrd-login");
      expect(nrdRule).toBeDefined();
      expect(nrdRule?.severity).toBe("high");
      expect(nrdRule?.action).toBe("warn");
      expect(nrdRule?.category).toBe("domain");
    });

    it("does not generate NRD policy without login", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        domainVisits: [
          {
            domain: "new-site.xyz",
            visitCount: 5,
            hasLogin: false,
            isNRD: true,
            isTyposquat: false,
          },
        ],
      };
      const result = generator.generate(input);
      const nrdRule = result.rules.find((r) => r.id === "domain-nrd-login");
      expect(nrdRule).toBeUndefined();
    });

    it("generates policy for typosquatting domains", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        domainVisits: [
          {
            domain: "g00gle.com",
            visitCount: 1,
            hasLogin: false,
            isNRD: false,
            isTyposquat: true,
          },
        ],
      };
      const result = generator.generate(input);
      const typosquatRule = result.rules.find((r) => r.id === "domain-typosquat");
      expect(typosquatRule).toBeDefined();
      expect(typosquatRule?.severity).toBe("critical");
      expect(typosquatRule?.action).toBe("block");
    });

    it("includes all typosquat domains in condition", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        domainVisits: [
          { domain: "g00gle.com", visitCount: 1, hasLogin: false, isNRD: false, isTyposquat: true },
          { domain: "faceb00k.com", visitCount: 1, hasLogin: false, isNRD: false, isTyposquat: true },
        ],
      };
      const result = generator.generate(input);
      const typosquatRule = result.rules.find((r) => r.id === "domain-typosquat");
      expect(typosquatRule?.condition.value).toContain("g00gle.com");
      expect(typosquatRule?.condition.value).toContain("faceb00k.com");
    });
  });

  describe("summary", () => {
    it("counts rules by category", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: true, riskLevel: "high" },
        ],
        dlpDetections: [
          { classification: "credentials", detectionCount: 1, highConfidenceCount: 1, affectedDomains: [] },
        ],
      };
      const result = generator.generate(input);
      expect(result.summary.byCategoryCount.ai_usage).toBeGreaterThan(0);
      expect(result.summary.byCategoryCount.data_protection).toBeGreaterThan(0);
    });

    it("counts rules by action", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
        ],
        dlpDetections: [
          { classification: "credentials", detectionCount: 1, highConfidenceCount: 1, affectedDomains: [] },
        ],
      };
      const result = generator.generate(input);
      expect(result.summary.byActionCount.alert).toBeGreaterThan(0);
      expect(result.summary.byActionCount.block).toBeGreaterThan(0);
    });

    it("counts high priority rules", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: true, riskLevel: "high" },
        ],
        dlpDetections: [
          { classification: "credentials", detectionCount: 1, highConfidenceCount: 1, affectedDomains: [] },
        ],
      };
      const result = generator.generate(input);
      // Both unknown provider (high) and sensitive data (critical) and credentials (critical) are high priority
      expect(result.summary.highPriorityCount).toBeGreaterThanOrEqual(2);
    });

    it("calculates total suggestions", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: true, riskLevel: "high" },
          { provider: "deepseek", domain: "deepseek.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
        ],
      };
      const result = generator.generate(input);
      expect(result.summary.totalSuggestions).toBe(result.rules.length);
    });
  });

  describe("combined inputs", () => {
    it("generates policies from all input types", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: false, riskLevel: "low" },
        ],
        dlpDetections: [
          { classification: "pii", detectionCount: 1, highConfidenceCount: 1, affectedDomains: ["a.com"] },
        ],
        extensionRisks: [
          { extensionId: "ext1", extensionName: "Ext", riskScore: 90, riskLevel: "critical", flags: [] },
        ],
        domainVisits: [
          { domain: "bad.com", visitCount: 1, hasLogin: false, isNRD: false, isTyposquat: true },
        ],
      };
      const result = generator.generate(input);
      expect(result.summary.byCategoryCount.ai_usage).toBeGreaterThan(0);
      expect(result.summary.byCategoryCount.data_protection).toBeGreaterThan(0);
      expect(result.summary.byCategoryCount.extension).toBeGreaterThan(0);
      expect(result.summary.byCategoryCount.domain).toBeGreaterThan(0);
    });

    it("all rules have required fields", () => {
      const generator = createPolicyGenerator();
      const input: PolicyGenerationInput = {
        aiUsage: [
          { provider: "unknown", domain: "ai.com", promptCount: 1, hasSensitiveData: true, riskLevel: "high" },
        ],
        dlpDetections: [
          { classification: "credentials", detectionCount: 1, highConfidenceCount: 1, affectedDomains: [] },
        ],
      };
      const result = generator.generate(input);
      for (const rule of result.rules) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.action).toBeDefined();
        expect(rule.condition).toBeDefined();
        expect(rule.enabled).toBe(true);
        expect(rule.autoGenerated).toBe(true);
        expect(rule.confidence).toBeDefined();
        expect(rule.reason).toBeDefined();
      }
    });
  });
});
