import { useState, useEffect, useCallback } from "preact/hooks";
import { sendMessage } from "../../../lib/messaging";
import { Button } from "../../../components";
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

const logger = createLogger("dashboard-settings");

function DLPStatusLabel({
  modelStatus,
  modelDownloading,
  colors,
}: {
  modelStatus: ModelStatus;
  modelDownloading: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const isLoading = modelDownloading || modelStatus.loading;
  if (!isLoading && modelStatus.ready) return null;
  if (!isLoading && !modelStatus.downloaded) return null;

  const statusText = isLoading
    ? (modelStatus.downloaded ? "モデル読み込み中..." : "モデルダウンロード中...")
    : "モデル読み込み待ち";

  return (
    <div style={{ padding: `2px ${spacing.lg}` } as CSSProperties}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.xs,
      }}>
        {isLoading && (
          <span style={{
            display: "inline-block",
            width: "12px",
            height: "12px",
            border: `2px solid ${colors.border}`,
            borderTopColor: colors.interactive,
            borderRadius: "50%",
            animation: "dlp-spin 0.8s linear infinite",
            flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: "10px", color: colors.textSecondary }}>
          {statusText}
        </span>
      </div>
      {isLoading && (
        <style>{`@keyframes dlp-spin { to { transform: rotate(360deg); } }`}</style>
      )}
    </div>
  );
}

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
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ downloaded: false, loading: false, ready: false });
  const [modelDownloading, setModelDownloading] = useState(false);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const ensureModelReady = useCallback(async () => {
    setModelDownloading(true);
    try {
      logger.info("DLP model load: sending DOWNLOAD_DLP_MODEL");
      const result = await sendMessage<{ success: boolean }>({ type: "DOWNLOAD_DLP_MODEL" });
      logger.info("DLP model load: response", result);
      if (result?.success) {
        const s = await sendMessage<ModelStatus>({ type: "GET_DLP_MODEL_STATUS" });
        if (s) setModelStatus(s);
      } else {
        logger.error("DLP model load: failed", result);
      }
    } catch (err) {
      logger.error("DLP model load: exception", err);
    } finally {
      setModelDownloading(false);
    }
  }, []);

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
        }
        if (mStatus) {
          setModelStatus(mStatus);
          // キャッシュ済みだがpipeline未初期化の場合、自動でロードを試みる
          if (dlp?.enabled && mStatus.downloaded && !mStatus.ready && !mStatus.loading) {
            void ensureModelReady();
          }
        }
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
  }, [ensureModelReady]);

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
            </div>
            {isExpanded && (
              <div style={{ padding: `0 ${spacing.lg} ${spacing.sm}`, display: "flex", flexDirection: "column", gap: "2px" } as CSSProperties}>
                <div style={{ display: "flex", gap: spacing.xs, marginBottom: "4px" }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => { if (!allEnabled) toggleGroup(group.alertIds); }}
                    disabled={allEnabled}
                  >
                    すべて有効
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => { if (enabledCount > 0) toggleGroup(group.alertIds); }}
                    disabled={enabledCount === 0}
                  >
                    すべて無効
                  </Button>
                </div>
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

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        DLP
      </span>

      <ToggleRow
        title="PII検出"
        desc="クリップボードコピーやフォーム送信時に個人情報の漏洩を検出"
        checked={dlpConfig.enabled}
        onChange={async () => {
          const enabling = !dlpConfig.enabled;
          const next = { ...dlpConfig, enabled: enabling };
          saveDlpConfig(next);
          if (enabling && !modelStatus.ready && !modelDownloading) {
            // 未ダウンロードでもダウンロード済みでも、自動でダウンロード→ロードを実行
            void ensureModelReady();
          }
        }}
        colors={colors}
      />

      {dlpConfig.enabled && (
        <DLPStatusLabel
          modelStatus={modelStatus}
          modelDownloading={modelDownloading}
          colors={colors}
        />
      )}

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        通知
      </span>

      <ToggleRow title="デスクトップ通知" desc="脅威検出時にOSの通知を表示" checked={notificationConfig.enabled} onChange={() => saveNotification({ ...notificationConfig, enabled: !notificationConfig.enabled })} colors={colors} />

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        表示
      </span>

      <ToggleRow title="アニメーション" desc="タブ切り替えなどのUIアニメーション" checked={animationEnabled} onChange={() => onAnimationToggle(!animationEnabled)} colors={colors} />

      <div style={{
        marginTop: spacing.xl,
        borderTop: `1px solid ${colors.border}`,
        paddingTop: spacing.md,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing.xs,
      } as CSSProperties}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${spacing.xs} ${spacing.md}`,
        } as CSSProperties}>
          {([
            { label: "Webサイト", href: "https://plenoai.com/pleno-audit" },
            { label: "ドキュメント", href: "https://plenoai.com/pleno-audit/docs" },
            { label: "プライバシーポリシー", href: "https://plenoai.com/pleno-audit/privacy" },
            { label: "利用規約", href: "https://plenoai.com/pleno-audit/terms" },
            { label: "FAQ", href: "https://plenoai.com/pleno-audit/faq" },
            { label: "フィードバック", href: "https://github.com/plenoai/pleno-audit/issues" },
          ] as const).map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "10px", color: colors.textSecondary, textDecoration: "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = colors.interactive; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = colors.textSecondary; }}
            >
              {label}
            </a>
          ))}
        </div>
        <span style={{ fontSize: "10px", color: colors.textMuted }}>
          Pleno Audit v{browser.runtime.getManifest().version}
        </span>
      </div>
    </div>
  );
}
