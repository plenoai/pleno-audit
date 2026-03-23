import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  exportAIPromptsToCSV,
  exportAIPromptsToJSON,
  exportDetectedServicesToCSV,
  exportDetectedServicesToJSON,
  exportAuditLogToJSON,
  createExportBlob,
  generateExportFilename,
  type AuditLogData,
} from "./audit-exporter.js";
import type {
  AIPromptExport,
  DetectedServiceExport,
} from "./types.js";

describe("exportAIPromptsToCSV", () => {
  const mockPrompts: AIPromptExport[] = [
    {
      id: "prompt1",
      timestamp: 1700000000000,
      pageUrl: "https://example.com/page",
      provider: "openai",
      model: "gpt-4",
      contentSize: 1024,
      hasSensitiveData: true,
      sensitiveDataTypes: ["pii", "credentials"],
      riskLevel: "high",
      riskScore: 75,
    },
    {
      id: "prompt2",
      timestamp: 1700000001000,
      pageUrl: "https://test.com/chat",
      provider: "anthropic",
      model: "claude-3",
      contentSize: 512,
      hasSensitiveData: false,
      sensitiveDataTypes: [],
      riskLevel: "low",
      riskScore: 10,
    },
  ];

  it("exports prompts with correct headers", () => {
    const csv = exportAIPromptsToCSV(mockPrompts);
    const headers = csv.split("\n")[0];

    expect(headers).toContain("id");
    expect(headers).toContain("timestamp");
    expect(headers).toContain("provider");
    expect(headers).toContain("model");
    expect(headers).toContain("hasSensitiveData");
    expect(headers).toContain("riskLevel");
  });

  it("formats sensitive data types with semicolon separator", () => {
    const csv = exportAIPromptsToCSV(mockPrompts);

    expect(csv).toContain("pii; credentials");
  });

  it("handles prompts without sensitive data", () => {
    const csv = exportAIPromptsToCSV(mockPrompts);
    const lines = csv.split("\n");

    expect(lines[2]).toContain("false");
    expect(lines[2]).toContain("low");
  });

  it("handles empty prompts array", () => {
    const csv = exportAIPromptsToCSV([]);
    const lines = csv.split("\n");

    expect(lines.length).toBe(1);
  });
});

describe("exportAIPromptsToJSON", () => {
  const mockPrompts: AIPromptExport[] = [
    {
      id: "prompt1",
      timestamp: 1700000000000,
      pageUrl: "https://example.com/page",
      provider: "openai",
      contentSize: 1024,
      hasSensitiveData: true,
      sensitiveDataTypes: ["pii"],
      riskLevel: "high",
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-11-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports prompts to JSON with metadata", () => {
    const json = exportAIPromptsToJSON(mockPrompts);
    const data = JSON.parse(json);

    expect(data.exportedAt).toBeDefined();
    expect(data.recordCount).toBe(1);
    expect(data.prompts).toHaveLength(1);
  });

  it("formats timestamp in prompts", () => {
    const json = exportAIPromptsToJSON(mockPrompts);
    const data = JSON.parse(json);

    expect(data.prompts[0].timestamp).toBe("2023-11-14T22:13:20.000Z");
  });

  it("preserves all prompt fields", () => {
    const json = exportAIPromptsToJSON(mockPrompts);
    const data = JSON.parse(json);

    expect(data.prompts[0].provider).toBe("openai");
    expect(data.prompts[0].hasSensitiveData).toBe(true);
    expect(data.prompts[0].sensitiveDataTypes).toContain("pii");
  });

  it("pretty prints when option is set", () => {
    const jsonPretty = exportAIPromptsToJSON(mockPrompts, { pretty: true });

    expect(jsonPretty).toContain("\n");
    expect(jsonPretty).toContain("  ");
  });
});

describe("exportDetectedServicesToCSV", () => {
  const mockServices: DetectedServiceExport[] = [
    {
      domain: "example.com",
      detectedAt: 1700000000000,
      hasLoginPage: true,
      privacyPolicyUrl: "https://example.com/privacy",
      termsOfServiceUrl: "https://example.com/terms",
      cookieCount: 5,
      isNRD: false,
      nrdConfidence: undefined,
      nrdDomainAge: 365,
      isTyposquat: false,
      typosquatConfidence: undefined,
      typosquatScore: 0,
      hasAIActivity: true,
      aiProviders: ["openai", "anthropic"],
      aiHasSensitiveData: false,
      aiRiskLevel: "low",
    },
    {
      domain: "suspicious.xyz",
      detectedAt: 1700000001000,
      hasLoginPage: true,
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      cookieCount: 0,
      isNRD: true,
      nrdConfidence: "high",
      nrdDomainAge: 7,
      isTyposquat: true,
      typosquatConfidence: "high",
      typosquatScore: 85,
      hasAIActivity: false,
    },
  ];

  it("exports services with correct headers", () => {
    const csv = exportDetectedServicesToCSV(mockServices);
    const headers = csv.split("\n")[0];

    expect(headers).toContain("domain");
    expect(headers).toContain("hasLoginPage");
    expect(headers).toContain("isNRD");
    expect(headers).toContain("isTyposquat");
    expect(headers).toContain("aiProviders");
  });

  it("formats AI providers with semicolon separator", () => {
    const csv = exportDetectedServicesToCSV(mockServices);

    expect(csv).toContain("openai; anthropic");
  });

  it("handles null values", () => {
    const csv = exportDetectedServicesToCSV(mockServices);
    const lines = csv.split("\n");

    // suspicious.xyz has null privacy policy
    expect(lines[2]).toContain("suspicious.xyz");
  });

  it("handles missing optional fields", () => {
    const csv = exportDetectedServicesToCSV(mockServices);

    // Should not throw and should handle undefined aiProviders
    expect(csv.split("\n").length).toBe(3);
  });
});

describe("exportDetectedServicesToJSON", () => {
  const mockServices: DetectedServiceExport[] = [
    {
      domain: "example.com",
      detectedAt: 1700000000000,
      hasLoginPage: true,
      privacyPolicyUrl: "https://example.com/privacy",
      termsOfServiceUrl: null,
      cookieCount: 5,
      isNRD: false,
      isTyposquat: false,
      hasAIActivity: false,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-11-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports services to JSON with metadata", () => {
    const json = exportDetectedServicesToJSON(mockServices);
    const data = JSON.parse(json);

    expect(data.exportedAt).toBeDefined();
    expect(data.recordCount).toBe(1);
    expect(data.services).toHaveLength(1);
  });

  it("formats detectedAt timestamp", () => {
    const json = exportDetectedServicesToJSON(mockServices);
    const data = JSON.parse(json);

    expect(data.services[0].detectedAt).toBe("2023-11-14T22:13:20.000Z");
  });

  it("preserves all service fields", () => {
    const json = exportDetectedServicesToJSON(mockServices);
    const data = JSON.parse(json);

    expect(data.services[0].domain).toBe("example.com");
    expect(data.services[0].hasLoginPage).toBe(true);
    expect(data.services[0].privacyPolicyUrl).toBe("https://example.com/privacy");
    expect(data.services[0].termsOfServiceUrl).toBeNull();
  });
});

describe("exportAuditLogToJSON", () => {
  const mockData: AuditLogData = {
    services: [
      {
        domain: "example.com",
        detectedAt: 1700000000000,
        hasLoginPage: true,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
        cookieCount: 0,
        isNRD: false,
        isTyposquat: false,
        hasAIActivity: false,
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-11-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports combined audit log with summary", () => {
    const json = exportAuditLogToJSON(mockData);
    const data = JSON.parse(json);

    expect(data.summary.serviceCount).toBe(1);
  });

  it("includes all data types", () => {
    const json = exportAuditLogToJSON(mockData);
    const data = JSON.parse(json);

    expect(data.services).toHaveLength(1);
  });

  it("formats all timestamps", () => {
    const json = exportAuditLogToJSON(mockData);
    const data = JSON.parse(json);

    expect(data.services[0].detectedAt).toBe("2023-11-14T22:13:20.000Z");
  });

  it("pretty prints when option is set", () => {
    const jsonPretty = exportAuditLogToJSON(mockData, { pretty: true });

    expect(jsonPretty).toContain("\n");
  });

  it("handles empty audit log", () => {
    const emptyData: AuditLogData = {
      services: [],
    };

    const json = exportAuditLogToJSON(emptyData);
    const data = JSON.parse(json);

    expect(data.summary.serviceCount).toBe(0);
  });
});

describe("createExportBlob", () => {
  it("creates JSON blob with correct MIME type", () => {
    const blob = createExportBlob('{"test": true}', "json");

    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("creates CSV blob with correct MIME type", () => {
    const blob = createExportBlob("id,name\n1,test", "csv");

    expect(blob.type).toBe("text/csv;charset=utf-8");
  });

  it("preserves content in blob", async () => {
    const content = '{"key": "value"}';
    const blob = createExportBlob(content, "json");
    const text = await blob.text();

    expect(text).toBe(content);
  });
});

describe("generateExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-11-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates filename for ai-prompts CSV", () => {
    const filename = generateExportFilename("ai-prompts", "csv");

    expect(filename).toBe("pleno-audit-ai-prompts-2023-11-15.csv");
  });

  it("generates filename for services JSON", () => {
    const filename = generateExportFilename("services", "json");

    expect(filename).toBe("pleno-audit-services-2023-11-15.json");
  });

  it("generates filename for audit-log JSON", () => {
    const filename = generateExportFilename("audit-log", "json");

    expect(filename).toBe("pleno-audit-audit-log-2023-11-15.json");
  });
});

describe("CSV escaping edge cases", () => {
  it("handles boolean values", () => {
    const services: DetectedServiceExport[] = [
      {
        domain: "example.com",
        detectedAt: 1700000000000,
        hasLoginPage: true,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
        cookieCount: 0,
        isNRD: false,
        isTyposquat: true,
        hasAIActivity: false,
      },
    ];

    const csv = exportDetectedServicesToCSV(services);
    expect(csv).toContain("true");
    expect(csv).toContain("false");
  });

  it("handles numeric values", () => {
    const prompts: AIPromptExport[] = [
      {
        id: "prompt1",
        timestamp: 1700000000000,
        pageUrl: "https://example.com",
        provider: "openai",
        contentSize: 12345,
        hasSensitiveData: false,
        sensitiveDataTypes: [],
        riskLevel: "low",
        riskScore: 50,
      },
    ];

    const csv = exportAIPromptsToCSV(prompts);
    expect(csv).toContain("12345");
    expect(csv).toContain("50");
  });
});
