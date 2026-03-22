import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";
import { Shield, AlertTriangle, Globe, Activity, RefreshCw, Trash2, Download } from "lucide-preact";
import { ThemeContext, type ThemeColors, spacing } from "./lib/theme";
import { useWebThemeState } from "./useWebTheme";
import { Badge, Button, Card, DataTable, SearchInput, Select, StatCard, Sidebar, StatsGrid } from "./components";
import { SkeletonDashboard } from "./components/Skeleton";
import { getPeriodMs, truncate, type Period } from "./dashboardUtils";

type TabType = "overview" | "violations" | "network" | "domains";

function createStyles(colors: ThemeColors, isDark: boolean) {
  return {
    wrapper: {
      display: "flex",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
    container: {
      flex: 1,
      maxWidth: "1200px",
      padding: "24px",
      overflowY: "auto" as const,
    },
    header: {
      marginBottom: "32px",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
    },
    title: {
      fontSize: "20px",
      fontWeight: 600,
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: "13px",
      marginTop: "4px",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    filterBar: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "16px",
      flexWrap: "wrap" as const,
    },
    section: {
      marginBottom: "32px",
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      marginBottom: "24px",
    },
    chartContainer: {
      height: "200px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    chartBar: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    chartLabel: {
      fontSize: "12px",
      color: colors.textSecondary,
      width: "100px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    chartBarInner: {
      height: "20px",
      background: colors.interactive,
      borderRadius: "4px",
      minWidth: "4px",
    },
    chartValue: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "40px",
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center" as const,
      padding: "24px",
    },
  };
}

const periodOptions = [
  { value: "1h", label: "1時間" },
  { value: "24h", label: "24時間" },
  { value: "7d", label: "7日" },
  { value: "30d", label: "30日" },
  { value: "all", label: "全期間" },
];

function HorizontalBarChart({ data, title, colors, isDark }: { data: { label: string; value: number }[]; title: string; colors: ThemeColors; isDark: boolean }) {
  const styles = createStyles(colors, isDark);
  let maxValue = 1;
  for (const d of data) { if (d.value > maxValue) maxValue = d.value; }
  const displayData = data.slice(0, 8);

  return (
    <Card title={title}>
      {displayData.length === 0 ? (
        <p style={styles.emptyText}>データなし</p>
      ) : (
        <div style={styles.chartContainer}>
          {displayData.map((item, i) => (
            <div key={i} style={styles.chartBar}>
              <span style={styles.chartLabel} title={item.label}>{truncate(item.label, 15)}</span>
              <div
                style={{
                  ...styles.chartBarInner,
                  width: `${(item.value / maxValue) * 100}%`,
                  maxWidth: "calc(100% - 160px)",
                }}
              />
              <span style={styles.chartValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DashboardContent() {
  const { colors, isDark } = useWebThemeState();
  const styles = createStyles(colors, isDark);

  const [reports, setReports] = useState<CSPReport[]>([]);
  const [totalCounts, setTotalCounts] = useState({ violations: 0, networkRequests: 0 });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [directiveFilter, setDirectiveFilter] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const cutoffMs = Date.now() - getPeriodMs(period);
      const sinceISO = period !== "all" ? new Date(cutoffMs).toISOString() : undefined;
      const params = sinceISO ? `?since=${encodeURIComponent(sinceISO)}` : "";

      const [reportsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/reports${params}`).then(r => r.json()).catch(() => ({ reports: [] })),
        fetch("/api/v1/stats").then(r => r.json()).catch(() => ({ violations: 0, requests: 0 })),
      ]);

      setReports(reportsRes.reports ?? []);
      setTotalCounts({
        violations: statsRes.violations ?? 0,
        networkRequests: statsRes.requests ?? 0,
      });
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      // API fetch failure is non-fatal; previous data remains displayed
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

  const clearData = async () => {
    if (!confirm("全てのデータを削除しますか？")) return;
    await fetch("/api/v1/reports", { method: "DELETE" });
    await loadData();
  };

  const exportData = async () => {
    const res = await fetch("/api/v1/reports");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pleno-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const violations = useMemo(() => reports.filter((r): r is CSPViolation => r.type === "csp-violation"), [reports]);
  const networkRequests = useMemo(() => reports.filter((r): r is NetworkRequest => r.type === "network-request"), [reports]);

  const filteredViolations = useMemo(() => {
    let result = violations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v => v.pageUrl.toLowerCase().includes(q) || v.blockedURL.toLowerCase().includes(q));
    }
    if (directiveFilter) {
      result = result.filter(v => v.directive === directiveFilter);
    }
    return result;
  }, [violations, searchQuery, directiveFilter]);

  const filteredNetworkRequests = useMemo(() => {
    if (!searchQuery) return networkRequests;
    const q = searchQuery.toLowerCase();
    return networkRequests.filter(r => r.url.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q));
  }, [networkRequests, searchQuery]);

  const directiveStats = useMemo(() => {
    const stats: Record<string, number> = {};
    violations.forEach(v => {
      stats[v.directive] = (stats[v.directive] ?? 0) + 1;
    });
    return Object.entries(stats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [violations]);

  const domainStats = useMemo(() => {
    const stats: Record<string, number> = {};
    reports.forEach(r => {
      stats[r.domain] = (stats[r.domain] ?? 0) + 1;
    });
    return Object.entries(stats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [reports]);

  const uniqueDirectives = useMemo(() => [...new Set(violations.map(v => v.directive))], [violations]);

  const sidebarItems = [
    { id: "overview", label: "概要", icon: Activity },
    { id: "violations", label: "CSP違反", icon: AlertTriangle, count: totalCounts.violations },
    { id: "network", label: "ネットワーク", icon: Globe, count: totalCounts.networkRequests },
    { id: "domains", label: "ドメイン", icon: Shield, count: domainStats.length },
  ];

  if (loading) {
    return (
      <ThemeContext.Provider value={{ mode: "system", isDark, colors, setMode: () => {} }}>
        <div style={styles.wrapper}>
          <SkeletonDashboard />
        </div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ mode: "system", isDark, colors, setMode: () => {} }}>
      <div style={styles.wrapper}>
        <Sidebar
          tabs={sidebarItems}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
        />
        <main style={styles.container}>
          <header style={styles.header}>
            <div style={styles.headerTop}>
              <div>
                <h1 style={styles.title}>
                  <Shield size={24} />
                  Pleno Audit Dashboard
                </h1>
                <p style={styles.subtitle}>
                  Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "-"}
                </p>
              </div>
              <div style={styles.controls}>
                <Select
                  options={periodOptions}
                  value={period}
                  onChange={(v) => setPeriod(v as Period)}
                />
                <Button onClick={loadData} disabled={isRefreshing}>
                  <RefreshCw size={14} style={isRefreshing ? { animation: "spin 1s linear infinite" } : {}} />
                  更新
                </Button>
                <Button variant="secondary" onClick={exportData}>
                  <Download size={14} />
                  Export
                </Button>
                <Button variant="danger" onClick={clearData}>
                  <Trash2 size={14} />
                  削除
                </Button>
              </div>
            </div>
          </header>

          {activeTab === "overview" && (
            <>
              <StatsGrid>
                <StatCard title="Total Events" value={reports.length} icon={Activity} />
                <StatCard title="CSP Violations" value={totalCounts.violations} icon={AlertTriangle} variant={totalCounts.violations > 0 ? "warning" : "default"} />
                <StatCard title="Network Requests" value={totalCounts.networkRequests} icon={Globe} />
                <StatCard title="Unique Domains" value={domainStats.length} icon={Shield} />
              </StatsGrid>
              <div style={styles.twoColumn}>
                <HorizontalBarChart data={directiveStats} title="ディレクティブ別" colors={colors} isDark={isDark} />
                <HorizontalBarChart data={domainStats.slice(0, 8)} title="ドメイン別" colors={colors} isDark={isDark} />
              </div>
            </>
          )}

          {activeTab === "violations" && (
            <section style={styles.section}>
              <div style={styles.filterBar}>
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL検索..." />
                <Select
                  options={[{ value: "", label: "全て" }, ...uniqueDirectives.map(d => ({ value: d, label: d }))]}
                  value={directiveFilter}
                  onChange={setDirectiveFilter}
                />
              </div>
              <Card title={`CSP Violations (${filteredViolations.length})`}>
                <DataTable
                  columns={[
                    { key: "timestamp", header: "Time", render: (v: CSPViolation) => new Date(v.timestamp).toLocaleTimeString() },
                    { key: "directive", header: "Directive", render: (v: CSPViolation) => <Badge>{v.directive}</Badge> },
                    { key: "pageUrl", header: "Page", render: (v: CSPViolation) => truncate(v.pageUrl, 40) },
                    { key: "blockedURL", header: "Blocked", render: (v: CSPViolation) => truncate(v.blockedURL, 40) },
                  ]}
                  data={filteredViolations.slice(0, 100)}
                  emptyMessage="CSP違反はありません"
                />
              </Card>
            </section>
          )}

          {activeTab === "network" && (
            <section style={styles.section}>
              <div style={styles.filterBar}>
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL・ドメイン検索..." />
              </div>
              <Card title={`Network Requests (${filteredNetworkRequests.length})`}>
                <DataTable
                  columns={[
                    { key: "timestamp", header: "Time", render: (r: NetworkRequest) => new Date(r.timestamp).toLocaleTimeString() },
                    { key: "method", header: "Method", render: (r: NetworkRequest) => <Badge>{r.method}</Badge> },
                    { key: "initiator", header: "Type", render: (r: NetworkRequest) => <Badge variant="info">{r.initiator}</Badge> },
                    { key: "domain", header: "Domain", render: (r: NetworkRequest) => r.domain },
                    { key: "url", header: "URL", render: (r: NetworkRequest) => truncate(r.url, 50) },
                  ]}
                  data={filteredNetworkRequests.slice(0, 100)}
                  emptyMessage="ネットワークリクエストはありません"
                />
              </Card>
            </section>
          )}

          {activeTab === "domains" && (
            <section style={styles.section}>
              <Card title={`Domains (${domainStats.length})`}>
                <DataTable
                  columns={[
                    { key: "label", header: "Domain" },
                    { key: "value", header: "Count" },
                  ]}
                  data={domainStats}
                  emptyMessage="ドメインデータはありません"
                />
              </Card>
            </section>
          )}
        </main>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ThemeContext.Provider>
  );
}

export function App() {
  return <DashboardContent />;
}
