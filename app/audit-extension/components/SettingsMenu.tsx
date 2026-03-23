import { useState, useRef, useEffect } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";
import {
  createLogger,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  type BlockingConfig,
  type NotificationConfig,
} from "@libztbs/extension-runtime";

interface Props {
  onClearData: () => void;
  onExport?: () => void;
}

const logger = createLogger("settings-menu");

function formatRetentionDays(days: number): string {
  if (days === 0) return "無期限";
  if (days < 30) return `${days}日`;
  const months = Math.round(days / 30);
  return months === 1 ? "1ヶ月" : `${months}ヶ月`;
}

export function SettingsMenu({ onClearData, onExport }: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [blockingConfig, setBlockingConfig] = useState<BlockingConfig | null>(null);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function reportOperationError(message: string, error: unknown): void {
    logger.warn({
      event: "SETTINGS_MENU_OPERATION_FAILED",
      data: { message },
      error,
    });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && retentionDays === null) {
      chrome.runtime.sendMessage({ type: "GET_DATA_RETENTION_CONFIG" })
        .then((config) => {
          setRetentionDays(config?.retentionDays ?? 180);
        })
        .catch((error) => {
          setRetentionDays(180);
          reportOperationError("データ保持設定の読み込みに失敗しました。", error);
        });
    }
  }, [isOpen, retentionDays]);

  useEffect(() => {
    if (isOpen && blockingConfig === null) {
      chrome.runtime.sendMessage({ type: "GET_BLOCKING_CONFIG" })
        .then((config) => {
          setBlockingConfig(config ?? DEFAULT_BLOCKING_CONFIG);
        })
        .catch((error) => {
          setBlockingConfig(DEFAULT_BLOCKING_CONFIG);
          reportOperationError("保護機能設定の読み込みに失敗しました。", error);
        });
    }
  }, [isOpen, blockingConfig]);

  useEffect(() => {
    if (isOpen && notificationConfig === null) {
      chrome.runtime.sendMessage({ type: "GET_NOTIFICATION_CONFIG" })
        .then((config) => {
          setNotificationConfig(config ?? DEFAULT_NOTIFICATION_CONFIG);
        })
        .catch((error) => {
          setNotificationConfig(DEFAULT_NOTIFICATION_CONFIG);
          reportOperationError("通知設定の読み込みに失敗しました。", error);
        });
    }
  }, [isOpen, notificationConfig]);

  function handleRetentionChange(days: number) {
    if (retentionDays === null) return;
    const previous = retentionDays;
    setRetentionDays(days);
    chrome.runtime.sendMessage({
      type: "SET_DATA_RETENTION_CONFIG",
      data: {
        retentionDays: days,
        autoCleanupEnabled: days !== 0,
        lastCleanupTimestamp: 0,
      },
    }).catch((error) => {
      setRetentionDays(previous);
      reportOperationError("データ保持設定の保存に失敗しました。", error);
    });
  }

  function handleBlockingToggle() {
    if (!blockingConfig) return;
    const previous = blockingConfig;
    const nextEnabled = !blockingConfig.enabled;
    const newConfig = {
      ...blockingConfig,
      enabled: nextEnabled,
      userConsentGiven: nextEnabled ? true : blockingConfig.userConsentGiven,
    };
    setBlockingConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_BLOCKING_CONFIG",
      data: newConfig,
    }).catch((error) => {
      setBlockingConfig(previous);
      reportOperationError("保護機能設定の保存に失敗しました。", error);
    });
  }

  function handleNotificationToggle() {
    if (!notificationConfig) return;

    const previous = notificationConfig;
    const newConfig = { ...notificationConfig, enabled: !notificationConfig.enabled };
    setNotificationConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_NOTIFICATION_CONFIG",
      data: newConfig,
    }).catch((error) => {
      setNotificationConfig(previous);
      reportOperationError("通知設定の保存に失敗しました。", error);
    });
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        className="hover-bg"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textSecondary,
          fontSize: "16px",
        }}
        title="設定"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "160px",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
            <ThemeToggle />
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              データ保持期間
            </div>
            {retentionDays !== null ? (
              <div>
                <div style={{ fontSize: "12px", color: colors.textPrimary, marginBottom: "4px" }}>
                  {formatRetentionDays(retentionDays)}
                </div>
                <input
                  type="range"
                  min="0"
                  max="365"
                  step="1"
                  value={retentionDays}
                  onChange={(e) => handleRetentionChange(parseInt((e.target as HTMLInputElement).value, 10))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: colors.textMuted, marginTop: "2px" }}>
                  <span>無期限</span>
                  <span>1年</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              保護機能
            </div>
            {blockingConfig !== null ? (
              <div>
                <button
                  onClick={handleBlockingToggle}
                  aria-pressed={blockingConfig.enabled}
                  aria-label={`リスクブロック: ${blockingConfig.enabled ? "有効" : "無効"}`}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: blockingConfig.enabled ? colors.status.success.bg : colors.bgSecondary,
                    border: `1px solid ${blockingConfig.enabled ? colors.status.success.text : colors.border}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: blockingConfig.enabled ? colors.status.success.text : colors.textPrimary,
                    transition: "all 0.15s",
                  }}
                >
                  <span>リスクブロック</span>
                  <span style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: blockingConfig.enabled ? colors.status.success.text : colors.textMuted,
                    color: colors.bgPrimary,
                  }}>
                    {blockingConfig.enabled ? "ON" : "OFF"}
                  </span>
                </button>
                <div style={{ fontSize: "10px", color: colors.textMuted, marginTop: "6px", lineHeight: 1.4 }}>
                  タイポスクワット、NRDログイン、機密データ送信を検出時にブロック
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              通知
            </div>
            {notificationConfig !== null ? (
              <div>
                <button
                  onClick={handleNotificationToggle}
                  aria-pressed={notificationConfig.enabled}
                  aria-label={`デスクトップ通知: ${notificationConfig.enabled ? "有効" : "無効"}`}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: notificationConfig.enabled ? colors.status.info.bg : colors.bgSecondary,
                    border: `1px solid ${notificationConfig.enabled ? colors.status.info.text : colors.border}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: notificationConfig.enabled ? colors.status.info.text : colors.textPrimary,
                    transition: "all 0.15s",
                  }}
                >
                  <span>デスクトップ通知</span>
                  <span style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: notificationConfig.enabled ? colors.status.info.text : colors.textMuted,
                    color: colors.bgPrimary,
                  }}>
                    {notificationConfig.enabled ? "ON" : "OFF"}
                  </span>
                </button>
                <div style={{ fontSize: "10px", color: colors.textMuted, marginTop: "6px", lineHeight: 1.4 }}>
                  重大なセキュリティイベントを通知
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          {onExport && (
            <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
              <button
                className="hover-bg"
                onClick={() => {
                  setIsOpen(false);
                  onExport();
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textPrimary,
                  borderRadius: "4px",
                  textAlign: "left",
                }}
              >
                <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                エクスポート
              </button>
            </div>
          )}

          <div style={{ padding: "4px" }}>
            <button
              className="hover-bg"
              onClick={() => {
                setIsOpen(false);
                onClearData();
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.status.danger.text,
                borderRadius: "4px",
                textAlign: "left",
              }}
            >
              <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              データを削除
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
