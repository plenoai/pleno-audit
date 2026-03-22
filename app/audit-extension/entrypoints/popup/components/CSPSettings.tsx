import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import { createLogger } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { sendMessage } from "../utils/messaging";

interface CSPOption {
  key: keyof Pick<CSPConfig, "enabled" | "collectCSPViolations" | "collectNetworkRequests">;
  label: string;
  description: string;
}

const CSP_OPTIONS: CSPOption[] = [
  { key: "enabled", label: "CSP監査", description: "CSP監査を有効化" },
  { key: "collectCSPViolations", label: "違反収集", description: "CSP違反を収集" },
  { key: "collectNetworkRequests", label: "リクエスト", description: "ネットワークリクエストを収集" },
];

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; config: CSPConfig };

const logger = createLogger("popup-csp-settings");

export function CSPSettings() {
  const { colors } = useTheme();
  const [viewState, setViewState] = useState<ViewState>({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState("");

  useEffect(() => {
    sendMessage<CSPConfig>({ type: "GET_CSP_CONFIG" })
      .then((cfg) => {
        setViewState({ kind: "ready", config: cfg });
        setEndpointDraft(cfg.reportEndpoint ?? "");
      })
      .catch((error) => {
        logger.warn({
          event: "POPUP_GET_CSP_CONFIG_FAILED",
          error,
        });
        setViewState({ kind: "ready", config: DEFAULT_CSP_CONFIG });
        setEndpointDraft(DEFAULT_CSP_CONFIG.reportEndpoint ?? "");
      });
  }, []);

  function handleToggle(key: CSPOption["key"]) {
    if (viewState.kind !== "ready") return;
    const previousConfig = viewState.config;
    const newConfig = { ...previousConfig, [key]: !previousConfig[key] };
    setViewState({ kind: "ready", config: newConfig });
    sendMessage({
      type: "SET_CSP_CONFIG",
      data: newConfig,
    }).catch((error) => {
      logger.warn({
        event: "POPUP_SET_CSP_CONFIG_TOGGLE_FAILED",
        error,
      });
      setViewState({ kind: "ready", config: previousConfig });
    });
  }

  function handleEndpointCommit(value: string) {
    if (viewState.kind !== "ready") return;
    const previousConfig = viewState.config;
    const newConfig = { ...previousConfig, reportEndpoint: value || null };
    setViewState({ kind: "ready", config: newConfig });
    sendMessage({
      type: "SET_CSP_CONFIG",
      data: newConfig,
    }).catch((error) => {
      logger.warn({
        event: "POPUP_SET_CSP_CONFIG_ENDPOINT_FAILED",
        error,
      });
      setViewState({ kind: "ready", config: previousConfig });
      setEndpointDraft(previousConfig.reportEndpoint ?? "");
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
    endpointSection: {
      marginTop: "8px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "4px",
    },
    endpointLabel: {
      fontSize: "10px",
      color: colors.textSecondary,
    },
    endpointInput: {
      width: "100%",
      padding: "6px 8px",
      fontSize: "11px",
      border: `1px solid ${colors.border}`,
      borderRadius: "4px",
      background: colors.bgSecondary,
      color: colors.textPrimary,
      outline: "none",
    },
  };

  if (viewState.kind === "loading") return null;
  const config = viewState.config;

  const enabledCount = CSP_OPTIONS.filter(opt => config[opt.key]).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          CSP設定 ({enabledCount}/{CSP_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <>
          <div style={styles.content}>
            {CSP_OPTIONS.map((opt) => (
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
          <div style={styles.endpointSection}>
            <label style={styles.endpointLabel}>レポートURL (オプション)</label>
            <input
              type="url"
              style={styles.endpointInput}
              value={endpointDraft}
              onChange={(e) => setEndpointDraft((e.target as HTMLInputElement).value)}
              onBlur={() => handleEndpointCommit(endpointDraft)}
              placeholder="https://example.com/csp-report"
            />
          </div>
        </>
      )}
    </div>
  );
}
