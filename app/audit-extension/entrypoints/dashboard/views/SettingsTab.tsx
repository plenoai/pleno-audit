import { useState, useEffect, useCallback } from "preact/hooks";
import { sendMessage } from "../../../lib/messaging";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";
import {
  createLogger,
  DEFAULT_DETECTION_CONFIG,
  type DetectionConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  type NotificationConfig,
} from "libztbs/extension-runtime";
import { DEFAULT_DLP_ANONYMIZE_CONFIG, type DLPAnonymizeConfig } from "libztbs/ai-detector";
import type { CSSProperties } from "preact/compat";

const logger = createLogger("dashboard-settings");

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  colors,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.sm} ${spacing.lg}`,
        background: colors.bgSecondary,
        borderRadius: borderRadius.md,
        fontSize: fontSize.md,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 } as CSSProperties}>
        <span style={{ fontSize: fontSize.md, fontWeight: 500, color: colors.textPrimary }}>{title}</span>
        <span style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>{desc}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: "14px", height: "14px", cursor: "pointer", flexShrink: 0 }}
      />
    </label>
  );
}

export function SettingsTab() {
  const { colors } = useTheme();

  const [detectionConfig, setDetectionConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
  const [dlpConfig, setDlpConfig] = useState<DLPAnonymizeConfig>(DEFAULT_DLP_ANONYMIZE_CONFIG);
  const [dlpStatus, setDlpStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  useEffect(() => {
    (async () => {
      try {
        const [detection, notification, dlp] = await Promise.all([
          sendMessage<DetectionConfig>({ type: "GET_DETECTION_CONFIG" }),
          sendMessage<NotificationConfig>({ type: "GET_NOTIFICATION_CONFIG" }),
          sendMessage<DLPAnonymizeConfig>({ type: "GET_DLP_ANONYMIZE_CONFIG" }),
        ]);
        setDetectionConfig(detection);
        setNotificationConfig(notification);
        if (dlp) {
          setDlpConfig(dlp);
          setDlpStatus(dlp.serverConnected ? "connected" : "disconnected");
        }
      } catch (error) {
        logger.error("Failed to load settings", error);
      }
    })();
  }, []);

  const saveDetection = useCallback(async (config: DetectionConfig) => {
    setDetectionConfig(config);
    try { await sendMessage({ type: "SET_DETECTION_CONFIG", data: config }); }
    catch (error) { logger.error("Failed to save detection config", error); }
  }, []);

  const saveNotification = useCallback(async (config: NotificationConfig) => {
    setNotificationConfig(config);
    try { await sendMessage({ type: "SET_NOTIFICATION_CONFIG", data: config }); }
    catch (error) { logger.error("Failed to save notification config", error); }
  }, []);

  const saveDlpConfig = useCallback(async (config: DLPAnonymizeConfig) => {
    setDlpConfig(config);
    try { await sendMessage({ type: "SET_DLP_ANONYMIZE_CONFIG", data: config }); }
    catch (error) { logger.error("Failed to save DLP config", error); }
  }, []);

  const testDlpConnection = useCallback(async () => {
    setDlpStatus("connecting");
    try {
      const result = await sendMessage<{ connected: boolean }>({ type: "TEST_DLP_CONNECTION" });
      setDlpStatus(result?.connected ? "connected" : "disconnected");
      if (result?.connected) {
        saveDlpConfig({ ...dlpConfig, serverConnected: true });
      }
    } catch {
      setDlpStatus("disconnected");
    }
  }, [dlpConfig, saveDlpConfig]);

  return (
    <div
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
      }}
    >
      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        アラートルール
      </span>

      <ToggleRow title="NRD検出" desc="新規登録ドメインを検出しアラート" checked={detectionConfig.enableNRD} onChange={() => saveDetection({ ...detectionConfig, enableNRD: !detectionConfig.enableNRD })} colors={colors} />
      <ToggleRow title="Typosquat検出" desc="偽装ドメインを検出しアラート" checked={detectionConfig.enableTyposquat} onChange={() => saveDetection({ ...detectionConfig, enableTyposquat: !detectionConfig.enableTyposquat })} colors={colors} />
      <ToggleRow title="AIプロンプト監視" desc="AI入力に含まれる機密データを検出しアラート" checked={detectionConfig.enableAI} onChange={() => saveDetection({ ...detectionConfig, enableAI: !detectionConfig.enableAI })} colors={colors} />

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        DLP（データ漏洩防止）
      </span>

      <ToggleRow
        title="PII検出（pleno-anonymize）"
        desc="ローカルサーバーでクリップボード・フォームの個人情報を検出"
        checked={dlpConfig.enabled}
        onChange={() => {
          const next = { ...dlpConfig, enabled: !dlpConfig.enabled };
          saveDlpConfig(next);
          saveDetection({ ...detectionConfig, enableDLPAnonymize: next.enabled });
        }}
        colors={colors}
      />

      {dlpConfig.enabled && (
        <div style={{ padding: `${spacing.sm} ${spacing.lg}`, display: "flex", flexDirection: "column", gap: spacing.sm } as CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <input
              type="text"
              value={dlpConfig.serverUrl}
              onInput={(e) => saveDlpConfig({ ...dlpConfig, serverUrl: (e.target as HTMLInputElement).value })}
              placeholder="http://localhost:8080"
              style={{
                flex: 1,
                padding: `${spacing.xs} ${spacing.sm}`,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md,
                color: colors.textPrimary,
                fontSize: fontSize.xs,
              }}
            />
            <button
              type="button"
              onClick={testDlpConnection}
              disabled={dlpStatus === "connecting"}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md,
                color: colors.textPrimary,
                fontSize: fontSize.xs,
                cursor: dlpStatus === "connecting" ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {dlpStatus === "connecting" ? "接続中..." : "接続テスト"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, fontSize: fontSize.xs }}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%", display: "inline-block",
              background: dlpStatus === "connected" ? "#22c55e" : dlpStatus === "connecting" ? "#eab308" : "#ef4444",
            }} />
            <span style={{ color: colors.textSecondary }}>
              {dlpStatus === "connected" ? "サーバー接続済み" : dlpStatus === "connecting" ? "接続確認中" : "未接続"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <span style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>検出言語:</span>
            <select
              value={dlpConfig.language}
              onChange={(e) => saveDlpConfig({ ...dlpConfig, language: (e.target as HTMLSelectElement).value as "ja" | "en" })}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md,
                color: colors.textPrimary,
                fontSize: fontSize.xs,
              }}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      )}

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        通知
      </span>

      <ToggleRow title="デスクトップ通知" desc="脅威検出時にOSの通知を表示" checked={notificationConfig.enabled} onChange={() => saveNotification({ ...notificationConfig, enabled: !notificationConfig.enabled })} colors={colors} />
    </div>
  );
}
