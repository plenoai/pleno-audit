import { describe, it, expect } from "vitest";
import {
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type SensitiveDataResult,
} from "./dlp-rules.js";
import {
  analyzePromptPII,
  calculatePromptRiskScore,
  analyzePrompt,
} from "./pii-analyzer.js";

describe("detectSensitiveData", () => {
  describe("credentials detection", () => {
    it("detects API keys", () => {
      const text = "api_key: sk-abc123def456ghi789jkl0mnopqrstuvwxyz";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "credentials")).toBe(true);
      expect(results.some((r) => r.pattern === "API Key")).toBe(true);
    });

    it("detects OpenAI API keys", () => {
      const text = "OPENAI_KEY=sk-12345678901234567890123456789012";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "OpenAI API Key")).toBe(true);
    });

    it("detects Anthropic API keys", () => {
      const text =
        "sk-ant-" + "a".repeat(80);
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Anthropic API Key")).toBe(true);
    });

    it("detects GitHub tokens", () => {
      const text = "ghp_" + "a".repeat(36);
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "GitHub Token")).toBe(true);
    });

    it("detects AWS access keys", () => {
      const text = "AKIAIOSFODNN7EXAMPLE";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "AWS Access Key")).toBe(true);
    });

    it("detects private keys", () => {
      const text = "-----BEGIN RSA PRIVATE KEY-----\nMIIBog...";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Private Key")).toBe(true);
    });

    it("detects passwords", () => {
      const text = 'password: "MySecretPassword123!"';
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Password")).toBe(true);
    });
  });

  describe("PII detection", () => {
    it("detects email addresses", () => {
      const text = "連絡先: user@example.com";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Email Address")).toBe(true);
    });

    it("detects US phone numbers", () => {
      const text = "電話: 555-123-4567";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "US Phone Number")).toBe(true);
    });

    it("detects Japanese phone numbers", () => {
      const text = "電話: 090-1234-5678";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "JP Phone Number")).toBe(true);
    });

    it("detects possible SSN", () => {
      const text = "SSN: 123-45-6789";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Possible SSN")).toBe(true);
    });
  });

  describe("financial detection", () => {
    it("detects credit card numbers (Visa)", () => {
      const text = "カード: 4111111111111111";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects credit card numbers (Mastercard)", () => {
      const text = "カード: 5500000000000004";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects bank account numbers", () => {
      const text = "口座番号: 1234567890";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Bank Account")).toBe(true);
    });
  });

  describe("health detection", () => {
    it("detects medical records", () => {
      const text = "診断: ABC-12345";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "health")).toBe(true);
    });

    it("detects insurance numbers", () => {
      const text = "保険証番号: 12345678901";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Insurance Number")).toBe(true);
    });
  });

  describe("code detection", () => {
    it("detects source code", () => {
      const text = "function calculateTotal() {";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Source Code")).toBe(true);
    });

    it("detects SQL queries", () => {
      const text = "INSERT INTO users VALUES (1)";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "SQL Query")).toBe(true);
    });

    it("detects import statements", () => {
      const text = 'import { useState } from "react"';
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.pattern === "Import Statement")).toBe(true);
    });
  });

  describe("internal detection", () => {
    it("detects confidential markers", () => {
      const text = "This document is confidential";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "internal")).toBe(true);
    });

    it("detects Japanese confidential markers", () => {
      const text = "この情報は社内限りです";
      const results = detectSensitiveData(text);
      expect(results.some((r) => r.classification === "internal")).toBe(true);
    });
  });

  it("returns empty array for clean text", () => {
    const text = "Hello, this is a normal message without sensitive data.";
    const results = detectSensitiveData(text);
    expect(results.length).toBe(0);
  });

  it("masks sensitive text in results", () => {
    const text = "email: user@example.com";
    const results = detectSensitiveData(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchedText).not.toBe("user@example.com");
    expect(results[0].matchedText).toContain("*");
  });
});

describe("hasSensitiveData", () => {
  it("returns true when sensitive data is present", () => {
    expect(hasSensitiveData("api_key: sk-12345678901234567890")).toBe(true);
    expect(hasSensitiveData("email: user@example.com")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(hasSensitiveData("Hello world")).toBe(false);
    expect(hasSensitiveData("This is a regular message")).toBe(false);
  });
});

describe("getHighestRiskClassification", () => {
  it("returns credentials as highest priority", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "high", pattern: "Email" },
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "code", confidence: "low", pattern: "Source Code" },
    ];
    expect(getHighestRiskClassification(results)).toBe("credentials");
  });

  it("returns financial over pii", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "high", pattern: "Email" },
      { classification: "financial", confidence: "high", pattern: "Card" },
    ];
    expect(getHighestRiskClassification(results)).toBe("financial");
  });

  it("returns null for empty results", () => {
    expect(getHighestRiskClassification([])).toBeNull();
  });
});

describe("getSensitiveDataSummary", () => {
  it("counts detections by classification", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "high", pattern: "Email" },
      { classification: "pii", confidence: "high", pattern: "Phone" },
      { classification: "credentials", confidence: "high", pattern: "API Key" },
    ];
    const summary = getSensitiveDataSummary(results);
    expect(summary.pii).toBe(2);
    expect(summary.credentials).toBe(1);
    expect(summary.financial).toBe(0);
  });

  it("returns zero counts for empty results", () => {
    const summary = getSensitiveDataSummary([]);
    expect(summary.pii).toBe(0);
    expect(summary.credentials).toBe(0);
  });
});

describe("analyzePromptPII", () => {
  it("analyzes chat completion messages", () => {
    const prompt = {
      messages: [
        { role: "user", content: "My email is user@example.com" },
      ],
    };
    const result = analyzePromptPII(prompt);
    expect(result.hasSensitiveData).toBe(true);
    expect(result.classifications).toContain("pii");
  });

  it("analyzes completion text", () => {
    const prompt = {
      text: "Please process payment for card 4111111111111111",
    };
    const result = analyzePromptPII(prompt);
    expect(result.hasSensitiveData).toBe(true);
    expect(result.classifications).toContain("financial");
  });

  it("analyzes raw body when no messages or text", () => {
    const prompt = {
      rawBody: '{"content": "api_key: sk-12345678901234567890"}',
    };
    const result = analyzePromptPII(prompt);
    expect(result.hasSensitiveData).toBe(true);
    expect(result.classifications).toContain("credentials");
  });

  it("returns empty result for safe prompt", () => {
    const prompt = {
      messages: [{ role: "user", content: "What is the weather today?" }],
    };
    const result = analyzePromptPII(prompt);
    expect(result.hasSensitiveData).toBe(false);
    expect(result.classifications).toHaveLength(0);
    expect(result.detectionCount).toBe(0);
  });

  it("returns empty result for empty prompt", () => {
    const prompt = {};
    const result = analyzePromptPII(prompt);
    expect(result.hasSensitiveData).toBe(false);
  });
});

describe("calculatePromptRiskScore", () => {
  it("returns 0 for no sensitive data", () => {
    const piiResult = {
      hasSensitiveData: false,
      classifications: [],
      highestRisk: null,
      detectionCount: 0,
      details: [],
    };
    expect(calculatePromptRiskScore(piiResult)).toBe(0);
  });

  it("returns high score for credentials", () => {
    const piiResult = {
      hasSensitiveData: true,
      classifications: ["credentials"] as const,
      highestRisk: "credentials" as const,
      detectionCount: 1,
      details: [],
    };
    const score = calculatePromptRiskScore(piiResult as any);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("caps score at 100", () => {
    const piiResult = {
      hasSensitiveData: true,
      classifications: ["credentials", "financial", "pii", "health"] as const,
      highestRisk: "credentials" as const,
      detectionCount: 20,
      details: [],
    };
    const score = calculatePromptRiskScore(piiResult as any);
    expect(score).toBe(100);
  });

  it("increases score with detection count", () => {
    const piiResult1 = {
      hasSensitiveData: true,
      classifications: ["pii"] as const,
      highestRisk: "pii" as const,
      detectionCount: 1,
      details: [],
    };
    const piiResult2 = {
      hasSensitiveData: true,
      classifications: ["pii"] as const,
      highestRisk: "pii" as const,
      detectionCount: 5,
      details: [],
    };
    const score1 = calculatePromptRiskScore(piiResult1 as any);
    const score2 = calculatePromptRiskScore(piiResult2 as any);
    expect(score2).toBeGreaterThan(score1);
  });
});

describe("analyzePrompt", () => {
  it("returns low risk for safe prompt", () => {
    const prompt = {
      messages: [{ role: "user", content: "What is 2 + 2?" }],
    };
    const { risk } = analyzePrompt(prompt);
    expect(risk.riskScore).toBe(0);
    expect(risk.riskLevel).toBe("info");
    expect(risk.shouldAlert).toBe(false);
  });

  it("returns high risk for credentials", () => {
    const prompt = {
      messages: [{ role: "user", content: "API key: sk-12345678901234567890123456789012" }],
    };
    const { risk } = analyzePrompt(prompt);
    expect(risk.riskScore).toBeGreaterThanOrEqual(60);
    expect(risk.factors.credentialsDetected).toBe(true);
    expect(risk.shouldAlert).toBe(true);
  });

  it("sets correct factor flags", () => {
    const prompt = {
      text: "Email: user@example.com, Card: 4111111111111111",
    };
    const { risk } = analyzePrompt(prompt);
    expect(risk.factors.piiDetected).toBe(true);
    expect(risk.factors.financialDetected).toBe(true);
    expect(risk.factors.credentialsDetected).toBe(false);
  });
});

describe("analyzePrompt - complete analysis", () => {
  it("returns complete analysis result", () => {
    const prompt = {
      messages: [
        { role: "user", content: "API key: sk-12345678901234567890123456789012" },
      ],
    };
    const result = analyzePrompt(prompt);

    expect(result.pii).toBeDefined();
    expect(result.pii.hasSensitiveData).toBe(true);

    expect(result.risk).toBeDefined();
    expect(result.risk.riskScore).toBeGreaterThan(0);
    expect(result.risk.factors.credentialsDetected).toBe(true);
  });

  it("returns safe analysis for clean prompt", () => {
    const prompt = {
      text: "Tell me about machine learning",
    };
    const result = analyzePrompt(prompt);

    expect(result.pii.hasSensitiveData).toBe(false);
    expect(result.risk.riskScore).toBe(0);
    expect(result.risk.riskLevel).toBe("info");
    expect(result.risk.shouldAlert).toBe(false);
  });
});
