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
import { ALERT_GROUPS, ALL_PLAYBOOKS } from "libztbs/alerts";
import { DEFAULT_DLP_SERVER_CONFIG, type DLPServerConfig, type ModelStatus } from "libztbs/ai-detector";
import type { CSSProperties } from "preact/compat";

const PLAYBOOK_MAP = Object.fromEntries(ALL_PLAYBOOKS.map((p) => [p.id, p]));

const DETECTION_CONFIG_MAP: Record<string, keyof DetectionConfig> = {
  nrd: "enableNRD",
  typosquat: "enableTyposquat",
  ai_sensitive: "enableAI",
  shadow_ai: "enableAI",
};

const DLP_MODEL_URL = "https://huggingface.co/0xhikae/ja-ner-ja/resolve/main/model-browser.bin";
const DLP_WASM_URL = "https://huggingface.co/0xhikae/ja-ner-ja/resolve/main/pleno_tokenizer_wasm_bg.wasm";

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

export function SettingsTab({ animationEnabled, onAnimationToggle }: { animationEnabled: boolean; onAnimationToggle: (v: boolean) => void }) {
  const { colors } = useTheme();

  const [detectionConfig, setDetectionConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
  const [dlpConfig, setDlpConfig] = useState<DLPServerConfig>(DEFAULT_DLP_SERVER_CONFIG);
  const [dlpStatus, setDlpStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ downloaded: false, loading: false, ready: false });
  const [modelDownloading, setModelDownloading] = useState(false);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [detection, notification, dlp, mStatus, disabled] = await Promise.all([
          sendMessage<DetectionConfig>({ type: "GET_DETECTION_CONFIG" }),
          sendMessage<NotificationConfig>({ type: "GET_NOTIFICATION_CONFIG" }),
          sendMessage<DLPServerConfig>({ type: "GET_DLP_SERVER_CONFIG" }),
          sendMessage<ModelStatus>({ type: "GET_DLP_MODEL_STATUS" }),
          sendMessage<string[]>({ type: "GET_DISABLED_ALERT_CATEGORIES" }),
        ]);
        setDetectionConfig(detection);
        setNotificationConfig(notification);
        if (dlp) {
          setDlpConfig(dlp);
          setDlpStatus(dlp.serverConnected ? "connected" : "disconnected");
        }
        if (mStatus) setModelStatus(mStatus);
        // DetectionConfigのフラグとdisabledAlertCategoriesを統合
        const merged = new Set(disabled ?? []);
        if (!detection.enableNRD) merged.add("nrd");
        if (!detection.enableTyposquat) merged.add("typosquat");
        if (!detection.enableAI) { merged.add("ai_sensitive"); merged.add("shadow_ai"); }
        setDisabledCategories(merged);
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

  const saveDlpConfig = useCallback(async (config: DLPServerConfig) => {
    setDlpConfig(config);
    try { await sendMessage({ type: "SET_DLP_SERVER_CONFIG", data: config }); }
    catch (error) { logger.error("Failed to save DLP config", error); }
  }, []);

  const toggleCategory = useCallback(async (categoryId: string) => {
    const next = new Set(disabledCategories);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setDisabledCategories(next);
    const arr = Array.from(next);
    try {
      await sendMessage({ type: "SET_DISABLED_ALERT_CATEGORIES", data: arr });
    } catch (error) {
      logger.error("Failed to save disabled categories", error);
    }
    const configKey = DETECTION_CONFIG_MAP[categoryId];
    if (configKey) {
      saveDetection({ ...detectionConfig, [configKey]: !next.has(categoryId) });
    }
  }, [disabledCategories, detectionConfig, saveDetection]);

  const toggleGroup = useCallback(async (alertIds: string[]) => {
    const allEnabled = alertIds.every((id) => !disabledCategories.has(id));
    const next = new Set(disabledCategories);
    for (const id of alertIds) {
      if (allEnabled) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }
    setDisabledCategories(next);
    const arr = Array.from(next);
    try {
      await sendMessage({ type: "SET_DISABLED_ALERT_CATEGORIES", data: arr });
    } catch (error) {
      logger.error("Failed to save disabled categories", error);
    }
    const configUpdates: Partial<DetectionConfig> = {};
    for (const id of alertIds) {
      const configKey = DETECTION_CONFIG_MAP[id];
      if (configKey) {
        configUpdates[configKey] = !next.has(id);
      }
    }
    if (Object.keys(configUpdates).length > 0) {
      saveDetection({ ...detectionConfig, ...configUpdates });
    }
  }, [disabledCategories, detectionConfig, saveDetection]);

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

      {ALERT_GROUPS.map((group) => {
        const enabledCount = group.alertIds.filter((id) => !disabledCategories.has(id)).length;
        const allEnabled = enabledCount === group.alertIds.length;
        const isExpanded = expandedGroups.has(group.id);
        return (
          <div key={group.id} style={{ background: colors.bgSecondary, borderRadius: borderRadius.md, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${spacing.sm} ${spacing.lg}`,
                cursor: "pointer",
              }}
              onClick={() => {
                const next = new Set(expandedGroups);
                if (isExpanded) next.delete(group.id); else next.add(group.id);
                setExpandedGroups(next);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                <span style={{ fontSize: "10px", color: colors.textSecondary, width: "12px", textAlign: "center" }}>
                  {isExpanded ? "\u25BC" : "\u25B6"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" } as CSSProperties}>
                  <span style={{ fontSize: fontSize.md, fontWeight: 500, color: colors.textPrimary }}>{group.label}</span>
                  <span style={{ fontSize: "10px", color: colors.textSecondary }}>{enabledCount}/{group.alertIds.length} 有効</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allEnabled}
                ref={(el) => { if (el) el.indeterminate = enabledCount > 0 && !allEnabled; }}
                onChange={(e) => { e.stopPropagation(); toggleGroup(group.alertIds); }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: "14px", height: "14px", cursor: "pointer", flexShrink: 0 }}
              />
            </div>
            {isExpanded && (
              <div style={{ padding: `0 ${spacing.lg} ${spacing.sm}`, display: "flex", flexDirection: "column", gap: "2px" } as CSSProperties}>
                {group.alertIds.map((alertId) => {
                  const playbook = PLAYBOOK_MAP[alertId];
                  const enabled = !disabledCategories.has(alertId);
                  return (
                    <label
                      key={alertId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: `4px ${spacing.sm}`,
                        borderRadius: borderRadius.sm,
                        cursor: "pointer",
                        background: enabled ? "transparent" : `${colors.textSecondary}08`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: fontSize.xs, fontWeight: 500, color: enabled ? colors.textPrimary : colors.textSecondary }}>
                          {playbook?.title ?? alertId}
                        </span>
                        <a
                          href={`https://plenoai.com/pleno-audit/alerts/${alertId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: "10px", color: colors.accent, textDecoration: "none", flexShrink: 0 }}
                        >
                          詳細 ↗
                        </a>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleCategory(alertId)}
                        style={{ width: "12px", height: "12px", cursor: "pointer", flexShrink: 0, marginLeft: spacing.sm }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* TODO: DLP機能が完成次第コメントアウトを解除する
      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        DLP（データ漏洩防止）
      </span>

      <ToggleRow
        title="NER PII検出"
        desc="クリップボード・フォームの個人情報（氏名・住所等）を検出"
        checked={dlpConfig.enabled}
        onChange={() => {
          const next = { ...dlpConfig, enabled: !dlpConfig.enabled };
          saveDlpConfig(next);
          saveDetection({ ...detectionConfig, enableDLPServer: next.enabled });
        }}
        colors={colors}
      />

      {dlpConfig.enabled && (
        <div style={{ padding: `${spacing.sm} ${spacing.lg}`, display: "flex", flexDirection: "column", gap: spacing.sm } as CSSProperties}>
          <div style={{
            padding: spacing.sm,
            background: colors.bgSecondary,
            borderRadius: borderRadius.md,
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" } as CSSProperties}>
                <span style={{ fontSize: fontSize.xs, fontWeight: 500, color: colors.textPrimary }}>
                  ローカルNERモデル
                </span>
                <span style={{ fontSize: "10px", color: colors.textSecondary }}>
                  ブラウザ内推論（CNN, ~6MB）
                </span>
              </div>
              {modelStatus.downloaded ? (
                <div style={{ display: "flex", gap: spacing.xs }}>
                  {!modelStatus.ready && !modelStatus.loading && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await sendMessage({ type: "LOAD_DLP_MODEL" });
                          const s = await sendMessage<ModelStatus>({ type: "GET_DLP_MODEL_STATUS" });
                          if (s) setModelStatus(s);
                          saveDlpConfig({ ...dlpConfig, useLocalModel: true, localModelReady: true });
                        } catch { }
                      }}
                      style={{
                        padding: `2px ${spacing.xs}`,
                        background: colors.accent,
                        border: "none",
                        borderRadius: borderRadius.sm,
                        color: "#fff",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      ロード
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await sendMessage({ type: "DELETE_DLP_MODEL" });
                      setModelStatus({ downloaded: false, loading: false, ready: false });
                      saveDlpConfig({ ...dlpConfig, useLocalModel: false, localModelReady: false });
                    }}
                    style={{
                      padding: `2px ${spacing.xs}`,
                      background: "transparent",
                      border: `1px solid ${colors.border}`,
                      borderRadius: borderRadius.sm,
                      color: colors.textSecondary,
                      fontSize: "10px",
                      cursor: "pointer",
                    }}
                  >
                    削除
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={modelDownloading}
                  onClick={async () => {
                    setModelDownloading(true);
                    try {
                      const result = await sendMessage<{ success: boolean }>({ type: "DOWNLOAD_DLP_MODEL", data: { modelUrl: DLP_MODEL_URL, wasmUrl: DLP_WASM_URL } });
                      if (result?.success) {
                        const s = await sendMessage<ModelStatus>({ type: "GET_DLP_MODEL_STATUS" });
                        if (s) setModelStatus(s);
                        saveDlpConfig({ ...dlpConfig, useLocalModel: true, localModelReady: true });
                      }
                    } catch (err) {
                      logger.error("Model download failed", err);
                    } finally {
                      setModelDownloading(false);
                    }
                  }}
                  style={{
                    padding: `2px ${spacing.sm}`,
                    background: colors.accent,
                    border: "none",
                    borderRadius: borderRadius.sm,
                    color: "#fff",
                    fontSize: "10px",
                    cursor: modelDownloading ? "wait" : "pointer",
                    opacity: modelDownloading ? 0.6 : 1,
                  }}
                >
                  {modelDownloading ? "ダウンロード中..." : "モデルをダウンロード"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, fontSize: "10px" }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%", display: "inline-block",
                background: modelStatus.ready ? "var(--success)" : modelStatus.downloaded ? "var(--warning)" : "var(--muted)",
              }} />
              <span style={{ color: colors.textSecondary }}>
                {modelStatus.ready
                  ? `推論可能${modelStatus.modelSize ? ` (${(modelStatus.modelSize / 1024 / 1024).toFixed(1)}MB)` : ""}`
                  : modelStatus.loading
                    ? "ロード中..."
                    : modelStatus.downloaded
                      ? "ダウンロード済み（未ロード）"
                      : "未ダウンロード"}
              </span>
            </div>
          </div>

          {!dlpConfig.useLocalModel && (
            <>
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
                  background: dlpStatus === "connected" ? "var(--success)" : dlpStatus === "connecting" ? "var(--warning)" : "var(--danger)",
                }} />
                <span style={{ color: colors.textSecondary }}>
                  {dlpStatus === "connected" ? "サーバー接続済み" : dlpStatus === "connecting" ? "接続確認中" : "未接続"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
      */}

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        通知
      </span>

      <ToggleRow title="デスクトップ通知" desc="脅威検出時にOSの通知を表示" checked={notificationConfig.enabled} onChange={() => saveNotification({ ...notificationConfig, enabled: !notificationConfig.enabled })} colors={colors} />

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        表示
      </span>

      <ToggleRow title="アニメーション" desc="タブ切り替えなどのUIアニメーション" checked={animationEnabled} onChange={() => onAnimationToggle(!animationEnabled)} colors={colors} />
    </div>
  );
}
