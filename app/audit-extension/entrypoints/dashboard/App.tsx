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
import type { Period, TabType } from "./types";
import { getInitialTab } from "./utils";
import { ExtensionsTab } from "./views/ExtensionsTab";
import { AITab, EventsTab, ServicesTab } from "./views";

function DashboardContent() {
  const { colors, isDark } = useTheme();
  const styles = createDashboardStyles(colors, isDark);

  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  const { notifications, addNotification, dismissNotification } = useNotifications();

  const dashboard = useDashboardState({
    period,
    addNotification,
    setActiveTab,
  });

  const { handleClearData, handleExportJSON } = useDashboardActions({
    reports: dashboard.reports,
    services: dashboard.services,
    events: dashboard.events,
    aiPrompts: dashboard.aiPrompts,
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
        <Sidebar tabs={loadingTabs} activeTab="services" onChange={() => {}} />
        <div style={styles.container}>
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />
      <Sidebar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />
      <div style={styles.container}>
        <DashboardHeader
          styles={styles}
          status={dashboard.status}
          lastUpdated={dashboard.lastUpdated}
          period={period}
          onPeriodChange={setPeriod}
          isRefreshing={dashboard.isRefreshing}
          onRefresh={dashboard.loadData}
          onClearData={handleClearData}
          onExport={handleExportJSON}
        />

        {activeTab === "ai" && (
          <AITab prompts={dashboard.aiPrompts} />
        )}

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

        {activeTab === "events" && (
          <EventsTab events={dashboard.events} />
        )}

        {activeTab === "extensions" && (
          <ExtensionsTab />
        )}
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
