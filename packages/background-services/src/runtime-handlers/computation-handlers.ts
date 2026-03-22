import type { DetectedService } from "@pleno-audit/casb-types";
import { analyzePrompt } from "@pleno-audit/ai-detector";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import type { AlertSeverity, AlertCategory } from "@pleno-audit/alerts";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

interface EventItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  domain: string;
  timestamp: number;
}

interface ConnectionInfo {
  domain: string;
  requestCount: number;
}

type ServiceTag =
  | { type: "nrd"; domainAge: number | null; confidence: string }
  | { type: "typosquat"; score: number; confidence: string }
  | { type: "ai" }
  | { type: "login" }
  | { type: "privacy"; url: string }
  | { type: "tos"; url: string }
  | { type: "cookie"; count: number };

type ServiceSource =
  | { type: "domain"; domain: string; service: DetectedService }
  | { type: "extension"; extensionId: string; extensionName: string; icon?: string };

interface UnifiedService {
  id: string;
  source: ServiceSource;
  connections: ConnectionInfo[];
  tags: ServiceTag[];
  lastActivity: number;
  faviconUrl?: string;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function extractTags(service: DetectedService): ServiceTag[] {
  const tags: ServiceTag[] = [];
  if (service.nrdResult?.isNRD) {
    tags.push({ type: "nrd", domainAge: service.nrdResult.domainAge, confidence: service.nrdResult.confidence });
  }
  if (service.typosquatResult?.isTyposquat) {
    tags.push({ type: "typosquat", score: service.typosquatResult.totalScore, confidence: service.typosquatResult.confidence });
  }
  if (service.aiDetected?.hasAIActivity) tags.push({ type: "ai" });
  if (service.hasLoginPage) tags.push({ type: "login" });
  if (service.privacyPolicyUrl) tags.push({ type: "privacy", url: service.privacyPolicyUrl });
  if (service.termsOfServiceUrl) tags.push({ type: "tos", url: service.termsOfServiceUrl });
  if (service.cookies.length > 0) tags.push({ type: "cookie", count: service.cookies.length });
  return tags;
}


function convertToEvents(
  services: DetectedService[],
  violations: CSPViolation[],
  networkRequests: NetworkRequest[],
  aiPrompts: CapturedAIPrompt[],
  doHRequests: { id: string; domain: string; timestamp: number; blocked: boolean }[]
): EventItem[] {
  const events: EventItem[] = [];

  for (const service of services) {
    if (service.nrdResult?.isNRD) {
      const age = service.nrdResult.domainAge;
      events.push({
        id: `nrd-${service.domain}`,
        category: "nrd",
        severity: age !== null && age < 7 ? "critical" : "high",
        title: service.domain,
        domain: service.domain,
        timestamp: service.nrdResult.checkedAt,
      });
    }
    if (service.typosquatResult?.isTyposquat) {
      const score = service.typosquatResult.totalScore;
      events.push({
        id: `typosquat-${service.domain}`,
        category: "typosquat",
        severity: score >= 70 ? "critical" : score >= 40 ? "high" : "medium",
        title: service.domain,
        domain: service.domain,
        timestamp: service.typosquatResult.checkedAt,
      });
    }
  }

  for (const prompt of aiPrompts) {
    const { pii, risk } = analyzePrompt(prompt.prompt);
    if (pii.hasSensitiveData) {
      if (risk.riskLevel !== "info" && risk.riskLevel !== "low") {
        let domain: string;
        try { domain = new URL(prompt.apiEndpoint).hostname; } catch { domain = prompt.apiEndpoint; }
        events.push({
          id: `ai-${prompt.id}`,
          category: "ai_sensitive",
          severity: risk.riskLevel,
          title: prompt.provider || domain,
          domain,
          timestamp: prompt.timestamp,
        });
      }
    }
  }

  for (const v of violations.slice(0, 50)) {
    let domain: string;
    try { domain = new URL(v.pageUrl).hostname; } catch { domain = v.pageUrl; }
    events.push({
      id: `csp-${v.timestamp}-${v.blockedURL}`,
      category: "csp_violation",
      severity: v.directive === "script-src" || v.directive === "default-src" ? "high" : "medium",
      title: v.directive,
      domain,
      timestamp: new Date(v.timestamp).getTime(),
    });
  }

  for (const r of doHRequests.slice(0, 20)) {
    events.push({
      id: `doh-${r.id}`,
      category: "shadow_ai",
      severity: r.blocked ? "high" : "medium",
      title: r.domain,
      domain: r.domain,
      timestamp: r.timestamp,
    });
  }

  for (const req of networkRequests.slice(0, 100)) {
    let domain: string;
    try { domain = new URL(req.url).hostname; } catch { domain = req.url; }
    events.push({
      id: `net-${req.timestamp}-${req.url}`,
      category: "network" as AlertCategory,
      severity: "info",
      title: `${req.method} ${domain}`,
      domain,
      timestamp: new Date(req.timestamp).getTime(),
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function createComputationHandlers(
  deps: RuntimeHandlerDependencies
): AsyncHandlerEntry[] {
  return [
    [
      "GET_POPUP_EVENTS",
      {
        execute: async () => {
          const [services, violationsResult, networkResult, aiPrompts, doHResult] =
            await Promise.all([
              deps.getServices(),
              deps.getCSPReports({ type: "csp-violation", limit: 500 }),
              deps.getNetworkRequests({ limit: 500 }),
              deps.getAIPrompts(),
              deps.getDoHRequests({ limit: 100 }),
            ]);

          const violations = Array.isArray(violationsResult)
            ? violationsResult
            : (violationsResult as { reports?: CSPViolation[] })?.reports ?? [];
          const networkRequests = Array.isArray(networkResult)
            ? networkResult
            : (networkResult as { requests?: NetworkRequest[] })?.requests ?? [];
          const doHRequests = (doHResult as { requests?: { id: string; domain: string; timestamp: number; blocked: boolean }[] })?.requests ?? [];

          const events = convertToEvents(services, violations, networkRequests, aiPrompts, doHRequests);

          const counts: Record<string, number> = {};
          for (const e of events) {
            counts[e.severity] = (counts[e.severity] || 0) + 1;
          }

          return { events, counts, total: events.length };
        },
        fallback: () => ({ events: [], counts: {}, total: 0 }),
      },
    ],
    [
      "GET_AGGREGATED_SERVICES",
      {
        execute: async () => {
          const [services, serviceConnections, extensionConnections, knownExtensions] =
            await Promise.all([
              deps.getServices(),
              deps.getServiceConnections(),
              deps.getExtensionConnections(),
              Promise.resolve(deps.getKnownExtensions()),
            ]);

          const result: UnifiedService[] = [];

          for (const service of services) {
            const destMap = serviceConnections[service.domain];
            const connections: ConnectionInfo[] = destMap
              ? Object.entries(destMap)
                  .map(([domain, requestCount]) => ({ domain, requestCount }))
                  .sort((a, b) => b.requestCount - a.requestCount)
              : [];
            result.push({
              id: `domain:${service.domain}`,
              source: { type: "domain", domain: service.domain, service },
              connections,
              tags: extractTags(service),
              lastActivity: service.detectedAt,
              faviconUrl: service.faviconUrl,
            });
          }

          // Add extensions from pre-aggregated extensionConnections
          const extMap = knownExtensions as Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }>;

          for (const [id, ext] of Object.entries(extMap)) {
            const icon = ext.icons?.find((ic) => ic.size >= 16)?.url || ext.icons?.[0]?.url;
            const destMap = extensionConnections[id];
            const connections: ConnectionInfo[] = destMap
              ? Object.entries(destMap)
                  .map(([domain, requestCount]) => ({ domain, requestCount }))
                  .sort((a, b) => b.requestCount - a.requestCount)
              : [];
            result.push({
              id: `extension:${id}`,
              source: { type: "extension", extensionId: id, extensionName: ext.name, icon },
              connections,
              tags: [],
              lastActivity: 0,
            });
          }

          return result;
        },
        fallback: () => [],
      },
    ],
  ];
}
