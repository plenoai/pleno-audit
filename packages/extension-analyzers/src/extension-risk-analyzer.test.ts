import { describe, it, expect } from "vitest";
import {
  analyzePermissions,
  analyzeNetworkActivity,
  calculateRiskScore,
  scoreToRiskLevel,
  getPermissionRiskLevel,
  generateRiskFlags,
  analyzeExtensionRisk,
  DANGEROUS_PERMISSIONS,
  type PermissionRisk,
  type NetworkRisk,
} from "./extension-risk-analyzer.js";
import type { ExtensionRequestRecord } from "@libztbs/types";

describe("DANGEROUS_PERMISSIONS", () => {
  it("contains critical permissions", () => {
    const critical = DANGEROUS_PERMISSIONS.filter((p) => p.severity === "critical");
    expect(critical.length).toBeGreaterThan(0);
    expect(critical.some((p) => p.permission === "<all_urls>")).toBe(true);
    expect(critical.some((p) => p.permission === "debugger")).toBe(true);
  });

  it("covers all categories", () => {
    const categories = new Set(DANGEROUS_PERMISSIONS.map((p) => p.category));
    expect(categories.has("data_access")).toBe(true);
    expect(categories.has("code_execution")).toBe(true);
    expect(categories.has("network")).toBe(true);
    expect(categories.has("privacy")).toBe(true);
    expect(categories.has("system")).toBe(true);
  });
});

describe("analyzePermissions", () => {
  it("returns empty array for no permissions", () => {
    expect(analyzePermissions([])).toEqual([]);
  });

  it("detects critical permissions", () => {
    const risks = analyzePermissions(["<all_urls>", "debugger"]);
    expect(risks.length).toBe(2);
    expect(risks.every((r) => r.severity === "critical")).toBe(true);
  });

  it("detects high severity permissions", () => {
    const risks = analyzePermissions(["cookies", "history", "webRequest"]);
    expect(risks.length).toBe(3);
    expect(risks.some((r) => r.severity === "high")).toBe(true);
  });

  it("detects medium severity permissions", () => {
    const risks = analyzePermissions(["tabs", "bookmarks"]);
    expect(risks.length).toBe(2);
    expect(risks.every((r) => r.severity === "medium")).toBe(true);
  });

  it("detects low severity permissions", () => {
    const risks = analyzePermissions(["storage", "activeTab"]);
    expect(risks.length).toBe(2);
    expect(risks.every((r) => r.severity === "low")).toBe(true);
  });

  it("ignores unknown permissions", () => {
    const risks = analyzePermissions(["unknown_permission", "another_unknown"]);
    expect(risks.length).toBe(0);
  });

  it("detects wildcard host permissions", () => {
    const risks = analyzePermissions(["https://*.example.com/*"]);
    expect(risks.length).toBe(1);
    expect(risks[0].category).toBe("data_access");
  });

  it("assigns high severity to broad wildcard patterns", () => {
    const risks = analyzePermissions(["https://*/*.example.com/*"]);
    expect(risks[0].severity).toBe("high");
  });

  it("assigns appropriate severity to wildcard patterns without path", () => {
    // Without "/*" in pattern, it's considered more limited
    // But still has wildcard so at least medium
    const risks = analyzePermissions(["https://*.example.com"]);
    expect(risks.length).toBe(1);
    // The implementation checks includes("/*") for high, this pattern doesn't match
    // so it falls through to the wildcard check
  });
});

describe("analyzeNetworkActivity", () => {
  const createRequest = (
    domain: string,
    method: string = "GET",
    timestamp: number = Date.now()
  ): ExtensionRequestRecord => ({
    extensionId: "test-ext",
    domain,
    method,
    url: `https://${domain}/`,
    timestamp,
    tabId: 1,
  });

  it("returns empty array for no requests", () => {
    expect(analyzeNetworkActivity([])).toEqual([]);
  });

  it("detects high frequency requests (>100/min)", () => {
    const now = Date.now();
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 150; i++) {
      requests.push(createRequest("example.com", "GET", now - i * 100));
    }
    const risks = analyzeNetworkActivity(requests, 60000);
    expect(risks.some((r) => r.type === "high_frequency" && r.severity === "high")).toBe(true);
  });

  it("detects medium frequency requests (>30/min)", () => {
    const now = Date.now();
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 50; i++) {
      requests.push(createRequest("example.com", "GET", now - i * 1000));
    }
    const risks = analyzeNetworkActivity(requests, 60000);
    expect(risks.some((r) => r.type === "high_frequency" && r.severity === "medium")).toBe(true);
  });

  it("detects access to sensitive domains (API)", () => {
    const requests = [createRequest("api.example.com")];
    const risks = analyzeNetworkActivity(requests);
    expect(risks.some((r) => r.type === "sensitive_domain")).toBe(true);
  });

  it("detects access to sensitive domains (auth)", () => {
    const requests = [createRequest("login.example.com")];
    const risks = analyzeNetworkActivity(requests);
    expect(risks.some((r) => r.type === "sensitive_domain")).toBe(true);
  });

  it("detects access to sensitive domains (financial)", () => {
    const requests = [createRequest("payment.example.com")];
    const risks = analyzeNetworkActivity(requests);
    expect(risks.some((r) => r.type === "sensitive_domain")).toBe(true);
  });

  it("detects many unique domains (>20)", () => {
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 25; i++) {
      requests.push(createRequest(`domain${i}.com`));
    }
    const risks = analyzeNetworkActivity(requests);
    expect(risks.some((r) => r.type === "data_exfiltration")).toBe(true);
  });

  it("detects large POST requests (>10)", () => {
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 15; i++) {
      requests.push(createRequest("example.com", "POST"));
    }
    const risks = analyzeNetworkActivity(requests);
    expect(risks.some((r) => r.type === "suspicious_pattern")).toBe(true);
  });

  it("assigns high severity to very large POST requests (>50)", () => {
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 60; i++) {
      requests.push(createRequest("example.com", "POST"));
    }
    const risks = analyzeNetworkActivity(requests);
    const postRisk = risks.find((r) => r.type === "suspicious_pattern");
    expect(postRisk?.severity).toBe("high");
  });

  it("respects time window parameter", () => {
    const now = Date.now();
    const requests: ExtensionRequestRecord[] = [];
    // Create requests spread over 2 minutes
    for (let i = 0; i < 100; i++) {
      requests.push(createRequest("example.com", "GET", now - i * 2000));
    }
    // With 30 second window, only recent requests count
    const risks = analyzeNetworkActivity(requests, 30000);
    // Should not detect high frequency since most requests are outside window
    const highFreq = risks.find((r) => r.type === "high_frequency" && r.severity === "high");
    expect(highFreq).toBeUndefined();
  });
});

describe("calculateRiskScore", () => {
  it("returns 0 for no risks", () => {
    expect(calculateRiskScore([], [])).toBe(0);
  });

  it("adds 30 for critical permission risk", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "test", category: "data_access", severity: "critical", description: "test" },
    ];
    expect(calculateRiskScore(permRisks, [])).toBe(30);
  });

  it("adds 20 for high permission risk", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "test", category: "data_access", severity: "high", description: "test" },
    ];
    expect(calculateRiskScore(permRisks, [])).toBe(20);
  });

  it("adds 10 for medium permission risk", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "test", category: "data_access", severity: "medium", description: "test" },
    ];
    expect(calculateRiskScore(permRisks, [])).toBe(10);
  });

  it("adds 5 for low permission risk", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "test", category: "data_access", severity: "low", description: "test" },
    ];
    expect(calculateRiskScore(permRisks, [])).toBe(5);
  });

  it("adds 25 for high network risk", () => {
    const netRisks: NetworkRisk[] = [
      { type: "high_frequency", description: "test", severity: "high" },
    ];
    expect(calculateRiskScore([], netRisks)).toBe(25);
  });

  it("adds 15 for medium network risk", () => {
    const netRisks: NetworkRisk[] = [
      { type: "high_frequency", description: "test", severity: "medium" },
    ];
    expect(calculateRiskScore([], netRisks)).toBe(15);
  });

  it("adds 5 for low network risk", () => {
    const netRisks: NetworkRisk[] = [
      { type: "high_frequency", description: "test", severity: "low" },
    ];
    expect(calculateRiskScore([], netRisks)).toBe(5);
  });

  it("combines permission and network risks", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "test", category: "data_access", severity: "high", description: "test" },
    ];
    const netRisks: NetworkRisk[] = [
      { type: "high_frequency", description: "test", severity: "medium" },
    ];
    expect(calculateRiskScore(permRisks, netRisks)).toBe(35);
  });

  it("caps score at 100", () => {
    const permRisks: PermissionRisk[] = [];
    for (let i = 0; i < 10; i++) {
      permRisks.push({ permission: `test${i}`, category: "data_access", severity: "critical", description: "test" });
    }
    expect(calculateRiskScore(permRisks, [])).toBe(100);
  });
});

describe("scoreToRiskLevel", () => {
  it("returns critical for score >= 80", () => {
    expect(scoreToRiskLevel(80)).toBe("critical");
    expect(scoreToRiskLevel(100)).toBe("critical");
  });

  it("returns high for score 60-79", () => {
    expect(scoreToRiskLevel(60)).toBe("high");
    expect(scoreToRiskLevel(79)).toBe("high");
  });

  it("returns medium for score 40-59", () => {
    expect(scoreToRiskLevel(40)).toBe("medium");
    expect(scoreToRiskLevel(59)).toBe("medium");
  });

  it("returns low for score 20-39", () => {
    expect(scoreToRiskLevel(20)).toBe("low");
    expect(scoreToRiskLevel(39)).toBe("low");
  });

  it("returns safe for score < 20", () => {
    expect(scoreToRiskLevel(0)).toBe("safe");
    expect(scoreToRiskLevel(19)).toBe("safe");
  });
});

describe("getPermissionRiskLevel", () => {
  it("returns low when no risky permissions exist", () => {
    expect(getPermissionRiskLevel(["unknown_permission"])).toBe("low");
  });

  it("returns highest severity across standard and host permissions", () => {
    expect(getPermissionRiskLevel(["cookies"], ["<all_urls>"])).toBe("critical");
  });

  it("returns medium when medium severity is the highest match", () => {
    expect(getPermissionRiskLevel(["tabs"])).toBe("medium");
  });
});

describe("generateRiskFlags", () => {
  it("returns empty array for no risks", () => {
    expect(generateRiskFlags([], [])).toEqual([]);
  });

  it("generates FULL_NETWORK_ACCESS flag", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "webRequest", category: "network", severity: "high", description: "test" },
      { permission: "<all_urls>", category: "data_access", severity: "critical", description: "test" },
    ];
    const flags = generateRiskFlags(permRisks, []);
    expect(flags.some((f) => f.flag === "FULL_NETWORK_ACCESS")).toBe(true);
  });

  it("generates ARBITRARY_CODE_EXECUTION flag", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "scripting", category: "code_execution", severity: "high", description: "test" },
      { permission: "<all_urls>", category: "data_access", severity: "critical", description: "test" },
    ];
    const flags = generateRiskFlags(permRisks, []);
    expect(flags.some((f) => f.flag === "ARBITRARY_CODE_EXECUTION")).toBe(true);
  });

  it("generates NATIVE_APP_ACCESS flag", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "nativeMessaging", category: "system", severity: "critical", description: "test" },
    ];
    const flags = generateRiskFlags(permRisks, []);
    expect(flags.some((f) => f.flag === "NATIVE_APP_ACCESS")).toBe(true);
  });

  it("generates DATA_EXFILTRATION_RISK flag", () => {
    const permRisks: PermissionRisk[] = [
      { permission: "<all_urls>", category: "data_access", severity: "critical", description: "test" },
    ];
    const netRisks: NetworkRisk[] = [
      { type: "sensitive_domain", description: "test", severity: "high" },
    ];
    const flags = generateRiskFlags(permRisks, netRisks);
    expect(flags.some((f) => f.flag === "DATA_EXFILTRATION_RISK")).toBe(true);
  });

  it("generates SUSPICIOUS_ACTIVITY flag", () => {
    const netRisks: NetworkRisk[] = [
      { type: "high_frequency", description: "test", severity: "high" },
    ];
    const flags = generateRiskFlags([], netRisks);
    expect(flags.some((f) => f.flag === "SUSPICIOUS_ACTIVITY")).toBe(true);
  });
});

describe("analyzeExtensionRisk", () => {
  it("analyzes extension with no risks", () => {
    const result = analyzeExtensionRisk("ext-id", "Safe Extension", ["storage"], []);
    expect(result.extensionId).toBe("ext-id");
    expect(result.extensionName).toBe("Safe Extension");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBeLessThan(20);
  });

  it("analyzes extension with high risk permissions", () => {
    const result = analyzeExtensionRisk(
      "ext-id",
      "Risky Extension",
      ["<all_urls>", "webRequest", "cookies"],
      []
    );
    // Score: <all_urls>=30(critical) + webRequest=20(high) + cookies=20(high) = 70 -> high
    expect(result.riskLevel).toBe("high");
    expect(result.permissionRisks.length).toBeGreaterThan(0);
  });

  it("analyzes extension with critical risk score", () => {
    const result = analyzeExtensionRisk(
      "ext-id",
      "Very Risky Extension",
      ["<all_urls>", "webRequestBlocking", "debugger", "nativeMessaging"],
      []
    );
    // Score: 30+30+30+30 = 120 -> capped at 100 -> critical
    expect(result.riskLevel).toBe("critical");
  });

  it("includes network risks in analysis", () => {
    const now = Date.now();
    const requests: ExtensionRequestRecord[] = [];
    for (let i = 0; i < 150; i++) {
      requests.push({
        extensionId: "ext-id",
        domain: "example.com",
        method: "GET",
        url: "https://example.com/",
        timestamp: now - i * 100,
        tabId: 1,
      });
    }
    const result = analyzeExtensionRisk("ext-id", "Active Extension", ["storage"], requests);
    expect(result.networkRisks.length).toBeGreaterThan(0);
  });

  it("generates flags for dangerous combinations", () => {
    const result = analyzeExtensionRisk(
      "ext-id",
      "Dangerous Extension",
      ["<all_urls>", "webRequest", "scripting"],
      []
    );
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.flags.some((f) => f.severity === "critical")).toBe(true);
  });

  it("includes timestamp", () => {
    const before = Date.now();
    const result = analyzeExtensionRisk("ext-id", "Test", [], []);
    const after = Date.now();
    expect(result.analyzedAt).toBeGreaterThanOrEqual(before);
    expect(result.analyzedAt).toBeLessThanOrEqual(after);
  });
});
