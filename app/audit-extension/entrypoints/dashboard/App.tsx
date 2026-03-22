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
import { AITab, ConnectionsTab, DomainsTab, EventsTab, NetworkTab, OverviewTab, ServicesTab, TimelineTab, ViolationsTab } from "./views";

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
        <Sidebar tabs={loadingTabs} activeTab="overview" onChange={() => {}} />
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
          connectionMode={dashboard.connectionMode}
          period={period}
          onPeriodChange={setPeriod}
          isRefreshing={dashboard.isRefreshing}
          onRefresh={dashboard.loadData}
          onClearData={handleClearData}
          onExport={handleExportJSON}
          totalCounts={dashboard.totalCounts}
          nrdServices={dashboard.nrdServices}
          services={dashboard.services}
          loginServices={dashboard.loginServices}
          setActiveTab={setActiveTab}
        />

        {activeTab === "overview" && (
          <OverviewTab
            styles={styles}
            colors={colors}
            violations={dashboard.violations}
            aiPrompts={dashboard.aiPrompts}
            services={dashboard.services}
            events={dashboard.events}
            nrdServices={dashboard.nrdServices}
            typosquatServices={dashboard.typosquatServices}
            directiveStats={dashboard.directiveStats}
            domainStats={dashboard.domainStats}
          />
        )}

        {activeTab === "timeline" && (
          <div style={styles.section}>
            <TimelineTab />
          </div>
        )}

        {activeTab === "violations" && (
          <ViolationsTab
            violations={dashboard.violations}
            directives={dashboard.directives}
          />
        )}

        {activeTab === "network" && (
          <NetworkTab requests={dashboard.networkRequests} />
        )}

        {activeTab === "domains" && (
          <DomainsTab
            domainStats={dashboard.domainStats}
            domainViolationMeta={dashboard.domainViolationMeta}
            networkRequests={dashboard.networkRequests}
          />
        )}

        {activeTab === "ai" && (
          <AITab prompts={dashboard.aiPrompts} />
        )}

        {activeTab === "services" && (
          <ServicesTab
            services={dashboard.services}
            nrdServices={dashboard.nrdServices}
            loginServices={dashboard.loginServices}
            serviceConnections={dashboard.serviceConnections}
          />
        )}

        {activeTab === "connections" && (
          <ConnectionsTab
            serviceConnections={dashboard.serviceConnections}
            extensionConnections={dashboard.extensionConnections}
            knownExtensions={dashboard.knownExtensions}
          />
        )}

        {activeTab === "events" && (
          <EventsTab events={dashboard.events} />
        )}

        {activeTab === "extensions" && (
          <div style={styles.section}>
            <ExtensionsTab colors={colors} />
          </div>
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
