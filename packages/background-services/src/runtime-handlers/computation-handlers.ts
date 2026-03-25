import type { DetectedService } from "@libztbs/types";
import type { AlertSeverity, AlertCategory } from "@libztbs/alerts";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

interface EventItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  url?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

interface ConnectionInfo {
  domain: string;
}

type ServiceTag =
  | { type: "nrd"; domainAge: number | null; confidence: string }
  | { type: "typosquat"; score: number; confidence: string }
  | { type: "ai" }
  | { type: "login" }
  | { type: "privacy"; url: string }
  | { type: "tos"; url: string }
  | { type: "cookie"; count: number }
  | { type: "sensitive_data"; dataTypes: string[] };

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
  if (service.sensitiveDataDetected?.length) tags.push({ type: "sensitive_data", dataTypes: service.sensitiveDataDetected });
  return tags;
}


/** Postureからリスク検出をAlert形式で抽出 */
function extractPostureAlerts(
  services: DetectedService[],
): EventItem[] {
  const alerts: EventItem[] = [];

  for (const service of services) {
    if (service.nrdResult?.isNRD) {
      const age = service.nrdResult.domainAge;
      alerts.push({
        id: `nrd-${service.domain}`,
        category: "nrd",
        severity: age !== null && age < 7 ? "critical" : "high",
        title: service.domain,
        description: `新規登録ドメイン（${age !== null ? `${age}日前` : "日数不明"}）`,
        domain: service.domain,
        timestamp: service.nrdResult.checkedAt,
        details: { domainAge: age, confidence: service.nrdResult.confidence },
      });
    }
    if (service.typosquatResult?.isTyposquat) {
      const score = service.typosquatResult.totalScore;
      alerts.push({
        id: `typosquat-${service.domain}`,
        category: "typosquat",
        severity: score >= 70 ? "critical" : score >= 40 ? "high" : "medium",
        title: service.domain,
        description: `タイポスクワット検出（スコア: ${score}）`,
        domain: service.domain,
        timestamp: service.typosquatResult.checkedAt,
        details: { score, confidence: service.typosquatResult.confidence },
      });
    }
  }

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

const DISMISSED_PATTERNS_KEY = "pleno_dismissed_alert_patterns";

async function getDismissedPatterns(): Promise<Set<string>> {
  const result = await chrome.storage.local.get(DISMISSED_PATTERNS_KEY);
  const patterns: string[] = (result[DISMISSED_PATTERNS_KEY] as string[] | undefined) ?? [];
  return new Set(patterns);
}

export function createComputationHandlers(
  deps: RuntimeHandlerDependencies
): AsyncHandlerEntry[] {
  return [
    [
      "GET_POPUP_EVENTS",
      {
        execute: async () => {
          const [services, securityAlerts, dismissed] = await Promise.all([
            deps.getServices(),
            deps.getAlerts({ limit: 200 }),
            getDismissedPatterns(),
          ]);

          const postureAlerts = extractPostureAlerts(services);
          const realtimeAlerts: EventItem[] = securityAlerts.map((a) => ({
            id: a.id,
            category: a.category,
            severity: a.severity,
            title: a.title,
            description: a.description,
            domain: a.domain,
            url: a.url,
            timestamp: a.timestamp,
            details: a.details as unknown as Record<string, unknown> | undefined,
            count: (a as { count?: number }).count,
          }));

          const seenIds = new Set(postureAlerts.map((a) => a.id));
          let merged = [...postureAlerts];
          for (const a of realtimeAlerts) {
            if (!seenIds.has(a.id)) merged.push(a);
          }

          if (dismissed.size > 0) {
            merged = merged.filter(
              (a) => !dismissed.has(`${a.category}::${a.domain}`),
            );
          }

          merged.sort((a, b) => b.timestamp - a.timestamp);

          const counts: Record<string, number> = {};
          for (const a of merged) {
            counts[a.severity] = (counts[a.severity] || 0) + 1;
          }

          return { events: merged, counts, total: merged.length };
        },
        fallback: () => ({ events: [], counts: {}, total: 0 }),
      },
    ],
    [
      "DISMISS_ALERT_PATTERN",
      {
        execute: async (message) => {
          const data = message.data as { category: string; domain: string };
          const pattern = `${data.category}::${data.domain}`;
          const existing = await getDismissedPatterns();
          existing.add(pattern);
          await chrome.storage.local.set({
            [DISMISSED_PATTERNS_KEY]: [...existing],
          });
          return { ok: true, pattern };
        },
        fallback: () => ({ ok: false }),
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
            const destList = serviceConnections[service.domain];
            const connections: ConnectionInfo[] = destList
              ? destList.map((domain) => ({ domain }))
              : [];
            result.push({
              id: `domain:${service.domain}`,
              source: { type: "domain", domain: service.domain, service },
              connections,
              tags: extractTags(service),
              lastActivity: service.detectedAt,
              faviconUrl: service.faviconUrl ?? undefined,
            });
          }

          // Add extensions from pre-aggregated extensionConnections
          const extMap = knownExtensions as Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }>;

          for (const [id, ext] of Object.entries(extMap)) {
            const icon = ext.icons?.find((ic) => ic.size >= 16)?.url || ext.icons?.[0]?.url;
            const destList = extensionConnections[id];
            const connections: ConnectionInfo[] = destList
              ? destList.map((domain) => ({ domain }))
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
