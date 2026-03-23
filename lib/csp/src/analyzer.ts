/**
 * CSP Policy Analyzer and Generator
 * Analyzes collected CSP violations and network requests to generate policies
 */

import type {
  CSPReport,
  GeneratedCSPPolicy,
  CSPStatistics,
  SecurityRecommendation,
  CSPGenerationOptions,
} from "./types.js";
import { INITIATOR_TO_DIRECTIVE, REQUIRED_DIRECTIVES } from "./constants.js";

export interface DomainCSPPolicy {
  domain: string;
  policy: GeneratedCSPPolicy;
  reportCount: number;
}

export interface GeneratedCSPByDomain {
  policies: DomainCSPPolicy[];
  totalDomains: number;
}

export class CSPAnalyzer {
  private reports: CSPReport[];

  constructor(reports: CSPReport[] = []) {
    this.reports = reports;
  }

  /**
   * Generate CSP policies grouped by page origin (source domain)
   */
  generatePolicyByDomain(options: CSPGenerationOptions): GeneratedCSPByDomain {
    const reportsByDomain = this.groupReportsByPageOrigin();
    const policies: DomainCSPPolicy[] = [];

    for (const [domain, domainReports] of Object.entries(reportsByDomain)) {
      const analyzer = new CSPAnalyzer(domainReports);
      const policy = analyzer.generatePolicy(options);
      policies.push({
        domain,
        policy,
        reportCount: domainReports.length,
      });
    }

    // Sort by report count descending
    policies.sort((a, b) => b.reportCount - a.reportCount);

    return {
      policies,
      totalDomains: policies.length,
    };
  }

  private groupReportsByPageOrigin(): Record<string, CSPReport[]> {
    const grouped: Record<string, CSPReport[]> = {};

    for (const report of this.reports) {
      const pageOrigin = this.extractOrigin(report.pageUrl);
      if (!pageOrigin) continue;

      if (!grouped[pageOrigin]) {
        grouped[pageOrigin] = [];
      }
      grouped[pageOrigin].push(report);
    }

    return grouped;
  }

  private extractOrigin(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  generatePolicy(options: CSPGenerationOptions): GeneratedCSPPolicy {
    const directives = this.aggregateByDirective();
    const policy = this.buildPolicy(directives, options);

    return {
      policy,
      policyString: this.policyToString(policy),
      statistics: this.generateStatistics(),
      recommendations: this.generateRecommendations(policy),
    };
  }

  private aggregateByDirective(): Record<string, Set<string>> {
    const directives: Record<string, Set<string>> = {};

    for (const report of this.reports) {
      let directive: string;

      if (report.type === "csp-violation") {
        directive = report.directive;
      } else {
        directive =
          INITIATOR_TO_DIRECTIVE[report.initiator] ||
          INITIATOR_TO_DIRECTIVE[report.resourceType || ""] ||
          "default-src";
      }

      directive = this.normalizeDirectiveName(directive);

      if (!directives[directive]) {
        directives[directive] = new Set();
      }

      const url =
        report.type === "csp-violation" ? report.blockedURL : report.url;
      if (url && url !== "inline" && url !== "eval") {
        directives[directive].add(url);
      }
    }

    return directives;
  }

  private buildPolicy(
    directives: Record<string, Set<string>>,
    options: CSPGenerationOptions
  ): Record<string, string[]> {
    const policy: Record<string, string[]> = {
      "default-src": [options.defaultSrc],
    };

    for (const [directive, urls] of Object.entries(directives)) {
      policy[directive] = this.normalizeUrls(
        Array.from(urls),
        options.strictMode
      );
    }

    if (!policy["script-src"]) {
      policy["script-src"] = options.strictMode
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"];
    }

    if (!policy["style-src"]) {
      policy["style-src"] = options.strictMode
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"];
    }

    if (options.includeReportUri) {
      policy["report-uri"] = [options.reportUri];
      policy["report-to"] = ["csp-endpoint"];
    }

    if (!policy["frame-ancestors"]) {
      policy["frame-ancestors"] = ["'self'"];
    }

    if (!policy["base-uri"]) {
      policy["base-uri"] = ["'self'"];
    }

    if (options.strictMode) {
      policy["upgrade-insecure-requests"] = [];
    }

    return policy;
  }

  private normalizeUrls(urls: string[], strictMode: boolean): string[] {
    const sources = new Set(["'self'"]);

    for (const url of urls) {
      try {
        const parsed = new URL(url);

        if (strictMode) {
          sources.add(parsed.origin);
        } else {
          const hostname = parsed.hostname;
          const parts = hostname.split(".");

          if (parts.length >= 2) {
            const baseDomain = parts.slice(-2).join(".");
            sources.add(`*.${baseDomain}`);
          } else {
            sources.add(parsed.origin);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return Array.from(sources);
  }

  private normalizeDirectiveName(directive: string): string {
    const mapping: Record<string, string> = {
      "script-src-elem": "script-src",
      "script-src-attr": "script-src",
      "style-src-elem": "style-src",
      "style-src-attr": "style-src",
    };

    return mapping[directive] || directive;
  }

  private policyToString(policy: Record<string, string[]>): string {
    return Object.entries(policy)
      .map(([directive, values]) => {
        if (values.length === 0) {
          return directive;
        }
        return `${directive} ${values.join(" ")}`;
      })
      .join("; ");
  }

  private generateStatistics(): CSPStatistics {
    const stats: CSPStatistics = {
      totalReports: this.reports.length,
      cspViolations: 0,
      networkRequests: 0,
      uniqueDomains: [],
      byDirective: {},
      byDomain: {},
    };

    const uniqueDomains = new Set<string>();

    for (const report of this.reports) {
      if (report.type === "csp-violation") {
        stats.cspViolations++;
      } else {
        stats.networkRequests++;
      }

      const domain = report.domain;
      if (domain) {
        uniqueDomains.add(domain);
        stats.byDomain[domain] = (stats.byDomain[domain] ?? 0) + 1;
      }

      const directive =
        report.type === "csp-violation" ? report.directive : "unknown";
      stats.byDirective[directive] = (stats.byDirective[directive] ?? 0) + 1;
    }

    stats.uniqueDomains = Array.from(uniqueDomains);

    return stats;
  }

  private generateRecommendations(
    policy: Record<string, string[]>
  ): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    for (const [directive, values] of Object.entries(policy)) {
      if (values.includes("'unsafe-inline'")) {
        recommendations.push({
          severity: "high",
          directive,
          message: `${directive} contains 'unsafe-inline'. This reduces CSP protection.`,
          suggestion: "Use 'nonce-<base64>' or 'sha256-<hash>' instead",
        });
      }

      if (values.includes("'unsafe-eval'")) {
        recommendations.push({
          severity: "critical",
          directive,
          message: `${directive} contains 'unsafe-eval'. This significantly weakens CSP.`,
          suggestion: "Remove 'unsafe-eval' and refactor code to avoid eval()",
        });
      }

      if (values.some((v) => v === "*" || v === "data:" || v === "blob:")) {
        const permissive = values.find(
          (v) => v === "*" || v === "data:" || v === "blob:"
        );
        recommendations.push({
          severity: "medium",
          directive,
          message: `${directive} contains overly permissive source '${permissive}'`,
          suggestion: "Restrict to specific domains",
        });
      }
    }

    for (const directive of REQUIRED_DIRECTIVES) {
      if (!policy[directive]) {
        recommendations.push({
          severity: "medium",
          directive,
          message: `Missing recommended directive: ${directive}`,
          suggestion: `Add ${directive} to your policy`,
        });
      }
    }

    if (!policy["object-src"]?.includes("'none'")) {
      recommendations.push({
        severity: "low",
        directive: "object-src",
        message: "object-src should be set to 'none' unless plugins are required",
        suggestion: "Set object-src to 'none'",
      });
    }

    return recommendations;
  }
}
