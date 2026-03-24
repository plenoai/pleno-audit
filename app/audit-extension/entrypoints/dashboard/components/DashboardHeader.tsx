import { RefreshCw, Shield } from "lucide-preact";
import { Badge, SettingsMenu } from "../../../components";
import { useTheme } from "../../../lib/theme";
import type { DashboardStyles } from "../styles";

interface DashboardHeaderProps {
  styles: DashboardStyles;
  status: { variant: "danger" | "warning" | "info" | "success"; label: string; dot: boolean };
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onClearData: () => void;
  onExport: () => void;
}

export function DashboardHeader({
  styles,
  status,
  lastUpdated,
  isRefreshing,
  onRefresh,
  onClearData,
  onExport,
}: DashboardHeaderProps) {
  const { colors } = useTheme();

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
            更新: {new Date(lastUpdated).toLocaleString("ja-JP")}
          </p>
        </div>
        <div style={styles.controls}>
          <button
            className="hover-bg"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="データを更新"
            style={{
              background: "transparent",
              border: "none",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textSecondary,
              opacity: isRefreshing ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
            />
          </button>
          <SettingsMenu onClearData={onClearData} onExport={onExport} />
        </div>
      </div>
    </header>
  );
}
