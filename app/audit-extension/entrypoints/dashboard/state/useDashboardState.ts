import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectedService } from "@pleno-audit/casb-types";
import { createLogger } from "@pleno-audit/extension-runtime";
import type { Notification } from "../../../components/NotificationBanner";
import type { Period, TabType } from "../types";

interface TotalCounts {
  violations: number;
  networkRequests: number;
}
import { getPeriodMs, getStatusBadge } from "../utils";

const logger = createLogger("dashboard-state");

interface UseDashboardStateOptions {
  period: Period;
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => string;
  setActiveTab: (tab: TabType) => void;
}

export function useDashboardState({
  period,
  addNotification,
  setActiveTab,
}: UseDashboardStateOptions) {
  const [reports, setReports] = useState<CSPReport[]>([]);
  const [totalCounts, setTotalCounts] = useState<TotalCounts>({
    violations: 0,
    networkRequests: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<DetectedService[]>([]);
  const [serviceConnections, setServiceConnections] = useState<Record<string, string[]>>({});
  const [extensionConnections, setExtensionConnections] = useState<Record<string, string[]>>({});
  const [knownExtensions, setKnownExtensions] = useState<Record<string, { name: string }>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          logger.warn(`[dashboard] Runtime message failed: ${type}`, error);
          return fallback;
        }
      };

      const [
        violationsResult,
        networkResult,
        storageResult,
      ] = await Promise.all([
        safeMessage(
          { type: "GET_CSP_REPORTS", data: { type: "csp-violation", since: sinceISO, limit: 500 } },
          { reports: [], total: 0 }
        ),
        safeMessage(
          { type: "GET_NETWORK_REQUESTS", data: { since: sinceTs, limit: 500 } },
          { requests: [], total: 0 }
        ),
        chrome.storage.local.get(["services", "serviceConnections", "extensionConnections"]).catch((error) => {
          logger.warn("[dashboard] Failed to load services from chrome.storage.", error);
          return { services: {}, serviceConnections: {}, extensionConnections: {} };
        }),
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
      setTotalCounts({
        violations: violationsTotal,
        networkRequests: networkTotal,
      });

      if (storageResult.services) setServices(Object.values(storageResult.services));
      if (storageResult.serviceConnections) {
        setServiceConnections(storageResult.serviceConnections as Record<string, string[]>);
      }
      if (storageResult.extensionConnections) {
        setExtensionConnections(storageResult.extensionConnections as Record<string, string[]>);
      }

      // Build knownExtensions map from chrome.management API
      try {
        const allExtensions = await chrome.management.getAll();
        const extMap: Record<string, { name: string }> = {};
        for (const ext of allExtensions) {
          if (ext.id !== chrome.runtime.id && ext.type === "extension" && ext.enabled) {
            extMap[ext.id] = { name: ext.name };
          }
        }
        setKnownExtensions(extMap);
      } catch (error) {
        logger.warn("[dashboard] Failed to load extensions from management API.", error);
      }
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      logger.warn("[dashboard] Failed to load dashboard data.", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
    let interval = setInterval(loadData, 30000);

    function handleVisibilityChange() {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        loadData();
        interval = setInterval(loadData, 30000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

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

  const { domainStats, domainViolationMeta } = useMemo(() => {
    const stats: Record<string, { count: number; lastSeen: number }> = {};
    for (const v of violations) {
      try {
        const domain = new URL(v.blockedURL).hostname;
        const ts = new Date(v.timestamp).getTime();
        const existing = stats[domain];
        if (existing) {
          existing.count++;
          if (ts > existing.lastSeen) existing.lastSeen = ts;
        } else {
          stats[domain] = { count: 1, lastSeen: ts };
        }
      } catch {
        // invalid URL
      }
    }
    const domainStats = Object.entries(stats)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, { count }]) => ({ label, value: count }));
    return { domainStats, domainViolationMeta: stats };
  }, [violations]);

  const nrdServices = useMemo(() => services.filter((s) => s.nrdResult?.isNRD), [services]);
  const loginServices = useMemo(() => services.filter((s) => s.hasLoginPage), [services]);
  const typosquatServices = useMemo(
    () => services.filter((s) => s.typosquatResult?.isTyposquat),
    [services]
  );
  const aiServices = useMemo(
    () => services.filter((s) => s.aiDetected?.hasAIActivity),
    [services]
  );

  const status = useMemo(
    () => getStatusBadge(nrdServices.length, violations.length, aiServices.length),
    [aiServices.length, nrdServices.length, violations.length]
  );

  return {
    reports,
    totalCounts,
    lastUpdated,
    loading,
    services,
    serviceConnections,
    extensionConnections,
    knownExtensions,
    isRefreshing,
    loadData,
    violations,
    networkRequests,
    directives,
    directiveStats,
    domainStats,
    domainViolationMeta,
    nrdServices,
    loginServices,
    typosquatServices,
    aiServices,
    status,
  };
}
