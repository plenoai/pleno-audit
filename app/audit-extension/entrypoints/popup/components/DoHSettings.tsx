import { useState, useEffect } from "preact/hooks";
import {
  createLogger,
  DEFAULT_DOH_MONITOR_CONFIG,
  type DoHMonitorConfig,
  type DoHAction,
} from "@libztbs/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { sendMessage } from "../utils/messaging";

interface ActionOption {
  value: DoHAction;
  label: string;
  description: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  { value: "detect", label: "検出のみ", description: "通知なし" },
  { value: "alert", label: "通知", description: "検出時に通知" },
  { value: "block", label: "ブロック", description: "DoH通信をブロック" },
];

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; config: DoHMonitorConfig };

const logger = createLogger("popup-doh-settings");

export function DoHSettings() {
  const { colors } = useTheme();
  const [viewState, setViewState] = useState<ViewState>({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    sendMessage<DoHMonitorConfig>({ type: "GET_DOH_MONITOR_CONFIG" })
      .then((nextConfig) => {
        setViewState({ kind: "ready", config: nextConfig });
      })
      .catch((error) => {
        logger.warn({
          event: "POPUP_GET_DOH_MONITOR_CONFIG_FAILED",
          error,
        });
        setViewState({ kind: "ready", config: DEFAULT_DOH_MONITOR_CONFIG });
      });
  }, []);

  function handleActionChange(action: DoHAction) {
    if (viewState.kind !== "ready") return;
    const previousConfig = viewState.config;
    const newConfig = { ...previousConfig, action };
    setViewState({ kind: "ready", config: newConfig });
    sendMessage({
      type: "SET_DOH_MONITOR_CONFIG",
      data: { action },
    }).catch((error) => {
      logger.warn({
        event: "POPUP_SET_DOH_MONITOR_CONFIG_FAILED",
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
      gridTemplateColumns: "1fr 1fr 1fr",
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
    optionSelected: {
      background: colors.bgTertiary || colors.border,
    },
    radio: {
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

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          DoH監視 ({ACTION_OPTIONS.find(o => o.value === config.action)?.label})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          {ACTION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                ...styles.option,
                ...(config.action === opt.value ? styles.optionSelected : {}),
              }}
              onMouseEnter={(e) => {
                if (config.action !== opt.value) {
                  (e.currentTarget as HTMLElement).style.background = colors.bgTertiary || colors.border;
                }
              }}
              onMouseLeave={(e) => {
                if (config.action !== opt.value) {
                  (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
                }
              }}
            >
              <input
                type="radio"
                name="doh-action"
                checked={config.action === opt.value}
                onChange={() => handleActionChange(opt.value)}
                style={styles.radio}
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
