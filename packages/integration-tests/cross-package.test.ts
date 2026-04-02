/**
 * Cross-Package Integration Tests
 *
 * Verifies that packages in the libztbs monorepo interact correctly:
 * - nrd + typosquat: combined threat scoring
 * - csp + data-export: policy generation flows into export pipeline
 * - @libztbs/types: shared types are compatible across package boundaries
 */

import { describe, it, expect } from "vitest";

// nrd
import {
  calculateSuspiciousScore,
  isHighRiskDomain,
} from "../core/src/nrd/suspicious.js";

// typosquat
import {
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
  DEFAULT_TYPOSQUAT_CONFIG,
} from "../core/src/typosquat/index.js";

// csp
import { CSPAnalyzer } from "../core/src/csp/analyzer.js";

// data-export
import {
  exportData,
  exportReportToMarkdown,
  toJSON,
} from "../core/src/data-export/exporter.js";

// types (shared)
import {
  scoreToRiskLevel5,
  RISK_SCORE_THRESHOLDS,
} from "../core/src/types/scoring.js";
import type { DetectedService } from "../core/src/types/index.js";

// alerts
import { scoreToRiskLevel5 as alertsScoreToRiskLevel5 } from "../core/src/alerts/scoring-utils.js";

// ---------------------------------------------------------------------------
// 1. nrd + typosquat combined scoring
// ---------------------------------------------------------------------------
describe("nrd + typosquat: combined threat scoring", () => {
  it("domain flagged by both nrd-suspicious and typosquat compounds risk", () => {
    // A domain with Cyrillic homoglyphs AND suspicious NRD patterns
    // \u0430 = Cyrillic 'a', \u0435 = Cyrillic 'e' — looks like "apple" but isn't
    const maliciousDomain = "\u0430ppl\u0435.xyz";

    const nrdScores = calculateSuspiciousScore(maliciousDomain);
    const typosquatScores = calculateTyposquatHeuristics(
      maliciousDomain,
      DEFAULT_TYPOSQUAT_CONFIG,
    );

    // Both detectors should flag this domain independently
    expect(nrdScores.totalScore).toBeGreaterThan(0);
    expect(typosquatScores.totalScore).toBeGreaterThan(0);

    // Suspicious TLD (.xyz) should be detected by nrd
    expect(nrdScores.suspiciousTLD).toBe(true);

    // Mixed script (Latin + Cyrillic) should be detected by typosquat
    expect(typosquatScores.hasMixedScript).toBe(true);

    // Combined risk should exceed either individual threshold
    const combinedScore = Math.min(
      nrdScores.totalScore + typosquatScores.totalScore,
      100,
    );
    expect(combinedScore).toBeGreaterThan(nrdScores.totalScore);
    expect(combinedScore).toBeGreaterThan(typosquatScores.totalScore);
  });

  it("benign domain scores low on both detectors", () => {
    const benignDomain = "google.com";

    const nrdScores = calculateSuspiciousScore(benignDomain);
    const typosquatScores = calculateTyposquatHeuristics(
      benignDomain,
      DEFAULT_TYPOSQUAT_CONFIG,
    );

    expect(isHighRiskDomain(nrdScores, 50)).toBe(false);
    expect(isHighRiskTyposquat(typosquatScores, 30)).toBe(false);
  });

  it("risk level from @libztbs/types is consistent for combined scores", () => {
    const suspiciousDomain = "xn--80ak6aa92e.xyz"; // Punycode + suspicious TLD

    const nrdScores = calculateSuspiciousScore(suspiciousDomain);
    const typosquatScores = calculateTyposquatHeuristics(
      suspiciousDomain,
      DEFAULT_TYPOSQUAT_CONFIG,
    );

    const combinedScore = Math.min(
      nrdScores.totalScore + typosquatScores.totalScore,
      100,
    );
    const riskLevel = scoreToRiskLevel5(combinedScore);

    // Combined score should map to a valid risk level
    expect(["critical", "high", "medium", "low", "info"]).toContain(riskLevel);

    // A higher combined score should yield a higher-or-equal risk level
    const nrdOnlyLevel = scoreToRiskLevel5(nrdScores.totalScore);
    const riskOrder = ["info", "low", "medium", "high", "critical"];
    expect(riskOrder.indexOf(riskLevel)).toBeGreaterThanOrEqual(
      riskOrder.indexOf(nrdOnlyLevel),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. csp -> data-export pipeline
// ---------------------------------------------------------------------------
describe("csp -> data-export: policy generation to export", () => {
  const sampleReports = [
    {
      type: "csp-violation" as const,
      directive: "script-src",
      blockedURL: "https://cdn.example.com/script.js",
      pageUrl: "https://app.example.com/page",
      domain: "cdn.example.com",
      timestamp: Date.now(),
    },
    {
      type: "network-request" as const,
      url: "https://api.example.com/data",
      initiator: "xmlhttprequest",
      resourceType: "xmlhttprequest",
      pageUrl: "https://app.example.com/page",
      domain: "api.example.com",
      timestamp: Date.now(),
    },
  ];

  it("CSP policy output is exportable as JSON via data-export", () => {
    const analyzer = new CSPAnalyzer(sampleReports);
    const policy = analyzer.generatePolicy({
      defaultSrc: "'self'",
      strictMode: false,
      includeReportUri: false,
      reportUri: "",
    });

    // Verify CSP policy has expected structure
    expect(policy.policyString).toBeTruthy();
    expect(policy.statistics.totalReports).toBe(2);

    // Export the policy through data-export pipeline
    const result = exportData(policy, {
      format: "json",
      dataType: "full_report",
    });

    expect(result.success).toBe(true);
    expect(result.format).toBe("json");

    // Verify the exported content is valid JSON containing the policy
    const parsed = JSON.parse(result.content);
    expect(parsed.policyString).toBe(policy.policyString);
    expect(parsed.statistics.totalReports).toBe(2);
  });

  it("CSP recommendations are serializable via toJSON", () => {
    const analyzer = new CSPAnalyzer(sampleReports);
    const policy = analyzer.generatePolicy({
      defaultSrc: "'self'",
      strictMode: false,
      includeReportUri: false,
      reportUri: "",
    });

    const json = toJSON(policy.recommendations);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    for (const rec of parsed) {
      expect(rec).toHaveProperty("severity");
      expect(rec).toHaveProperty("directive");
      expect(rec).toHaveProperty("message");
    }
  });

  it("CSP statistics integrate into a full SecurityReport for markdown export", () => {
    const analyzer = new CSPAnalyzer(sampleReports);
    const policy = analyzer.generatePolicy({
      defaultSrc: "'self'",
      strictMode: true,
      includeReportUri: false,
      reportUri: "",
    });

    // Build a SecurityReport that includes CSP-derived data
    const report = {
      metadata: {
        generatedAt: Date.now(),
        reportPeriod: { start: Date.now() - 86400000, end: Date.now() },
        version: "0.2.0",
        exportFormat: "markdown" as const,
      },
      summary: {
        totalServices: 1,
        totalViolations: policy.statistics.cspViolations,
        totalAlerts: 0,
        securityScore: 75,
        riskDistribution: { low: 1 },
        topRisks: policy.recommendations.map((r) => r.message),
      },
      services: [],
      violations: [],
      alerts: [],
      permissions: [],
      compliance: {
        framework: "CSP Best Practices",
        overallScore: 80,
        controlsPassed: 3,
        controlsFailed: 1,
        controls: [],
      },
    };

    const markdown = exportReportToMarkdown(report);

    expect(markdown).toContain("Pleno Audit Security Report");
    expect(markdown).toContain("75");
    expect(markdown).toContain("CSP Best Practices");
  });
});

// ---------------------------------------------------------------------------
// 3. Type compatibility across packages
// ---------------------------------------------------------------------------
describe("type compatibility: @libztbs/types across packages", () => {
  it("DetectedService type accepts nrd and typosquat results", () => {
    const domain = "test-domain.tk";

    const nrdScores = calculateSuspiciousScore(domain);
    const typosquatScores = calculateTyposquatHeuristics(
      domain,
      DEFAULT_TYPOSQUAT_CONFIG,
    );

    // Construct a DetectedService using results from both packages
    const service: DetectedService = {
      domain,
      detectedAt: Date.now(),
      hasLoginPage: false,
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      cookies: [],
      nrdResult: {
        isNRD: isHighRiskDomain(nrdScores, 50),
        confidence: nrdScores.totalScore >= 60 ? "high" : "low",
        domainAge: null,
        checkedAt: Date.now(),
      },
      typosquatResult: {
        isTyposquat: isHighRiskTyposquat(
          typosquatScores,
          DEFAULT_TYPOSQUAT_CONFIG.heuristicThreshold,
        ),
        confidence:
          typosquatScores.totalScore >= 60
            ? "high"
            : typosquatScores.totalScore >= 30
              ? "medium"
              : "none",
        totalScore: typosquatScores.totalScore,
        checkedAt: Date.now(),
      },
    };

    // Validate the unified service model is well-formed
    expect(service.domain).toBe(domain);
    expect(typeof service.nrdResult?.isNRD).toBe("boolean");
    expect(typeof service.typosquatResult?.isTyposquat).toBe("boolean");
    expect(typeof service.typosquatResult?.totalScore).toBe("number");
  });

  it("scoreToRiskLevel5 re-exported from alerts matches types package", () => {
    // Both should produce identical results — they re-export the same function
    for (const score of [0, 19, 20, 39, 40, 59, 60, 79, 80, 100]) {
      expect(alertsScoreToRiskLevel5(score)).toBe(scoreToRiskLevel5(score));
    }
  });

  it("RISK_SCORE_THRESHOLDS are usable for nrd/typosquat threshold decisions", () => {
    // Verify thresholds are numeric and ordered
    expect(RISK_SCORE_THRESHOLDS.LOW).toBeLessThan(
      RISK_SCORE_THRESHOLDS.MEDIUM,
    );
    expect(RISK_SCORE_THRESHOLDS.MEDIUM).toBeLessThan(
      RISK_SCORE_THRESHOLDS.HIGH,
    );
    expect(RISK_SCORE_THRESHOLDS.HIGH).toBeLessThan(
      RISK_SCORE_THRESHOLDS.CRITICAL,
    );

    // Use thresholds to classify an nrd score
    const scores = calculateSuspiciousScore("xyzabc123.tk");
    const isHighByThreshold =
      scores.totalScore >= RISK_SCORE_THRESHOLDS.HIGH;
    const isHighByHelper = isHighRiskDomain(
      scores,
      RISK_SCORE_THRESHOLDS.HIGH,
    );
    expect(isHighByThreshold).toBe(isHighByHelper);
  });
});
