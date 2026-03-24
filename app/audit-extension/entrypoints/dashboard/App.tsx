import { useState } from "preact/hooks";
import { ThemeContext, useTheme, useThemeState } from "../../lib/theme";
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

function DashboardContent() {
  const { colors, isDark } = useTheme();
  const styles = createDashboardStyles(colors, isDark);

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  const { notifications, addNotification, dismissNotification } = useNotifications();

  const dashboard = useDashboardState({
    addNotification,
    setActiveTab,
  });

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
              nrdServices={dashboard.nrdServices}
              loginServices={dashboard.loginServices}
              typosquatServices={dashboard.typosquatServices}
              aiServices={dashboard.aiServices}
              serviceConnections={dashboard.serviceConnections}
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
