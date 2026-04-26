import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AlertSeverity } from "libztbs/alerts";
import { ThemeContext, useThemeState } from "../../lib/theme";
import { ErrorBoundary, NotificationBanner, Sidebar, useNotifications } from "../../components";
import { SkeletonDashboard } from "../../components/Skeleton";
import { DashboardHeader } from "./components/DashboardHeader";
import { loadingTabs, tabs } from "./constants";
import { useDashboardActions } from "./state/useDashboardActions";
import { useDashboardNavigation } from "./state/useDashboardNavigation";
import { useDashboardState } from "./state/useDashboardState";
import { useDismissedPatterns } from "./hooks/useDismissedPatterns";
import { createDashboardStyles } from "./styles";
import type { TabType } from "./types";
import { getInitialTab } from "./utils";
import { ExtensionsTab } from "./views/ExtensionsTab";
import { AlertsTab } from "./views/AlertsTab";
import { SettingsTab } from "./views/SettingsTab";
import { ServicesTab } from "./views";
import { sendMessage } from "../../lib/messaging";
import { AnimationProvider, Motion, useAnimationSettings } from "../../lib/motion";

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

interface DomainAlertSummary {
  total: number;
  maxSeverity: AlertSeverity;
  bySeverity: Record<AlertSeverity, number>;
  categories: string[];
}

const SEARCH_PLACEHOLDERS: Record<TabType, string> = {
  services: "ドメインで検索... (/)",
  extensions: "拡張機能名、権限で検索... (/)",
  alerts: "アラートを検索... (/)",
  settings: "",
};

function DashboardContent({ animationEnabled, setAnimationEnabled }: { animationEnabled: boolean; setAnimationEnabled: (v: boolean) => void }) {
  const styles = createDashboardStyles();

  const [activeTab, setActiveTabRaw] = useState<TabType>(getInitialTab);
  const prevTabIndex = useRef(tabs.findIndex((t) => t.id === getInitialTab()));
  const slideDirection = useRef<1 | -1>(1);
  const [searchQuery, setSearchQuery] = useState("");

  const setActiveTab = useCallback((tab: TabType) => {
    const newIndex = tabs.findIndex((t) => t.id === tab);
    slideDirection.current = newIndex >= prevTabIndex.current ? 1 : -1;
    prevTabIndex.current = newIndex;
    setActiveTabRaw(tab);
    setSearchQuery("");
  }, []);

  const { notifications, addNotification, dismissNotification } = useNotifications();

  const dashboard = useDashboardState({
    addNotification,
    setActiveTab,
  });

  const [alertEvents, setAlertEvents] = useState<{ domain: string; severity: AlertSeverity; category: string }[]>([]);
  const { dismissedPatterns } = useDismissedPatterns();

  const refreshAlertEvents = useCallback(() => {
    sendMessage<{ events: { domain: string; severity: AlertSeverity; category: string }[] }>({
      type: "GET_POPUP_EVENTS",
    })
      .then((res) => setAlertEvents(res.events))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshAlertEvents();
  }, [refreshAlertEvents]);

  useEffect(() => {
    function handleStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "local") return;
      if (!("pleno_dismiss_records" in changes)) return;
      refreshAlertEvents();
    }
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [refreshAlertEvents]);

  const alertBadge = useMemo(() => {
    let critical = 0;
    let high = 0;
    for (const e of alertEvents) {
      if (e.severity === "critical") critical++;
      else if (e.severity === "high") high++;
    }
    const count = critical + high;
    if (count === 0) return null;
    return { count, variant: critical > 0 ? "danger" as const : "warning" as const };
  }, [alertEvents]);

  const alertsByDomain = useMemo(() => {
    const map: Record<string, DomainAlertSummary> = {};
    for (const e of alertEvents) {
      const existing = map[e.domain];
      if (existing) {
        existing.total++;
        if (SEVERITY_RANK[e.severity] < SEVERITY_RANK[existing.maxSeverity]) {
          existing.maxSeverity = e.severity;
        }
        existing.bySeverity[e.severity] = (existing.bySeverity[e.severity] ?? 0) + 1;
        if (!existing.categories.includes(e.category)) {
          existing.categories.push(e.category);
        }
      } else {
        map[e.domain] = {
          total: 1,
          maxSeverity: e.severity,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0, [e.severity]: 1 },
          categories: [e.category],
        };
      }
    }
    return map;
  }, [alertEvents]);

  const navigateToAlerts = useCallback((domain: string) => {
    setActiveTab("alerts");
    window.location.hash = "alerts";
    sessionStorage.setItem("alertDomainFilter", domain);
    window.dispatchEvent(new Event("alertDomainFilter"));
  }, [setActiveTab]);

  const { handleClearData, handleExportJSON, handleImportJSON } = useDashboardActions({
    reports: dashboard.reports,
    services: dashboard.services,
    serviceConnections: dashboard.serviceConnections,
    extensionConnections: dashboard.extensionConnections,
    loadData: dashboard.loadData,
  });

  const handleExportWithNotification = useCallback(() => {
    handleExportJSON();
    addNotification({
      severity: "info",
      title: "エクスポート完了",
      message: "データをJSONファイルとしてエクスポートしました",
      autoDismiss: 3000,
    });
  }, [handleExportJSON, addNotification]);

  const handleImportWithNotification = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const result = await handleImportJSON();
    if (result.success) {
      addNotification({
        severity: "info",
        title: "インポート完了",
        message: result.message,
        autoDismiss: 3000,
      });
    } else {
      addNotification({
        severity: "warning",
        title: "インポート失敗",
        message: result.message,
        autoDismiss: 5000,
      });
    }
    return result;
  }, [handleImportJSON, addNotification]);

  useDashboardNavigation({
    activeTab,
    setActiveTab,
    loadData: dashboard.loadData,
  });

  if (dashboard.loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.body}>
          <Sidebar tabs={loadingTabs} activeTab="services" onChange={() => {}} />
          <div style={styles.container}>
            <SkeletonDashboard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />
      <DashboardHeader
        styles={styles}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={SEARCH_PLACEHOLDERS[activeTab]}
        showSearch={activeTab !== "settings"}
        onClearData={handleClearData}
        onExport={handleExportWithNotification}
        onImport={handleImportWithNotification}
      />
      <div style={styles.body}>
        <Sidebar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} alertBadge={alertBadge} />
        <div style={styles.container}>
          <Motion
            key={activeTab}
            initial={{ opacity: 0, y: 12 * slideDirection.current }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {activeTab === "services" && (
              <ServicesTab
                services={dashboard.services}
                serviceConnections={dashboard.serviceConnections}
                alertsByDomain={alertsByDomain}
                dismissedPatterns={dismissedPatterns}
                onNavigateToAlerts={navigateToAlerts}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}

            {activeTab === "extensions" && (
              <ExtensionsTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            )}

            {activeTab === "alerts" && (
              <AlertsTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            )}

            {activeTab === "settings" && (
              <SettingsTab animationEnabled={animationEnabled} onAnimationToggle={setAnimationEnabled} />
            )}
          </Motion>
        </div>
      </div>
    </div>
  );
}

export function DashboardApp() {
  const themeState = useThemeState();
  const { animationEnabled, setAnimationEnabled } = useAnimationSettings();

  return (
    <ThemeContext.Provider value={themeState}>
      <AnimationProvider value={animationEnabled}>
        <ErrorBoundary>
          <DashboardContent setAnimationEnabled={setAnimationEnabled} animationEnabled={animationEnabled} />
        </ErrorBoundary>
      </AnimationProvider>
    </ThemeContext.Provider>
  );
}
