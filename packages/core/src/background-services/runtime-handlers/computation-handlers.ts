import type { DetectedService } from "../../types/index.js";
import type { AlertSeverity, AlertCategory, DismissReason } from "../../alerts/index.js";
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

type ServiceSource =
  | { type: "domain"; domain: string; service: DetectedService }
  | { type: "extension"; extensionId: string; extensionName: string; icon?: string };

interface UnifiedService {
  id: string;
  source: ServiceSource;
  connections: ConnectionInfo[];
  lastActivity: number;
  faviconUrl?: string;
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

const DISMISS_RECORDS_KEY = "pleno_dismiss_records";
const OLD_DISMISSED_PATTERNS_KEY = "pleno_dismissed_alert_patterns";

interface DismissRecordStorage {
  pattern: string;
  reason: DismissReason;
  comment?: string;
  dismissedAt: number;
  reopenedAt?: number;
  alertSnapshot: {
    category: string;
    domain: string;
    severity: string;
    title: string;
  };
}

async function migrateDismissedPatterns(): Promise<void> {
  const result = await chrome.storage.local.get([OLD_DISMISSED_PATTERNS_KEY, DISMISS_RECORDS_KEY]);
  const oldPatterns: string[] = (result[OLD_DISMISSED_PATTERNS_KEY] as string[] | undefined) ?? [];
  if (oldPatterns.length === 0) return;

  const existing: DismissRecordStorage[] = (result[DISMISS_RECORDS_KEY] as DismissRecordStorage[] | undefined) ?? [];
  const existingSet = new Set(existing.map((r) => r.pattern));
  const newRecords = [...existing];

  for (const pattern of oldPatterns) {
    if (existingSet.has(pattern)) continue;
    const [category, ...domainParts] = pattern.split("::");
    const domain = domainParts.join("::");
    newRecords.push({
      pattern,
      reason: "wont_fix",
      dismissedAt: Date.now(),
      alertSnapshot: { category, domain, severity: "medium", title: domain },
    });
  }

  await chrome.storage.local.set({ [DISMISS_RECORDS_KEY]: newRecords });
  await chrome.storage.local.remove(OLD_DISMISSED_PATTERNS_KEY);
}

async function getDismissRecords(): Promise<DismissRecordStorage[]> {
  await migrateDismissedPatterns();
  const result = await chrome.storage.local.get(DISMISS_RECORDS_KEY);
  return (result[DISMISS_RECORDS_KEY] as DismissRecordStorage[] | undefined) ?? [];
}

async function getDismissedPatterns(): Promise<Set<string>> {
  const records = await getDismissRecords();
  return new Set(
    records.filter((r) => r.reopenedAt == null).map((r) => r.pattern),
  );
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
          const data = message.data as
            | { category: string; domain: string; severity?: string; title?: string; reason?: DismissReason; comment?: string }
            | { patterns: { category: string; domain: string; severity?: string; title?: string }[]; reason?: DismissReason; comment?: string };

          const records = await getDismissRecords();
          const existingSet = new Set(records.map((r) => r.pattern));
          const reason = ("reason" in data && data.reason) ? data.reason : "wont_fix";
          const comment = ("comment" in data && data.comment) ? data.comment : undefined;
          const now = Date.now();

          if ("patterns" in data) {
            for (const p of data.patterns) {
              const pattern = `${p.category}::${p.domain}`;
              if (existingSet.has(pattern)) {
                // Reopen済みの場合は新しいレコードとして再dismiss
                const idx = records.findIndex((r) => r.pattern === pattern && r.reopenedAt != null);
                if (idx >= 0) {
                  records[idx] = {
                    ...records[idx],
                    reason,
                    comment,
                    dismissedAt: now,
                    reopenedAt: undefined,
                  };
                }
                continue;
              }
              records.push({
                pattern,
                reason,
                comment,
                dismissedAt: now,
                alertSnapshot: {
                  category: p.category,
                  domain: p.domain,
                  severity: p.severity ?? "medium",
                  title: p.title ?? p.domain,
                },
              });
            }
          } else {
            const pattern = `${data.category}::${data.domain}`;
            if (existingSet.has(pattern)) {
              const idx = records.findIndex((r) => r.pattern === pattern && r.reopenedAt != null);
              if (idx >= 0) {
                records[idx] = {
                  ...records[idx],
                  reason,
                  comment,
                  dismissedAt: now,
                  reopenedAt: undefined,
                };
              }
            } else {
              records.push({
                pattern,
                reason,
                comment,
                dismissedAt: now,
                alertSnapshot: {
                  category: data.category,
                  domain: data.domain,
                  severity: data.severity ?? "medium",
                  title: data.title ?? data.domain,
                },
              });
            }
          }

          await chrome.storage.local.set({ [DISMISS_RECORDS_KEY]: records });
          return { ok: true };
        },
        fallback: () => ({ ok: false }),
      },
    ],
    [
      "REOPEN_DISMISSED_PATTERN",
      {
        execute: async (message) => {
          const data = message.data as { pattern: string };
          const records = await getDismissRecords();
          const idx = records.findIndex(
            (r) => r.pattern === data.pattern && r.reopenedAt == null,
          );
          if (idx >= 0) {
            records[idx] = { ...records[idx], reopenedAt: Date.now() };
            await chrome.storage.local.set({ [DISMISS_RECORDS_KEY]: records });
          }
          return { ok: true };
        },
        fallback: () => ({ ok: false }),
      },
    ],
    [
      "GET_DISMISS_RECORDS",
      {
        execute: async () => {
          const records = await getDismissRecords();
          return records;
        },
        fallback: () => [],
      },
    ],
    [
      "DELETE_DISMISS_RECORD",
      {
        execute: async (message) => {
          const data = message.data as { pattern: string };
          const records = await getDismissRecords();
          const filtered = records.filter((r) => r.pattern !== data.pattern);
          await chrome.storage.local.set({ [DISMISS_RECORDS_KEY]: filtered });
          return { ok: true };
        },
        fallback: () => ({ ok: false }),
      },
    ],
    [
      "DELETE_SERVICE",
      {
        execute: async (message) => {
          const data = message.data as { domain: string };
          const [servicesResult, connectionsResult] = await Promise.all([
            chrome.storage.local.get("services"),
            chrome.storage.local.get("serviceConnections"),
          ]);

          const services = (servicesResult.services ?? {}) as Record<string, DetectedService>;
          const connections = (connectionsResult.serviceConnections ?? {}) as Record<string, string[]>;

          delete services[data.domain];
          delete connections[data.domain];

          await chrome.storage.local.set({ services, serviceConnections: connections });
          return { ok: true, domain: data.domain };
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
