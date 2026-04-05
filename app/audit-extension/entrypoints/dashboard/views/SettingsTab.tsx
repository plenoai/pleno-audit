import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { Globe, BookOpen, Shield, Scale, HelpCircle, MessageSquare, ExternalLink } from "lucide-preact";
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

const logger = createLogger("dashboard-settings");

function DLPModelCard({
  modelStatus,
  modelDownloading,
  onDownload,
  onDelete,
  colors,
}: {
  modelStatus: ModelStatus;
  modelDownloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const isLoading = modelDownloading || modelStatus.loading;
  const statusStyle = modelStatus.ready
    ? colors.status.success
    : isLoading
      ? colors.status.warning
      : colors.status.default;
  const dotColor = modelStatus.ready
    ? colors.dot.success
    : isLoading
      ? colors.dot.warning
      : modelStatus.downloaded
        ? colors.dot.info
        : colors.dot.default;
  const statusText = modelStatus.ready
    ? "動作中"
    : isLoading
      ? "読み込み中..."
      : modelStatus.downloaded
        ? "ダウンロード済み"
        : "未ダウンロード";

  return (
    <div style={{ padding: `${spacing.sm} ${spacing.lg}` } as CSSProperties}>
      <div style={{
        padding: spacing.md,
        background: statusStyle.bg,
        border: `1px solid ${statusStyle.border}`,
        borderRadius: borderRadius.md,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
            background: dotColor,
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" } as CSSProperties}>
            <span style={{ fontSize: fontSize.xs, fontWeight: 600, color: statusStyle.text }}>
              {statusText}
            </span>
            <span style={{ fontSize: "10px", color: colors.textSecondary }}>
              {modelStatus.ready
                ? "PII検出が有効です"
                : modelStatus.downloaded
                  ? "読み込みが必要です"
                  : "初回ダウンロード 約9MB"}
            </span>
          </div>
        </div>
        {modelStatus.ready ? (
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              background: colors.bgPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.sm,
              color: colors.textPrimary,
              fontSize: fontSize.xs,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            削除
          </button>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={onDownload}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              background: isLoading ? colors.status.warning.bg : colors.interactive,
              border: isLoading ? `1px solid ${colors.status.warning.border}` : "none",
              borderRadius: borderRadius.sm,
              color: isLoading ? colors.status.warning.text : colors.textInverse,
              fontSize: fontSize.xs,
              fontWeight: 500,
              cursor: isLoading ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading
              ? "読み込み中..."
              : modelStatus.downloaded
                ? "読み込み"
                : "ダウンロード"}
          </button>
        )}
      </div>
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

function AboutLink({
  icon: Icon,
  label,
  desc,
  href,
  colors,
  isLast,
}: {
  icon: typeof Globe;
  label: string;
  desc: string;
  href: string;
  colors: ReturnType<typeof useTheme>["colors"];
  isLast: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => { if (ref.current) ref.current.style.background = colors.bgTertiary; }}
      onMouseLeave={() => { if (ref.current) ref.current.style.background = "transparent"; }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        padding: `${spacing.sm} ${spacing.lg}`,
        textDecoration: "none",
        background: "transparent",
        transition: "background-color 0.15s",
        borderBottom: isLast ? "none" : `1px solid ${colors.border}`,
      }}
    >
      <Icon size={16} style={{ color: colors.textSecondary, flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 } as CSSProperties}>
        <span style={{ fontSize: fontSize.md, fontWeight: 500, color: colors.textPrimary }}>{label}</span>
        <span style={{ fontSize: "10px", color: colors.textSecondary }}>{desc}</span>
      </div>
      <ExternalLink size={12} style={{ color: colors.textMuted, flexShrink: 0 }} />
    </a>
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

  const loadModelFromCache = useCallback(async () => {
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
            void loadModelFromCache();
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
  }, [loadModelFromCache]);

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
          // 有効化時にキャッシュ済みモデルがあれば自動ロード
          if (enabling && modelStatus.downloaded && !modelStatus.ready && !modelDownloading) {
            void loadModelFromCache();
          }
        }}
        colors={colors}
      />

      {dlpConfig.enabled && (
        <DLPModelCard
          modelStatus={modelStatus}
          modelDownloading={modelDownloading}
          onDownload={() => void loadModelFromCache()}
          onDelete={async () => {
            await sendMessage({ type: "DELETE_DLP_MODEL" });
            setModelStatus({ downloaded: false, loading: false, ready: false });
            saveDlpConfig({ ...dlpConfig, modelReady: false });
          }}
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

      <span style={{ fontSize: fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, display: "block" } as CSSProperties}>
        このアプリについて
      </span>

      <div style={{
        background: colors.bgSecondary,
        borderRadius: borderRadius.md,
        overflow: "hidden",
      }}>
        {([
          { icon: Globe, label: "Webサイト", desc: "plenoai.com", href: "https://plenoai.com/pleno-audit" },
          { icon: BookOpen, label: "ドキュメント", desc: "使い方・機能紹介", href: "https://plenoai.com/pleno-audit/docs" },
          { icon: Shield, label: "プライバシーポリシー", desc: "データの取り扱い", href: "https://plenoai.com/pleno-audit/privacy" },
          { icon: Scale, label: "利用規約", desc: "AGPL-3.0 ライセンス", href: "https://plenoai.com/pleno-audit/terms" },
          { icon: HelpCircle, label: "FAQ", desc: "よくある質問", href: "https://plenoai.com/pleno-audit/faq" },
          { icon: MessageSquare, label: "フィードバック", desc: "GitHub Issues", href: "https://github.com/plenoai/pleno-audit/issues" },
        ] as const).map(({ icon: Icon, label, desc, href }, i, arr) => (
          <AboutLink key={href} icon={Icon} label={label} desc={desc} href={href} colors={colors} isLast={i === arr.length - 1} />
        ))}
        <div style={{
          padding: `${spacing.sm} ${spacing.lg}`,
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ fontSize: "10px", color: colors.textMuted }}>
            Pleno Audit v{browser.runtime.getManifest().version}
          </span>
        </div>
      </div>
    </div>
  );
}
