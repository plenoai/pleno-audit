import { describe, it, expect } from "vitest";
import {
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type DataClassification,
  type SensitiveDataResult,
} from "./dlp-rules.js";

describe("detectSensitiveData", () => {
  describe("credentials detection", () => {
    it("detects API key pattern", () => {
      const text = 'const apiKey = "sk-1234567890abcdefghijklmnopqrstuv"';
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "credentials")).toBe(true);
    });

    it("detects OpenAI API key", () => {
      const text = "sk-abcdefghijklmnopqrstuvwxyz123456";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "OpenAI API Key")).toBe(true);
    });

    it("detects Anthropic API key", () => {
      const text = "sk-ant-" + "a".repeat(80);
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Anthropic API Key")).toBe(true);
    });

    it("detects GitHub personal access token", () => {
      const text = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "GitHub Token")).toBe(true);
    });

    it("detects GitHub OAuth token", () => {
      const text = "gho_abcdefghijklmnopqrstuvwxyz1234567890";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "GitHub OAuth Token")).toBe(true);
    });

    it("detects AWS access key", () => {
      const text = "AKIAIOSFODNN7EXAMPLE";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "AWS Access Key")).toBe(true);
    });

    it("detects private key header", () => {
      const text = "-----BEGIN RSA PRIVATE KEY-----";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Private Key")).toBe(true);
    });

    it("detects password in text", () => {
      const text = 'password: "supersecret123"';
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Password")).toBe(true);
    });
  });

  describe("PII detection", () => {
    it("detects email address", () => {
      const text = "Contact me at john.doe@example.com";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Email Address")).toBe(true);
    });

    it("detects US phone number", () => {
      const text = "Call me at 555-123-4567";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "US Phone Number")).toBe(true);
    });

    it("detects Japanese phone number", () => {
      const text = "電話番号: 090-1234-5678";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "JP Phone Number")).toBe(true);
    });

    it("detects SSN pattern", () => {
      const text = "SSN: 123-45-6789";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Possible SSN")).toBe(true);
    });

    it("detects physical address", () => {
      // Pattern requires 10-50 chars between 住所/address and ending marker (市|区|町|村|県|都|道|府|street|ave|road|st.|dr.)
      const text = "住所: 東京都品川区東五反田1-2-3区";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Physical Address")).toBe(true);
    });
  });

  describe("financial detection", () => {
    it("detects Visa credit card number", () => {
      const text = "Card: 4111111111111111";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects MasterCard number", () => {
      const text = "Card: 5500000000000004";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects Amex card number", () => {
      const text = "Card: 378282246310005";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects card number with spaces", () => {
      const text = "Card: 4111 1111 1111 1111";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Possible Card Number")).toBe(true);
    });

    it("detects Japanese bank account", () => {
      const text = "口座番号: 1234567";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Bank Account")).toBe(true);
    });
  });

  describe("health detection", () => {
    it("detects medical record reference", () => {
      const text = "diagnosis: ABC-12345";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Medical Record")).toBe(true);
    });

    it("detects insurance number", () => {
      const text = "保険証番号: 12345678901";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Insurance Number")).toBe(true);
    });
  });

  describe("code detection", () => {
    it("detects function declaration", () => {
      const text = "function processData() {";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Source Code")).toBe(true);
    });

    it("detects import statement", () => {
      const text = 'import { something } from "package"';
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Import Statement")).toBe(true);
    });

    it("detects SQL query", () => {
      // Pattern requires SELECT/INSERT/UPDATE/DELETE/CREATE/DROP directly followed by FROM/INTO/TABLE
      const text = "SELECT FROM users WHERE id = 1";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "SQL Query")).toBe(true);
    });

    it("detects INSERT query", () => {
      const text = "INSERT INTO users VALUES (1)";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "SQL Query")).toBe(true);
    });
  });

  describe("internal/confidential detection", () => {
    it("detects confidential marker in English", () => {
      const text = "This is confidential information";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Confidential Marker")).toBe(true);
    });

    it("detects confidential marker in Japanese", () => {
      const text = "これは機密情報です";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Confidential Marker")).toBe(true);
    });

    it("detects internal only marker", () => {
      const text = "Internal Only - Do not share";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "internal")).toBe(true);
    });

    it("detects proprietary info marker", () => {
      const text = "This is proprietary information";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Proprietary Info")).toBe(true);
    });
  });

  describe("result properties", () => {
    it("includes position in results", () => {
      const text = "Email: test@example.com";
      const results = detectSensitiveData(text);

      const emailResult = results.find((r) => r.pattern === "Email Address");
      expect(emailResult?.position).toBeDefined();
      expect(emailResult?.position).toBeGreaterThanOrEqual(0);
    });

    it("masks matched text", () => {
      const text = "Email: longusername@example.com";
      const results = detectSensitiveData(text);

      const emailResult = results.find((r) => r.pattern === "Email Address");
      expect(emailResult?.matchedText).toContain("*");
    });

    it("returns empty array for clean text", () => {
      const text = "Hello, this is a normal message.";
      const results = detectSensitiveData(text);

      expect(results.length).toBe(0);
    });
  });
});

describe("hasSensitiveData", () => {
  it("returns true when sensitive data exists", () => {
    expect(hasSensitiveData("Email: test@example.com")).toBe(true);
  });

  it("returns true for credentials", () => {
    expect(hasSensitiveData("sk-abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(hasSensitiveData("Hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasSensitiveData("")).toBe(false);
  });
});

describe("getHighestRiskClassification", () => {
  it("returns null for empty results", () => {
    expect(getHighestRiskClassification([])).toBeNull();
  });

  it("returns credentials as highest risk", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "code", confidence: "low", pattern: "Source Code" },
    ];

    expect(getHighestRiskClassification(results)).toBe("credentials");
  });

  it("returns financial over PII", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "financial", confidence: "high", pattern: "Card" },
    ];

    expect(getHighestRiskClassification(results)).toBe("financial");
  });

  it("returns health over PII", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "health", confidence: "medium", pattern: "Medical" },
    ];

    expect(getHighestRiskClassification(results)).toBe("health");
  });

  it("returns PII over internal", () => {
    const results: SensitiveDataResult[] = [
      { classification: "internal", confidence: "medium", pattern: "Confidential" },
      { classification: "pii", confidence: "medium", pattern: "Email" },
    ];

    expect(getHighestRiskClassification(results)).toBe("pii");
  });

  it("returns internal over code", () => {
    const results: SensitiveDataResult[] = [
      { classification: "code", confidence: "low", pattern: "Source" },
      { classification: "internal", confidence: "medium", pattern: "Confidential" },
    ];

    expect(getHighestRiskClassification(results)).toBe("internal");
  });

  it("returns code over unknown", () => {
    const results: SensitiveDataResult[] = [
      { classification: "unknown", confidence: "low", pattern: "Unknown" },
      { classification: "code", confidence: "low", pattern: "Source" },
    ];

    expect(getHighestRiskClassification(results)).toBe("code");
  });
});

describe("getSensitiveDataSummary", () => {
  it("returns zero counts for empty results", () => {
    const summary = getSensitiveDataSummary([]);

    expect(summary.credentials).toBe(0);
    expect(summary.pii).toBe(0);
    expect(summary.financial).toBe(0);
    expect(summary.health).toBe(0);
    expect(summary.code).toBe(0);
    expect(summary.internal).toBe(0);
    expect(summary.unknown).toBe(0);
  });

  it("counts credentials correctly", () => {
    const results: SensitiveDataResult[] = [
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "credentials", confidence: "high", pattern: "Password" },
    ];

    const summary = getSensitiveDataSummary(results);
    expect(summary.credentials).toBe(2);
  });

  it("counts mixed classifications", () => {
    const results: SensitiveDataResult[] = [
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "pii", confidence: "medium", pattern: "Phone" },
      { classification: "financial", confidence: "high", pattern: "Card" },
    ];

    const summary = getSensitiveDataSummary(results);
    expect(summary.credentials).toBe(1);
    expect(summary.pii).toBe(2);
    expect(summary.financial).toBe(1);
    expect(summary.health).toBe(0);
  });

  it("includes all classification types", () => {
    const summary = getSensitiveDataSummary([]);

    const expectedKeys: DataClassification[] = [
      "credentials",
      "pii",
      "financial",
      "health",
      "code",
      "internal",
      "unknown",
    ];

    for (const key of expectedKeys) {
      expect(key in summary).toBe(true);
    }
  });
});

describe("integration tests", () => {
  it("detects multiple types in one text", () => {
    const text = `
      API Key: sk-abcdefghijklmnopqrstuvwxyz123456
      Email: user@example.com
      Card: 4111111111111111
    `;
    const results = detectSensitiveData(text);

    expect(results.some((r) => r.classification === "credentials")).toBe(true);
    expect(results.some((r) => r.classification === "pii")).toBe(true);
    expect(results.some((r) => r.classification === "financial")).toBe(true);
  });

  it("handles Japanese mixed content", () => {
    const text = `
      顧客情報
      電話: 090-1234-5678
      口座番号: 1234567890
      これは機密情報です
    `;
    const results = detectSensitiveData(text);

    expect(results.some((r) => r.pattern === "JP Phone Number")).toBe(true);
    expect(results.some((r) => r.pattern === "Bank Account")).toBe(true);
    expect(results.some((r) => r.pattern === "Confidential Marker")).toBe(true);
  });

  it("works with hasSensitiveData for quick check", () => {
    const sensitiveText = "API key: sk-test123456789012345678901234";
    const cleanText = "This is a normal message";

    expect(hasSensitiveData(sensitiveText)).toBe(true);
    expect(hasSensitiveData(cleanText)).toBe(false);
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
    // 単発スパイクで不安定化しないよう中央値で評価し、最大値も上限で監視する。
    expect(median).toBeLessThan(budgetMs);
    expect(max).toBeLessThan(budgetMs * SPIKE_FACTOR);
  }

  it(`email正規表現が悪意ある入力で ${BUDGET_MS}ms 以内に完了する`, () => {
    const malicious = "a".repeat(50) + "@" + "b.".repeat(500) + "c";
    expectWithinBudget(() => {
      detectSensitiveData(malicious);
    });
  });

  it(`@を含む100KBテキストで ${BUDGET_MS}ms 以内に完了する`, () => {
    const chunk = "data@field.value&key=".repeat(5000);
    expectWithinBudget(() => {
      detectSensitiveData(chunk);
    });
  });

  it(`hasSensitiveData も同様に高速`, () => {
    const malicious = "a".repeat(50) + "@" + "b.".repeat(500) + "c";
    expectWithinBudget(() => {
      hasSensitiveData(malicious);
    });
  });
});
