import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { CapturedAIPrompt, DetectedService, EventLog } from "@pleno-audit/detectors";
import type { Notification } from "../../../components/NotificationBanner";
import type { Period, TabType, TotalCounts } from "../types";
import { getThreatNotification, isThreatEventType } from "../domain/events";
import { getPeriodMs, getStatusBadge } from "../utils";

interface UseDashboardStateOptions {
  period: Period;
  searchQuery: string;
  directiveFilter: string;
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => string;
  setActiveTab: (tab: TabType) => void;
}

export function useDashboardState({
  period,
  searchQuery,
  directiveFilter,
  addNotification,
  setActiveTab,
}: UseDashboardStateOptions) {
  const [reports, setReports] = useState<CSPReport[]>([]);
  const [totalCounts, setTotalCounts] = useState<TotalCounts>({
    violations: 0,
    networkRequests: 0,
    events: 0,
    aiPrompts: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<"local" | "remote">("local");
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [services, setServices] = useState<DetectedService[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastNotifiedEventId, setLastNotifiedEventId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const cutoffMs = Date.now() - getPeriodMs(period);
      const sinceISO = period !== "all" ? new Date(cutoffMs).toISOString() : undefined;
      const sinceTs = period !== "all" ? cutoffMs : undefined;

      const safeMessage = async <T,>(msg: object, fallback: T): Promise<T> => {
        try {
          return (await chrome.runtime.sendMessage(msg)) ?? fallback;
        } catch (error) {
          const type = (msg as { type?: string }).type ?? "unknown";
          console.warn(`[dashboard] Runtime message failed: ${type}`, error);
          return fallback;
        }
      };

      const [
        violationsResult,
        networkResult,
        configResult,
        aiPromptsResult,
        storageResult,
        eventsResult,
        eventsCountResult,
        aiPromptsCountResult,
      ] = await Promise.all([
        safeMessage(
          { type: "GET_CSP_REPORTS", data: { type: "csp-violation", since: sinceISO, limit: 500 } },
          { reports: [], total: 0 }
        ),
        safeMessage(
          { type: "GET_NETWORK_REQUESTS", data: { since: sinceTs, limit: 500 } },
          { requests: [], total: 0 }
        ),
        safeMessage({ type: "GET_CONNECTION_CONFIG" }, { mode: "local" }),
        safeMessage({ type: "GET_AI_PROMPTS" }, []),
        chrome.storage.local.get(["services"]).catch((error) => {
          console.warn("[dashboard] Failed to load services from chrome.storage.", error);
          return { services: {} };
        }),
        safeMessage({ type: "GET_EVENTS", data: { since: sinceTs, limit: 500 } }, { events: [], total: 0 }),
        safeMessage({ type: "GET_EVENTS_COUNT", data: { since: sinceTs } }, { count: 0 }),
        safeMessage({ type: "GET_AI_PROMPTS_COUNT" }, { count: 0 }),
      ]);

      const violationsData = Array.isArray(violationsResult)
        ? violationsResult
        : violationsResult?.reports ?? [];
      const networkData = Array.isArray(networkResult)
        ? networkResult
        : networkResult?.requests ?? [];
      const normalizedNetworkData = networkData.map((r: NetworkRequest) => ({
        ...r,
        type: "network-request" as const,
      }));
      setReports([...violationsData, ...normalizedNetworkData]);

      const violationsTotal = (violationsResult as { total?: number })?.total ?? violationsData.length;
      const networkTotal = (networkResult as { total?: number })?.total ?? networkData.length;
      setTotalCounts((prev) => ({
        ...prev,
        violations: violationsTotal,
        networkRequests: networkTotal,
      }));

      if (configResult) setConnectionMode(configResult.mode as "local" | "remote");
      if (Array.isArray(aiPromptsResult)) setAIPrompts(aiPromptsResult);
      if (storageResult.services) setServices(Object.values(storageResult.services));
      if (eventsResult && Array.isArray(eventsResult.events)) setEvents(eventsResult.events);
      if (eventsCountResult) {
        setTotalCounts((prev) => ({ ...prev, events: eventsCountResult.count ?? 0 }));
      }
      if (aiPromptsCountResult) {
        setTotalCounts((prev) => ({ ...prev, aiPrompts: aiPromptsCountResult.count ?? 0 }));
      }
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.warn("[dashboard] Failed to load dashboard data.", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (events.length === 0 || loading) return;

    const latestEvent = events[0];
    if (!latestEvent || latestEvent.id === lastNotifiedEventId) return;

    if (isThreatEventType(latestEvent.type)) {
      const threatNotification = getThreatNotification(latestEvent.type);
      if (!threatNotification) return;
      addNotification({
        severity: threatNotification.severity,
        title: threatNotification.title,
        message: latestEvent.domain || latestEvent.url || "詳細はイベントログを確認してください",
        autoDismiss: 8000,
        action: {
          label: "詳細を見る",
          onClick: () => setActiveTab("events"),
        },
      });

      setLastNotifiedEventId(latestEvent.id);
    }
  }, [addNotification, events, lastNotifiedEventId, loading, setActiveTab]);

  const violations = useMemo(
    () => reports.filter((r) => r.type === "csp-violation") as CSPViolation[],
    [reports]
  );

  const networkRequests = useMemo(
    () => reports.filter((r) => r.type === "network-request") as NetworkRequest[],
    [reports]
  );

  const directives = useMemo(
    () => Array.from(new Set(violations.map((v) => v.directive))).sort(),
    [violations]
  );

  const directiveStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) stats[v.directive || "unknown"] = (stats[v.directive || "unknown"] ?? 0) + 1;
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [violations]);

  const domainStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) {
      try {
        const domain = new URL(v.blockedURL).hostname;
        stats[domain] = (stats[domain] ?? 0) + 1;
      } catch {
        // invalid URL
      }
    }
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [violations]);

  const nrdServices = useMemo(() => services.filter((s) => s.nrdResult?.isNRD), [services]);
  const loginServices = useMemo(() => services.filter((s) => s.hasLoginPage), [services]);
  const typosquatServices = useMemo(
    () => services.filter((s) => s.typosquatResult?.isTyposquat),
    [services]
  );

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (directiveFilter && v.directive !== directiveFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.pageUrl.toLowerCase().includes(q) ||
          v.blockedURL.toLowerCase().includes(q) ||
          v.directive.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [violations, searchQuery, directiveFilter]);

  const filteredNetworkRequests = useMemo(() => {
    if (!searchQuery) return networkRequests;
    const q = searchQuery.toLowerCase();
    return networkRequests.filter((r) => r.url.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q));
  }, [networkRequests, searchQuery]);

  const filteredAIPrompts = useMemo(() => {
    if (!searchQuery) return aiPrompts;
    const q = searchQuery.toLowerCase();
    return aiPrompts.filter(
      (p) =>
        p.provider?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.apiEndpoint.toLowerCase().includes(q)
    );
  }, [aiPrompts, searchQuery]);

  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();
    if (q === "nrd") return services.filter((s) => s.nrdResult?.isNRD);
    if (q === "login") return services.filter((s) => s.hasLoginPage);
    return services.filter((s) => s.domain.toLowerCase().includes(q));
  }, [services, searchQuery]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => e.type.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
  }, [events, searchQuery]);

  const status = useMemo(
    () => getStatusBadge(nrdServices.length, violations.length, aiPrompts.length),
    [aiPrompts.length, nrdServices.length, violations.length]
  );

  return {
    reports,
    totalCounts,
    lastUpdated,
    loading,
    connectionMode,
    aiPrompts,
    services,
    events,
    isRefreshing,
    loadData,
    violations,
    networkRequests,
    directives,
    directiveStats,
    domainStats,
    nrdServices,
    loginServices,
    typosquatServices,
    filteredViolations,
    filteredNetworkRequests,
    filteredAIPrompts,
    filteredServices,
    filteredEvents,
    status,
  };
}
