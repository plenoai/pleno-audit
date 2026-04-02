import { describe, it, expect } from "vitest";
import {
  toCSV,
  toJSON,
  exportServicesToCSV,
  exportViolationsToCSV,
  exportAlertsToCSV,
  exportPermissionsToCSV,
  exportReportToMarkdown,
  exportReportToHTML,
  exportData,
} from "./exporter.js";
import type {
  ServiceExport,
  ViolationExport,
  AlertExport,
  PermissionExport,
  SecurityReport,
} from "./types.js";

describe("toCSV", () => {
  it("converts data to CSV format", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const columns = [
      { header: "Name", accessor: (d: typeof data[0]) => d.name },
      { header: "Age", accessor: (d: typeof data[0]) => d.age },
    ];
    const csv = toCSV(data, columns);
    expect(csv).toBe("Name,Age\nAlice,30\nBob,25");
  });

  it("escapes values with commas", () => {
    const data = [{ text: "Hello, World" }];
    const columns = [
      { header: "Text", accessor: (d: typeof data[0]) => d.text },
    ];
    const csv = toCSV(data, columns);
    expect(csv).toContain('"Hello, World"');
  });

  it("escapes values with quotes", () => {
    const data = [{ text: 'Say "Hello"' }];
    const columns = [
      { header: "Text", accessor: (d: typeof data[0]) => d.text },
    ];
    const csv = toCSV(data, columns);
    expect(csv).toContain('"Say ""Hello"""');
  });

  it("escapes values with newlines", () => {
    const data = [{ text: "Line1\nLine2" }];
    const columns = [
      { header: "Text", accessor: (d: typeof data[0]) => d.text },
    ];
    const csv = toCSV(data, columns);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("handles empty data", () => {
    const csv = toCSV([], [{ header: "Name", accessor: () => "" }]);
    expect(csv).toBe("Name");
  });

  it("handles null/undefined values", () => {
    const data = [{ value: null }, { value: undefined }];
    const columns = [
      { header: "Value", accessor: (d: typeof data[0]) => d.value },
    ];
    const csv = toCSV(data, columns);
    expect(csv).toBe("Value\n\n");
  });
});

describe("toJSON", () => {
  it("converts to JSON with pretty print by default", () => {
    const data = { name: "Test", value: 123 };
    const json = toJSON(data);
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });

  it("converts to compact JSON when prettyPrint is false", () => {
    const data = { name: "Test", value: 123 };
    const json = toJSON(data, false);
    expect(json).not.toContain("\n");
    expect(json).toBe('{"name":"Test","value":123}');
  });

  it("handles arrays", () => {
    const data = [1, 2, 3];
    const json = toJSON(data, false);
    expect(json).toBe("[1,2,3]");
  });

  it("handles nested objects", () => {
    const data = { outer: { inner: "value" } };
    const json = toJSON(data, false);
    expect(json).toBe('{"outer":{"inner":"value"}}');
  });
});

describe("exportServicesToCSV", () => {
  it("exports services to CSV", () => {
    const services: ServiceExport[] = [
      {
        domain: "example.com",
        firstSeen: 1000000000000,
        lastSeen: 1000000001000,
        hasLogin: true,
        hasPrivacyPolicy: true,
        hasTermsOfService: false,
        isNRD: false,
        nrdConfidence: undefined,
        isTyposquat: false,
        typosquatConfidence: undefined,
        cookieCount: 5,
        riskScore: 20,
      },
    ];
    const csv = exportServicesToCSV(services);
    expect(csv).toContain("Domain");
    expect(csv).toContain("example.com");
    expect(csv).toContain("true");
    expect(csv).toContain("20");
  });

  it("handles empty service list", () => {
    const csv = exportServicesToCSV([]);
    expect(csv).toContain("Domain");
    expect(csv.split("\n").length).toBe(1);
  });
});

describe("exportViolationsToCSV", () => {
  it("exports violations to CSV", () => {
    const violations: ViolationExport[] = [
      {
        id: "v1",
        type: "nrd",
        domain: "suspicious.xyz",
        severity: "high",
        description: "NRD detected",
        timestamp: 1000000000000,
        acknowledged: false,
      },
    ];
    const csv = exportViolationsToCSV(violations);
    expect(csv).toContain("ID");
    expect(csv).toContain("v1");
    expect(csv).toContain("suspicious.xyz");
    expect(csv).toContain("high");
  });
});

describe("exportAlertsToCSV", () => {
  it("exports alerts to CSV", () => {
    const alerts: AlertExport[] = [
      {
        id: "a1",
        title: "Security Alert",
        severity: "critical",
        category: "phishing",
        description: "Phishing detected",
        domain: "phishing.com",
        timestamp: 1000000000000,
        status: "active",
      },
    ];
    const csv = exportAlertsToCSV(alerts);
    expect(csv).toContain("Title");
    expect(csv).toContain("Security Alert");
    expect(csv).toContain("critical");
    expect(csv).toContain("phishing.com");
  });

  it("handles missing domain", () => {
    const alerts: AlertExport[] = [
      {
        id: "a1",
        title: "Alert",
        severity: "low",
        category: "info",
        description: "Info",
        domain: undefined,
        timestamp: 1000000000000,
        status: "resolved",
      },
    ];
    const csv = exportAlertsToCSV(alerts);
    expect(csv).not.toContain("undefined");
  });
});

describe("exportPermissionsToCSV", () => {
  it("exports permissions to CSV", () => {
    const permissions: PermissionExport[] = [
      {
        extensionId: "ext1",
        extensionName: "Test Extension",
        riskScore: 75,
        riskLevel: "high",
        permissions: ["tabs", "storage", "webRequest"],
        findingsCount: 3,
        analyzedAt: 1000000000000,
      },
    ];
    const csv = exportPermissionsToCSV(permissions);
    expect(csv).toContain("Extension Name");
    expect(csv).toContain("Test Extension");
    expect(csv).toContain("75");
    expect(csv).toContain("tabs; storage; webRequest");
  });
});

describe("exportReportToMarkdown", () => {
  const mockReport: SecurityReport = {
    metadata: {
      version: "1.0.0",
      generatedAt: 1000000000000,
      reportPeriod: { start: 999900000000, end: 1000000000000 },
    },
    summary: {
      securityScore: 75,
      totalServices: 10,
      totalViolations: 3,
      totalAlerts: 5,
      riskDistribution: { critical: 1, high: 2, medium: 3, low: 4 },
      topRisks: ["Risk 1", "Risk 2"],
    },
    services: [
      {
        domain: "example.com",
        firstSeen: 1000000000000,
        lastSeen: 1000000000000,
        hasLogin: true,
        hasPrivacyPolicy: true,
        hasTermsOfService: true,
        isNRD: false,
        isTyposquat: false,
        cookieCount: 5,
        riskScore: 20,
      },
    ],
    violations: [
      {
        id: "v1",
        type: "policy",
        domain: "bad.com",
        severity: "high",
        description: "Policy violation",
        timestamp: 1000000000000,
        acknowledged: false,
      },
    ],
    alerts: [
      {
        id: "a1",
        title: "Alert",
        severity: "medium",
        category: "security",
        description: "Desc",
        domain: "test.com",
        timestamp: 1000000000000,
        status: "active",
      },
    ],
    permissions: [
      {
        extensionId: "ext1",
        extensionName: "Ext",
        riskScore: 50,
        riskLevel: "medium",
        permissions: ["tabs"],
        findingsCount: 1,
        analyzedAt: 1000000000000,
      },
    ],
  };

  it("generates markdown report with header", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("# Pleno Audit Security Report");
  });

  it("includes summary section", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("## Summary");
    expect(md).toContain("**Security Score**: 75/100");
    expect(md).toContain("**Total Services**: 10");
  });

  it("includes risk distribution", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("### Risk Distribution");
    expect(md).toContain("critical: 1");
  });

  it("includes top risks", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("### Top Risks");
    expect(md).toContain("Risk 1");
    expect(md).toContain("Risk 2");
  });

  it("includes services table", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("## Detected Services");
    expect(md).toContain("example.com");
  });

  it("includes violations section", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("## Policy Violations");
    expect(md).toContain("bad.com");
  });

  it("includes alerts table", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("## Security Alerts");
    expect(md).toContain("Alert");
  });

  it("includes permissions section", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("## Extension Permissions");
    expect(md).toContain("Ext");
  });

  it("includes footer", () => {
    const md = exportReportToMarkdown(mockReport);
    expect(md).toContain("Report generated by Pleno Audit");
  });
});

describe("exportReportToHTML", () => {
  const mockReport: SecurityReport = {
    metadata: {
      version: "1.0.0",
      generatedAt: 1000000000000,
      reportPeriod: { start: 999900000000, end: 1000000000000 },
    },
    summary: {
      securityScore: 85,
      totalServices: 5,
      totalViolations: 2,
      totalAlerts: 3,
      riskDistribution: {},
      topRisks: [],
    },
    services: [],
    violations: [],
    alerts: [],
    permissions: [],
  };

  it("generates valid HTML document", () => {
    const html = exportReportToHTML(mockReport);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes title", () => {
    const html = exportReportToHTML(mockReport);
    expect(html).toContain("<title>Pleno Audit Security Report</title>");
  });

  it("includes security score", () => {
    const html = exportReportToHTML(mockReport);
    expect(html).toContain("85");
    expect(html).toContain("Security Score");
  });

  it("uses green color for high score", () => {
    const html = exportReportToHTML({ ...mockReport, summary: { ...mockReport.summary, securityScore: 90 } });
    expect(html).toContain("#22c55e");
  });

  it("uses red color for low score", () => {
    const html = exportReportToHTML({ ...mockReport, summary: { ...mockReport.summary, securityScore: 30 } });
    expect(html).toContain("#dc2626");
  });

  it("includes stats cards", () => {
    const html = exportReportToHTML(mockReport);
    expect(html).toContain("Services");
    expect(html).toContain("Violations");
    expect(html).toContain("Alerts");
  });
});

describe("exportData", () => {
  it("exports JSON format", () => {
    const data = { test: "value" };
    const result = exportData(data, { format: "json", dataType: "services" });
    expect(result.success).toBe(true);
    expect(result.format).toBe("json");
    expect(result.content).toContain("test");
  });

  it("exports CSV format for services", () => {
    const services: ServiceExport[] = [
      {
        domain: "test.com",
        firstSeen: 1000,
        lastSeen: 2000,
        hasLogin: true,
        hasPrivacyPolicy: true,
        hasTermsOfService: true,
        isNRD: false,
        isTyposquat: false,
        cookieCount: 1,
        riskScore: 10,
      },
    ];
    const result = exportData(services, { format: "csv", dataType: "services" });
    expect(result.success).toBe(true);
    expect(result.format).toBe("csv");
    expect(result.recordCount).toBe(1);
  });

  it("exports markdown for full report", () => {
    const report: SecurityReport = {
      metadata: { version: "1.0.0", generatedAt: Date.now(), reportPeriod: { start: 0, end: Date.now() } },
      summary: { securityScore: 80, totalServices: 0, totalViolations: 0, totalAlerts: 0, riskDistribution: {}, topRisks: [] },
      services: [],
      violations: [],
      alerts: [],
      permissions: [],
    };
    const result = exportData(report, { format: "markdown", dataType: "full_report" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("# Pleno Audit Security Report");
  });

  it("exports HTML for full report", () => {
    const report: SecurityReport = {
      metadata: { version: "1.0.0", generatedAt: Date.now(), reportPeriod: { start: 0, end: Date.now() } },
      summary: { securityScore: 70, totalServices: 0, totalViolations: 0, totalAlerts: 0, riskDistribution: {}, topRisks: [] },
      services: [],
      violations: [],
      alerts: [],
      permissions: [],
    };
    const result = exportData(report, { format: "html", dataType: "full_report" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("<!DOCTYPE html>");
  });

  it("generates correct filename", () => {
    const result = exportData({}, { format: "json", dataType: "services" });
    expect(result.filename).toMatch(/^pleno-audit-services-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it("includes export timestamp", () => {
    const before = Date.now();
    const result = exportData({}, { format: "json", dataType: "services" });
    const after = Date.now();
    expect(result.exportedAt).toBeGreaterThanOrEqual(before);
    expect(result.exportedAt).toBeLessThanOrEqual(after);
  });

  it("handles compact JSON export", () => {
    const data = { test: "value" };
    const result = exportData(data, { format: "json", dataType: "services", prettyPrint: false });
    expect(result.content).not.toContain("\n");
  });
});
