import { Shield } from "lucide-preact";
import { Badge, Button, Select, SettingsMenu, StatCard, StatsGrid } from "../../../components";
import { spacing } from "../../../lib/theme";
import type { DashboardStyles } from "../styles";
import type { Period, TabType, TotalCounts } from "../types";
import type { DetectedService } from "@pleno-audit/casb-types";
import { periodOptions } from "../constants";

interface DashboardHeaderProps {
  styles: DashboardStyles;
  status: { variant: "danger" | "warning" | "info" | "success"; label: string; dot: boolean };
  lastUpdated: string;
  connectionMode: "local" | "remote";
  period: Period;
  onPeriodChange: (period: Period) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onClearData: () => void;
  onExport: () => void;
  totalCounts: TotalCounts;
  nrdServices: DetectedService[];
  services: DetectedService[];
  loginServices: DetectedService[];
  setActiveTab: (tab: TabType) => void;
}

export function DashboardHeader({
  styles,
  status,
  lastUpdated,
  connectionMode,
  period,
  onPeriodChange,
  isRefreshing,
  onRefresh,
  onClearData,
  onExport,
  totalCounts,
  nrdServices,
  services,
  loginServices,
  setActiveTab,
}: DashboardHeaderProps) {
  return (
    <header style={styles.header}>
      <div style={styles.headerTop}>
        <div>
          <h1 style={styles.title}>
            <Shield size={20} />
            Pleno Audit
            <Badge variant={status.variant} size="md" dot={status.dot}>
              {status.label}
            </Badge>
          </h1>
          <p style={styles.subtitle}>
            更新: {new Date(lastUpdated).toLocaleString("ja-JP")} | 接続: {connectionMode}
          </p>
        </div>
        <div style={styles.controls}>
          <Select value={period} onChange={(v) => onPeriodChange(v as Period)} options={periodOptions} />
          <Button onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? "更新中..." : "更新"}
          </Button>
          <SettingsMenu onClearData={onClearData} onExport={onExport} />
        </div>
      </div>

      <div style={{ marginBottom: spacing.xl }}>
        <StatsGrid minWidth="lg">
          <StatCard
            value={totalCounts.violations}
            label="CSP違反"
            onClick={() => setActiveTab("violations")}
          />
          <StatCard
            value={nrdServices.length}
            label="NRD検出"
            trend={
              nrdServices.length > 0
                ? { value: nrdServices.length, isUp: true }
                : undefined
            }
            onClick={() => setActiveTab("services")}
          />
          <StatCard
            value={totalCounts.aiPrompts}
            label="AIプロンプト"
            onClick={() => setActiveTab("ai")}
          />
          <StatCard
            value={services.length}
            label="サービス"
            onClick={() => setActiveTab("services")}
          />
          <StatCard
            value={loginServices.length}
            label="ログイン検出"
            onClick={() => setActiveTab("services")}
          />
          <StatCard
            value={totalCounts.events}
            label="イベント"
            onClick={() => setActiveTab("events")}
          />
        </StatsGrid>
      </div>
    </header>
  );
}
