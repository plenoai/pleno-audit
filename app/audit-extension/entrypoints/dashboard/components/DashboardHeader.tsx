import { useState, useEffect } from "preact/hooks";
import { RefreshCw, Shield } from "lucide-preact";
import { Badge, SettingsMenu } from "../../../components";
import { useTheme } from "../../../lib/theme";
import {
  DEFAULT_BLOCKING_CONFIG,
  type BlockingConfig,
} from "@libztbs/extension-runtime";
import type { DashboardStyles } from "../styles";

function ProtectionPill() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<BlockingConfig | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_BLOCKING_CONFIG" })
      .then((c) => setConfig(c ?? DEFAULT_BLOCKING_CONFIG))
      .catch(() => setConfig(DEFAULT_BLOCKING_CONFIG));
  }, []);

  function toggle() {
    if (!config) return;
    const prev = config;
    const next = {
      ...config,
      enabled: !config.enabled,
      userConsentGiven: !config.enabled ? true : config.userConsentGiven,
    };
    setConfig(next);
    chrome.runtime.sendMessage({ type: "SET_BLOCKING_CONFIG", data: next })
      .catch(() => setConfig(prev));
  }

  if (!config) return null;

  const enabled = config.enabled;
  return (
    <button
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 10px",
        borderRadius: "9999px",
        border: `1px solid ${enabled ? colors.status.success.border : colors.border}`,
        background: enabled ? colors.status.success.bg : colors.bgPrimary,
        color: enabled ? colors.status.success.text : colors.textSecondary,
        fontSize: "11px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      title={`タイポスクワット、NRDログイン、機密データ送信を検出時にブロック\n現在: ${enabled ? "有効" : "無効"}`}
    >
      <Shield size={12} />
      保護 {enabled ? "ON" : "OFF"}
    </button>
  );
}

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
          <ProtectionPill />
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
