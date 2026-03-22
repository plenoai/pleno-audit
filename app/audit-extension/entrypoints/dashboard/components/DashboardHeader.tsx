import { Shield } from "lucide-preact";
import { Badge, Button, Select, SettingsMenu } from "../../../components";
import type { DashboardStyles } from "../styles";
import type { Period } from "../types";
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
    </header>
  );
}
