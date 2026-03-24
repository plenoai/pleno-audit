import { describe, it, expect } from "vitest";
import { CSPAnalyzer } from "./analyzer.js";
import type { CSPReport, CSPGenerationOptions } from "./types.js";

const defaultOptions: CSPGenerationOptions = {
  defaultSrc: "'self'",
  strictMode: false,
  includeReportUri: false,
  reportUri: "/csp-report",
};

describe("CSPAnalyzer", () => {
  describe("constructor", () => {
    it("creates analyzer with empty reports", () => {
      const analyzer = new CSPAnalyzer();
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.totalReports).toBe(0);
    });

    it("creates analyzer with reports", () => {
      const reports: CSPReport[] = [
        {
          id: "1",
          type: "csp-violation",
          directive: "script-src",
          blockedURL: "https://evil.com/script.js",
          domain: "evil.com",
          pageUrl: "https://example.com/page",
          timestamp: Date.now(),
        },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.totalReports).toBe(1);
    });
  });

  describe("generatePolicy", () => {
    it("generates policy with default-src", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.policy["default-src"]).toContain("'self'");
    });

    it("generates policy string", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.policyString).toContain("default-src 'self'");
    });

    it("includes script-src and style-src by default", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.policy["script-src"]).toBeDefined();
      expect(result.policy["style-src"]).toBeDefined();
    });

    it("adds unsafe-inline in non-strict mode", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: false });
      expect(result.policy["script-src"]).toContain("'unsafe-inline'");
      expect(result.policy["style-src"]).toContain("'unsafe-inline'");
    });

    it("does not add unsafe-inline in strict mode", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: true });
      expect(result.policy["script-src"]).not.toContain("'unsafe-inline'");
    });

    it("includes frame-ancestors and base-uri", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.policy["frame-ancestors"]).toContain("'self'");
      expect(result.policy["base-uri"]).toContain("'self'");
    });

    it("includes upgrade-insecure-requests in strict mode", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: true });
      expect(result.policy["upgrade-insecure-requests"]).toBeDefined();
    });

    it("includes report-uri when configured", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({
        ...defaultOptions,
        includeReportUri: true,
        reportUri: "/csp-endpoint",
      });
      expect(result.policy["report-uri"]).toContain("/csp-endpoint");
      expect(result.policy["report-to"]).toContain("csp-endpoint");
    });
  });

  describe("policy from CSP violations", () => {
    it("aggregates blocked URLs by directive", () => {
      const reports: CSPReport[] = [
        {
          id: "1",
          type: "csp-violation",
          directive: "script-src",
          blockedURL: "https://cdn.example.com/script.js",
          domain: "cdn.example.com",
          pageUrl: "https://mysite.com",
          timestamp: Date.now(),
        },
        {
          id: "2",
          type: "csp-violation",
          directive: "script-src",
          blockedURL: "https://cdn2.example.com/lib.js",
          domain: "cdn2.example.com",
          pageUrl: "https://mysite.com",
          timestamp: Date.now(),
        },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.policy["script-src"]).toContain("'self'");
      expect(result.policyString).toContain("script-src");
    });

    it("normalizes directive names", () => {
      const reports: CSPReport[] = [
        {
          id: "1",
          type: "csp-violation",
          directive: "script-src-elem",
          blockedURL: "https://test.com/script.js",
          domain: "test.com",
          pageUrl: "https://mysite.com",
          timestamp: Date.now(),
        },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      // script-src-elem should be normalized to script-src
      expect(result.policy["script-src"]).toBeDefined();
      expect(result.policy["script-src-elem"]).toBeUndefined();
    });

    it("uses wildcard domains in non-strict mode", () => {
      const reports: CSPReport[] = [
        {
          id: "1",
          type: "csp-violation",
          directive: "img-src",
          blockedURL: "https://cdn.example.com/image.png",
          domain: "cdn.example.com",
          pageUrl: "https://mysite.com",
          timestamp: Date.now(),
        },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: false });
      expect(result.policy["img-src"]?.some((s) => s.includes("*"))).toBe(true);
    });

    it("uses exact origins in strict mode", () => {
      const reports: CSPReport[] = [
        {
          id: "1",
          type: "csp-violation",
          directive: "img-src",
          blockedURL: "https://cdn.example.com/image.png",
          domain: "cdn.example.com",
          pageUrl: "https://mysite.com",
          timestamp: Date.now(),
        },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: true });
      expect(result.policy["img-src"]?.some((s) => s === "https://cdn.example.com")).toBe(true);
    });
  });

  describe("statistics", () => {
    it("counts total reports", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "style-src", blockedURL: "https://b.com", domain: "b.com", pageUrl: "https://x.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.totalReports).toBe(2);
    });

    it("counts CSP violations and network requests", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "2", type: "network-request", url: "https://b.com", domain: "b.com", pageUrl: "https://x.com", timestamp: 0, initiator: "script" },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.cspViolations).toBe(1);
      expect(result.statistics.networkRequests).toBe(1);
    });

    it("lists unique domains", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com/other", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "3", type: "csp-violation", directive: "style-src", blockedURL: "https://b.com", domain: "b.com", pageUrl: "https://x.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.uniqueDomains).toHaveLength(2);
      expect(result.statistics.uniqueDomains).toContain("a.com");
      expect(result.statistics.uniqueDomains).toContain("b.com");
    });

    it("counts by directive", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://b.com", domain: "b.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "3", type: "csp-violation", directive: "img-src", blockedURL: "https://c.com", domain: "c.com", pageUrl: "https://x.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.byDirective["script-src"]).toBe(2);
      expect(result.statistics.byDirective["img-src"]).toBe(1);
    });

    it("counts by domain", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "style-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://x.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicy(defaultOptions);
      expect(result.statistics.byDomain["a.com"]).toBe(2);
    });
  });

  describe("recommendations", () => {
    it("recommends against unsafe-inline", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: false });
      const unsafeInlineRec = result.recommendations.find(
        (r) => r.message.includes("unsafe-inline")
      );
      expect(unsafeInlineRec).toBeDefined();
      expect(unsafeInlineRec?.severity).toBe("high");
    });

    it("no unsafe-inline warning in strict mode", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: true });
      const unsafeInlineRec = result.recommendations.filter(
        (r) => r.message.includes("unsafe-inline")
      );
      // Should have fewer unsafe-inline warnings in strict mode
      expect(unsafeInlineRec.length).toBe(0);
    });

    it("recommends against object-src without none", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);
      const objectRec = result.recommendations.find(
        (r) => r.directive === "object-src"
      );
      expect(objectRec).toBeDefined();
    });
  });

  describe("generatePolicyByDomain", () => {
    it("groups policies by page origin", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://cdn.com", domain: "cdn.com", pageUrl: "https://site1.com/page", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://cdn.com", domain: "cdn.com", pageUrl: "https://site1.com/other", timestamp: 0 },
        { id: "3", type: "csp-violation", directive: "img-src", blockedURL: "https://img.com", domain: "img.com", pageUrl: "https://site2.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicyByDomain(defaultOptions);

      expect(result.totalDomains).toBe(2);
      expect(result.policies.some((p) => p.domain === "site1.com")).toBe(true);
      expect(result.policies.some((p) => p.domain === "site2.com")).toBe(true);
    });

    it("sorts policies by report count", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "https://popular.com", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://b.com", domain: "b.com", pageUrl: "https://popular.com", timestamp: 0 },
        { id: "3", type: "csp-violation", directive: "script-src", blockedURL: "https://c.com", domain: "c.com", pageUrl: "https://popular.com", timestamp: 0 },
        { id: "4", type: "csp-violation", directive: "img-src", blockedURL: "https://d.com", domain: "d.com", pageUrl: "https://rare.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicyByDomain(defaultOptions);

      expect(result.policies[0].domain).toBe("popular.com");
      expect(result.policies[0].reportCount).toBe(3);
    });

    it("handles invalid URLs gracefully", () => {
      const reports: CSPReport[] = [
        { id: "1", type: "csp-violation", directive: "script-src", blockedURL: "https://a.com", domain: "a.com", pageUrl: "invalid-url", timestamp: 0 },
        { id: "2", type: "csp-violation", directive: "script-src", blockedURL: "https://b.com", domain: "b.com", pageUrl: "https://valid.com", timestamp: 0 },
      ];
      const analyzer = new CSPAnalyzer(reports);
      const result = analyzer.generatePolicyByDomain(defaultOptions);

      // Only valid URL should be included
      expect(result.totalDomains).toBe(1);
      expect(result.policies[0].domain).toBe("valid.com");
    });
  });

  describe("policyToString", () => {
    it("generates valid CSP header string", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy(defaultOptions);

      // Should contain semicolon-separated directives
      expect(result.policyString).toMatch(/default-src .+;/);
      expect(result.policyString).toMatch(/script-src .+/);
    });

    it("handles empty directive values", () => {
      const analyzer = new CSPAnalyzer([]);
      const result = analyzer.generatePolicy({ ...defaultOptions, strictMode: true });

      // upgrade-insecure-requests has no value
      expect(result.policyString).toContain("upgrade-insecure-requests");
    });
  });
});
