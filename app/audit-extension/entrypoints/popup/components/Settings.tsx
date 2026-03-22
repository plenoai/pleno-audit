import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@pleno-audit/csp";
import type { NRDConfig } from "@pleno-audit/nrd";
import { DEFAULT_NRD_CONFIG } from "@pleno-audit/nrd";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import {
  createLogger,
  type EnterpriseStatus,
} from "@pleno-audit/extension-runtime";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";
import { LockedBanner } from "./LockedBanner";
import { sendMessage } from "../utils/messaging";

const DEFAULT_ENTERPRISE_STATUS: EnterpriseStatus = {
  isManaged: false,
  ssoRequired: false,
  settingsLocked: false,
  config: null,
};
const logger = createLogger("popup-settings");

export function Settings() {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [nrdConfig, setNRDConfig] = useState<NRDConfig | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus>(DEFAULT_ENTERPRISE_STATUS);

  const isLocked = enterpriseStatus.settingsLocked;

  useEffect(() => {
    loadConfig();
    sendMessage<EnterpriseStatus>({ type: "GET_ENTERPRISE_STATUS" })
      .then(setEnterpriseStatus)
      .catch((error) => {
        logger.warn({
          event: "POPUP_ENTERPRISE_STATUS_LOAD_FAILED",
          error,
        });
        setEnterpriseStatus(DEFAULT_ENTERPRISE_STATUS);
      });
  }, []);

  async function loadConfig() {
    const [cspResult, nrdResult, retentionResult] = await Promise.allSettled([
      sendMessage<CSPConfig>({ type: "GET_CSP_CONFIG" }),
      sendMessage<NRDConfig>({ type: "GET_NRD_CONFIG" }),
      sendMessage<{ retentionDays: number }>({ type: "GET_DATA_RETENTION_CONFIG" }),
    ]);

    if (cspResult.status === "fulfilled") {
      setConfig(cspResult.value);
      setEndpoint(cspResult.value?.reportEndpoint ?? "");
    } else {
      logger.warn({
        event: "POPUP_CSP_CONFIG_LOAD_FAILED",
        data: { reason: String(cspResult.reason) },
      });
      setConfig(DEFAULT_CSP_CONFIG);
      setEndpoint(DEFAULT_CSP_CONFIG.reportEndpoint ?? "");
    }

    if (nrdResult.status === "fulfilled") {
      setNRDConfig(nrdResult.value);
    } else {
      logger.warn({
        event: "POPUP_NRD_CONFIG_LOAD_FAILED",
        data: { reason: String(nrdResult.reason) },
      });
      setNRDConfig(DEFAULT_NRD_CONFIG);
    }

    if (retentionResult.status === "fulfilled") {
      setRetentionDays(retentionResult.value?.retentionDays ?? 180);
    } else {
      logger.warn({
        event: "POPUP_RETENTION_CONFIG_LOAD_FAILED",
        data: { reason: String(retentionResult.reason) },
      });
      setRetentionDays(180);
    }
  }

  function handleRetentionChange(days: number) {
    if (isLocked || retentionDays === null) return;
    const previous = retentionDays;
    setRetentionDays(days);
    sendMessage({
      type: "SET_DATA_RETENTION_CONFIG",
      data: {
        retentionDays: days,
        autoCleanupEnabled: days !== 0,
        lastCleanupTimestamp: 0,
      },
    }).catch((error) => {
      logger.warn({
        event: "POPUP_RETENTION_CONFIG_SAVE_FAILED",
        error,
      });
      setRetentionDays(previous);
    });
  }

  function formatRetentionDays(days: number): string {
    if (days === 0) return "No expiration";
    if (days < 30) return `${days} days`;
    const months = Math.round(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }

  async function handleSave() {
    if (!config || !nrdConfig || isLocked) return;
    setSaving(true);
    try {
      await sendMessage({
        type: "SET_CSP_CONFIG",
        data: {
          ...config,
          reportEndpoint: endpoint || null,
        },
      });

      await sendMessage({
        type: "SET_NRD_CONFIG",
        data: nrdConfig,
      });

      setMessage("Settings saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      logger.warn({
        event: "POPUP_SETTINGS_SAVE_FAILED",
        error,
      });
    }
    setSaving(false);
  }

  async function handleResetAllData() {
    try {
      await sendMessage({ type: "CLEAR_ALL_DATA" });
      setMessage("All data reset!");
      setTimeout(() => setMessage(""), 2000);
      // Reload config after reset
      loadConfig();
    } catch (error) {
      logger.warn({
        event: "POPUP_RESET_ALL_DATA_FAILED",
        error,
      });
    }
  }

  if (!config || !nrdConfig || retentionDays === null) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Loading...</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div style={styles.section}>
        <LockedBanner />
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP Audit Settings</h3>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            setConfig({
              ...config,
              enabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span style={{ color: colors.textPrimary }}>Enable CSP Auditing</span>
      </label>

      {config.enabled && (
        <>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.collectCSPViolations}
              onChange={(e) =>
                setConfig({
                  ...config,
                  collectCSPViolations: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span style={{ color: colors.textPrimary }}>Collect CSP Violations</span>
          </label>

          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.collectNetworkRequests}
              onChange={(e) =>
                setConfig({
                  ...config,
                  collectNetworkRequests: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span style={{ color: colors.textPrimary }}>Collect Network Requests</span>
          </label>

          <div style={{ marginBottom: "16px" }}>
            <label style={styles.label}>Report Endpoint (optional)</label>
            <input
              type="url"
              style={styles.input}
              value={endpoint}
              onChange={(e) => setEndpoint((e.target as HTMLInputElement).value)}
              placeholder="https://your-server.com/api/reports"
            />
          </div>
        </>
      )}

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>NRD Detection Settings</h3>

      <div style={{ marginBottom: "12px" }}>
        <label style={styles.label}>
          Age Threshold (days): {nrdConfig.thresholdDays}
        </label>
        <input
          type="range"
          min="1"
          max="365"
          value={nrdConfig.thresholdDays}
          onChange={(e) =>
            setNRDConfig({
              ...nrdConfig,
              thresholdDays: parseInt((e.target as HTMLInputElement).value, 10),
            })
          }
          style={{ width: "100%", marginBottom: "4px" }}
        />
        <span style={{ fontSize: "11px", color: colors.textSecondary }}>
          Domains registered within this period are flagged as NRD
        </span>
      </div>

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>Data Retention</h3>

      <div style={{ marginBottom: "12px" }}>
        <label style={styles.label}>
          {formatRetentionDays(retentionDays)}
        </label>
        <input
          type="range"
          min="0"
          max="365"
          step="1"
          value={retentionDays}
          onChange={(e) => handleRetentionChange(parseInt((e.target as HTMLInputElement).value, 10))}
          style={{ width: "100%", marginBottom: "4px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: colors.textSecondary }}>
          <span>No expiration</span>
          <span>1 year</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.button,
            flex: 1,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button
          onClick={handleResetAllData}
          style={{
            ...styles.buttonSecondary,
            color: colors.status.danger.text,
            borderColor: colors.status.danger.border,
          }}
        >
          Reset All Data
        </button>
      </div>

      {message && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "12px",
            color: colors.status.success.text,
            textAlign: "center",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
