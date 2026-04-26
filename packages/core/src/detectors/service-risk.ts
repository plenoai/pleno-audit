/**
 * @fileoverview Service Risk Scoring
 *
 * 検出サービスのリスクフラグ・リスクスコアを算出する純粋関数群。
 * UI に依存せず、dismiss 済みアラートを考慮した「実効リスク」を返す。
 */

import type { DetectedService } from "../types/index.js";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface DomainAlertSummary {
  total: number;
  maxSeverity: AlertSeverity;
}

export type RiskLevel = "high" | "medium" | "low" | "none";

export type ServiceRiskFlag =
  | { kind: "nrd"; confidence: string; domainAge: number | null }
  | { kind: "typosquat"; score: number; confidence: string }
  | { kind: "login" }
  | { kind: "ai" }
  | { kind: "sensitive-data"; dataType: string };

const DISMISS_PATTERN_SEPARATOR = "::";

export function buildDismissPattern(category: string, domain: string): string {
  return `${category}${DISMISS_PATTERN_SEPARATOR}${domain}`;
}

export function isPatternDismissed(
  dismissedPatterns: ReadonlySet<string> | undefined,
  category: string,
  domain: string,
): boolean {
  return dismissedPatterns?.has(buildDismissPattern(category, domain)) ?? false;
}

export function getServiceRiskFlags(
  service: DetectedService,
  dismissedPatterns?: ReadonlySet<string>,
): ServiceRiskFlag[] {
  const flags: ServiceRiskFlag[] = [];

  if (
    service.nrdResult?.isNRD &&
    !isPatternDismissed(dismissedPatterns, "nrd", service.domain)
  ) {
    flags.push({
      kind: "nrd",
      confidence: service.nrdResult.confidence,
      domainAge: service.nrdResult.domainAge,
    });
  }

  if (
    service.typosquatResult?.isTyposquat &&
    !isPatternDismissed(dismissedPatterns, "typosquat", service.domain)
  ) {
    flags.push({
      kind: "typosquat",
      score: service.typosquatResult.totalScore,
      confidence: service.typosquatResult.confidence,
    });
  }

  if (service.hasLoginPage) flags.push({ kind: "login" });
  if (service.aiDetected?.hasAIActivity) flags.push({ kind: "ai" });

  for (const dataType of service.sensitiveDataDetected ?? []) {
    flags.push({ kind: "sensitive-data", dataType });
  }

  return flags;
}

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

export interface ServiceRiskInputs {
  service: DetectedService;
  connectionCount?: number;
  alertSummary?: DomainAlertSummary;
  dismissedPatterns?: ReadonlySet<string>;
}

export function computeServiceRiskScore(inputs: ServiceRiskInputs): number {
  const { service, connectionCount = 0, alertSummary, dismissedPatterns } = inputs;
  let score = 0;

  if (
    service.nrdResult?.isNRD &&
    !isPatternDismissed(dismissedPatterns, "nrd", service.domain)
  ) {
    score += 40;
    if (service.nrdResult.confidence === "high") score += 10;
    else if (service.nrdResult.confidence === "medium") score += 5;
    if (service.nrdResult.domainAge !== null && service.nrdResult.domainAge < 30) {
      score += 5;
    }
  }

  if (
    service.typosquatResult?.isTyposquat &&
    !isPatternDismissed(dismissedPatterns, "typosquat", service.domain)
  ) {
    score += 25 + Math.min(10, service.typosquatResult.totalScore);
  }

  if (service.aiDetected?.hasAIActivity) score += 5;
  if (service.hasLoginPage) score += 5;
  if (!service.privacyPolicyUrl) score += 3;
  if (!service.termsOfServiceUrl) score += 3;
  if (connectionCount > 20) score += 3;
  if (alertSummary && alertSummary.total > 0) {
    score += SEVERITY_WEIGHT[alertSummary.maxSeverity] ?? 0;
  }

  return Math.min(100, score);
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 40) return "high";
  if (score >= 15) return "medium";
  if (score >= 8) return "low";
  return "none";
}
