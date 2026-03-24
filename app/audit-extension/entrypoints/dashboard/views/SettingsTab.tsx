import { useState, useEffect, useCallback } from "preact/hooks";
import { sendMessage } from "../../../lib/messaging";
import { useTheme } from "../../../lib/theme";
import {
  createLogger,
  DEFAULT_DETECTION_CONFIG,
  type DetectionConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  type NotificationConfig,
} from "@libztbs/extension-runtime";
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
        padding: "8px 10px",
        background: colors.bgSecondary,
        borderRadius: "6px",
        fontSize: "12px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 } as CSSProperties}>
        <span style={{ fontSize: "12px", fontWeight: 500, color: colors.textPrimary }}>{title}</span>
        <span style={{ fontSize: "10px", opacity: 0.7, color: colors.textSecondary }}>{desc}</span>
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

  useEffect(() => {
    (async () => {
      try {
        const [detection, notification] = await Promise.all([
          sendMessage<DetectionConfig>({ type: "GET_DETECTION_CONFIG" }),
          sendMessage<NotificationConfig>({ type: "GET_NOTIFICATION_CONFIG" }),
        ]);
        setDetectionConfig(detection);
        setNotificationConfig(notification);
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

  return (
    <div
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <span style={{ fontSize: "11px", fontWeight: 600, color: colors.textPrimary, marginBottom: "2px", display: "block" } as CSSProperties}>
        アラートルール
      </span>

      <ToggleRow title="NRD検出" desc="新規登録ドメインを検出しアラート" checked={detectionConfig.enableNRD} onChange={() => saveDetection({ ...detectionConfig, enableNRD: !detectionConfig.enableNRD })} colors={colors} />
      <ToggleRow title="Typosquat検出" desc="偽装ドメインを検出しアラート" checked={detectionConfig.enableTyposquat} onChange={() => saveDetection({ ...detectionConfig, enableTyposquat: !detectionConfig.enableTyposquat })} colors={colors} />
      <ToggleRow title="AIプロンプト監視" desc="AI入力に含まれる機密データを検出しアラート" checked={detectionConfig.enableAI} onChange={() => saveDetection({ ...detectionConfig, enableAI: !detectionConfig.enableAI })} colors={colors} />

      <span style={{ fontSize: "11px", fontWeight: 600, color: colors.textPrimary, marginTop: "10px", marginBottom: "2px", display: "block" } as CSSProperties}>
        通知
      </span>

      <ToggleRow title="デスクトップ通知" desc="脅威検出時にOSの通知を表示" checked={notificationConfig.enabled} onChange={() => saveNotification({ ...notificationConfig, enabled: !notificationConfig.enabled })} colors={colors} />
    </div>
  );
}
