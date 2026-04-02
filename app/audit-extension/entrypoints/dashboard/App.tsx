import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { AlertSeverity } from "libztbs/alerts";
import { ThemeContext, useThemeState } from "../../lib/theme";
import { ErrorBoundary, NotificationBanner, Sidebar, useNotifications } from "../../components";
import { SkeletonDashboard } from "../../components/Skeleton";
import { DashboardHeader } from "./components/DashboardHeader";
import { loadingTabs, tabs } from "./constants";
import { useDashboardActions } from "./state/useDashboardActions";
import { useDashboardNavigation } from "./state/useDashboardNavigation";
import { useDashboardState } from "./state/useDashboardState";
import { createDashboardStyles } from "./styles";
import type { TabType } from "./types";
import { getInitialTab } from "./utils";
import { ExtensionsTab } from "./views/ExtensionsTab";
import { AlertsTab } from "./views/AlertsTab";
import { SettingsTab } from "./views/SettingsTab";
import { ServicesTab } from "./views";
import { sendMessage } from "../../lib/messaging";

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

function DashboardContent() {
  const styles = createDashboardStyles();

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  const { notifications, addNotification, dismissNotification } = useNotifications();

  const dashboard = useDashboardState({
    addNotification,
    setActiveTab,
  });

  const [alertEvents, setAlertEvents] = useState<{ domain: string; severity: AlertSeverity; category: string }[]>([]);

  useEffect(() => {
    sendMessage<{ events: { domain: string; severity: AlertSeverity; category: string }[] }>({
      type: "GET_POPUP_EVENTS",
    })
      .then((res) => setAlertEvents(res.events))
      .catch(() => {});
  }, []);

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
    // Store domain filter for AlertsTab to pick up
    sessionStorage.setItem("alertDomainFilter", domain);
    window.dispatchEvent(new Event("alertDomainFilter"));
  }, [setActiveTab]);

  const { handleClearData, handleExportJSON } = useDashboardActions({
    reports: dashboard.reports,
    services: dashboard.services,
    loadData: dashboard.loadData,
  });

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
        status={dashboard.status}
        lastUpdated={dashboard.lastUpdated}
        isRefreshing={dashboard.isRefreshing}
        onRefresh={dashboard.loadData}
        onClearData={handleClearData}
        onExport={handleExportJSON}
      />
      <div style={styles.body}>
        <Sidebar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />
        <div style={styles.container}>
          {activeTab === "services" && (
            <ServicesTab
              services={dashboard.services}
              serviceConnections={dashboard.serviceConnections}
              alertsByDomain={alertsByDomain}
              onNavigateToAlerts={navigateToAlerts}
            />
          )}

          {activeTab === "extensions" && (
            <ExtensionsTab />
          )}

          {activeTab === "alerts" && (
            <AlertsTab />
          )}

          {activeTab === "settings" && (
            <SettingsTab />
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardApp() {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <ErrorBoundary>
        <DashboardContent />
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
}
