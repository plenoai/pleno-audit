import { describe, it, expect } from "vitest";
import {
  exportServicesToCSV,
  exportViolationsToCSV,
  exportAlertsToCSV,
  exportPermissionsToCSV,
  exportReportToMarkdown,
  exportReportToHTML,
} from "./exporter.js";
import type {
  ServiceExport,
  ViolationExport,
  AlertExport,
  PermissionExport,
  SecurityReport,
} from "./types.js";

const sampleServices: ServiceExport[] = [
  {
    domain: "example.com",
    firstSeen: 1700000000000,
    lastSeen: 1700000100000,
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
  {
    domain: "suspicious.xyz",
    firstSeen: 1700000000000,
    lastSeen: 1700000050000,
    hasLogin: false,
    hasPrivacyPolicy: false,
    hasTermsOfService: false,
    isNRD: true,
    nrdConfidence: 85,
    isTyposquat: true,
    typosquatConfidence: 72,
    cookieCount: 0,
    riskScore: 90,
  },
];

const sampleViolations: ViolationExport[] = [
  {
    id: "v1",
    type: "nrd",
    domain: "suspicious.xyz",
    severity: "high",
    description: "Newly registered domain detected",
    timestamp: 1700000000000,
    acknowledged: false,
  },
];

const sampleAlerts: AlertExport[] = [
  {
    id: "a1",
    title: "Data Exfiltration Detected",
    severity: "critical",
    category: "exfiltration",
    description: "Sensitive data sent to external domain",
    domain: "evil.com",
    timestamp: 1700000000000,
    status: "active",
  },
];

const samplePermissions: PermissionExport[] = [
  {
    extensionId: "ext-abc123",
    extensionName: "Suspicious Extension",
    riskScore: 85,
    riskLevel: "high",
    permissions: ["tabs", "webRequest", "webRequestBlocking", "<all_urls>"],
    findingsCount: 7,
    analyzedAt: 1700000000000,
  },
];

const sampleReport: SecurityReport = {
  metadata: {
    version: "1.0.0",
    generatedAt: 1700000000000,
    reportPeriod: { start: 1699900000000, end: 1700000000000 },
  },
  summary: {
    securityScore: 65,
    totalServices: 2,
    totalViolations: 1,
    totalAlerts: 1,
    riskDistribution: { critical: 1, high: 1, medium: 0, low: 0 },
    topRisks: ["NRD detected: suspicious.xyz", "Data exfiltration to evil.com"],
  },
  services: sampleServices,
  violations: sampleViolations,
  alerts: sampleAlerts,
  permissions: samplePermissions,
};

describe("data-export snapshot tests", () => {
  describe("CSV exports", () => {
    it("services CSV matches snapshot", () => {
      expect(exportServicesToCSV(sampleServices)).toMatchSnapshot();
    });

    it("violations CSV matches snapshot", () => {
      expect(exportViolationsToCSV(sampleViolations)).toMatchSnapshot();
    });

    it("alerts CSV matches snapshot", () => {
      expect(exportAlertsToCSV(sampleAlerts)).toMatchSnapshot();
    });

    it("permissions CSV matches snapshot", () => {
      expect(exportPermissionsToCSV(samplePermissions)).toMatchSnapshot();
    });
  });

  describe("report exports", () => {
    it("markdown report matches snapshot", () => {
      expect(exportReportToMarkdown(sampleReport)).toMatchSnapshot();
    });

    it("HTML report structure matches snapshot", () => {
      const html = exportReportToHTML(sampleReport);
      // Snapshot the HTML structure (date-independent parts)
      expect(html).toMatchSnapshot();
    });
  });
});
