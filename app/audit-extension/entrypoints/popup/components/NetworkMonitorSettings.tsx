import { useState, useEffect } from "preact/hooks";
import {
  createLogger,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  type NetworkMonitorConfig,
} from "@libztbs/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { sendMessage } from "../utils/messaging";

interface NetworkMonitorOption {
  key: keyof Pick<NetworkMonitorConfig, "enabled" | "captureAllRequests" | "excludeOwnExtension">;
  label: string;
  description: string;
}

const NETWORK_MONITOR_OPTIONS: NetworkMonitorOption[] = [
  { key: "enabled", label: "ネットワーク監視", description: "全リクエストを監視" },
  { key: "captureAllRequests", label: "全リクエスト", description: "拡張機能以外も記録" },
  { key: "excludeOwnExtension", label: "自身を除外", description: "Pleno Auditを除外" },
];

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; config: NetworkMonitorConfig };

const logger = createLogger("popup-network-monitor-settings");

export function NetworkMonitorSettings() {
  const { colors } = useTheme();
  const [viewState, setViewState] = useState<ViewState>({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    sendMessage<NetworkMonitorConfig>({ type: "GET_NETWORK_MONITOR_CONFIG" })
      .then((nextConfig) => {
        setViewState({ kind: "ready", config: nextConfig });
      })
      .catch((error) => {
        logger.warn({
          event: "POPUP_GET_NETWORK_MONITOR_CONFIG_FAILED",
          error,
        });
        setViewState({ kind: "ready", config: DEFAULT_NETWORK_MONITOR_CONFIG });
      });
  }, []);

  function handleToggle(key: NetworkMonitorOption["key"]) {
    if (viewState.kind !== "ready") return;
    const previousConfig = viewState.config;
    const newConfig = { ...previousConfig, [key]: !previousConfig[key] };
    setViewState({ kind: "ready", config: newConfig });
    sendMessage({
      type: "SET_NETWORK_MONITOR_CONFIG",
      data: newConfig,
    }).catch((error) => {
      logger.warn({
        event: "POPUP_SET_NETWORK_MONITOR_CONFIG_FAILED",
        error,
      });
      setViewState({ kind: "ready", config: previousConfig });
    });
  }

  const styles = {
    container: {
      marginTop: "12px",
      borderTop: `1px solid ${colors.border}`,
      paddingTop: "12px",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      padding: "4px 0",
    },
    title: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
    },
    chevron: {
      fontSize: "10px",
      color: colors.textSecondary,
      transition: "transform 0.2s",
      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    },
    content: {
      marginTop: "8px",
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "6px",
    },
    option: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 8px",
      background: colors.bgSecondary,
      borderRadius: "6px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    checkbox: {
      width: "14px",
      height: "14px",
      accentColor: colors.accent,
    },
    labelContainer: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "1px",
    },
    label: {
      fontSize: "11px",
      fontWeight: 500,
      color: colors.textPrimary,
    },
    description: {
      fontSize: "9px",
      color: colors.textMuted,
    },
  };

  if (viewState.kind === "loading") return null;
  const config = viewState.config;

  const enabledCount = NETWORK_MONITOR_OPTIONS.filter(opt => config[opt.key]).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          Network Monitor ({enabledCount}/{NETWORK_MONITOR_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          {NETWORK_MONITOR_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              style={styles.option}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgTertiary || colors.border;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
              }}
            >
              <input
                type="checkbox"
                checked={config[opt.key]}
                onChange={() => handleToggle(opt.key)}
                style={styles.checkbox}
              />
              <div style={styles.labelContainer}>
                <span style={styles.label}>{opt.label}</span>
                <span style={styles.description}>{opt.description}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
