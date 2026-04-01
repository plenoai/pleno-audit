import { describe, it, expect } from "vitest";
import { CSPAnalyzer } from "./analyzer.js";
import type { CSPReport, CSPGenerationOptions } from "./types.js";

const defaultOptions: CSPGenerationOptions = {
  defaultSrc: "'self'",
  strictMode: false,
  includeReportUri: false,
  reportUri: "/csp-report",
};

const sampleReports: CSPReport[] = [
  {
    id: "1",
    type: "csp-violation",
    directive: "script-src",
    blockedURL: "https://cdn.example.com/script.js",
    domain: "cdn.example.com",
    pageUrl: "https://mysite.com/page",
    timestamp: 1700000000000,
  },
  {
    id: "2",
    type: "csp-violation",
    directive: "img-src",
    blockedURL: "https://images.tracker.com/pixel.gif",
    domain: "images.tracker.com",
    pageUrl: "https://mysite.com/page",
    timestamp: 1700000001000,
  },
  {
    id: "3",
    type: "network-request",
    url: "https://api.analytics.com/collect",
    domain: "api.analytics.com",
    pageUrl: "https://mysite.com/dashboard",
    timestamp: 1700000002000,
    initiator: "script",
  },
];

describe("CSPAnalyzer snapshot tests", () => {
  it("generatePolicy output structure matches snapshot (non-strict)", () => {
    const analyzer = new CSPAnalyzer(sampleReports);
    const result = analyzer.generatePolicy(defaultOptions);

    // Snapshot the policy object structure (not string, as order may vary)
    expect(result.policy).toMatchSnapshot();
    expect(result.recommendations).toMatchSnapshot();
    expect(result.statistics).toMatchSnapshot();
  });

  it("generatePolicy output structure matches snapshot (strict mode)", () => {
    const analyzer = new CSPAnalyzer(sampleReports);
    const result = analyzer.generatePolicy({
      ...defaultOptions,
      strictMode: true,
      includeReportUri: true,
      reportUri: "/csp-violations",
    });

    expect(result.policy).toMatchSnapshot();
    expect(result.recommendations).toMatchSnapshot();
  });

  it("generatePolicyByDomain output matches snapshot", () => {
    const multiDomainReports: CSPReport[] = [
      { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://cdn.com/a.js", domain: "cdn.com", pageUrl: "https://site1.com/page", timestamp: 1700000000000 },
      { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://cdn.com/b.js", domain: "cdn.com", pageUrl: "https://site1.com/other", timestamp: 1700000001000 },
      { id: "3", type: "csp-violation", directive: "img-src", blockedURL: "https://img.com/pic.png", domain: "img.com", pageUrl: "https://site2.com", timestamp: 1700000002000 },
    ];
    const analyzer = new CSPAnalyzer(multiDomainReports);
    const result = analyzer.generatePolicyByDomain(defaultOptions);

    expect(result.totalDomains).toMatchSnapshot();
    expect(result.policies.map(p => ({ domain: p.domain, reportCount: p.reportCount }))).toMatchSnapshot();
  });

  it("empty reports generate consistent policy", () => {
    const analyzer = new CSPAnalyzer([]);
    const result = analyzer.generatePolicy(defaultOptions);

    expect(result.policy).toMatchSnapshot();
    expect(result.policyString).toMatchSnapshot();
  });
});
