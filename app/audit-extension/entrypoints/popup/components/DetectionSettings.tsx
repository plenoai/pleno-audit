import { useState, useEffect } from "preact/hooks";
import {
  createLogger,
  DEFAULT_DETECTION_CONFIG,
  type DetectionConfig,
  type EnterpriseStatus,
} from "@libztbs/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { LockedBanner } from "./LockedBanner";
import { sendMessage } from "../utils/messaging";

interface DetectionOption {
  key: keyof DetectionConfig;
  label: string;
  description: string;
}

const DETECTION_OPTIONS: DetectionOption[] = [
  { key: "enableNRD", label: "NRD", description: "新規登録ドメイン検出" },
  { key: "enableTyposquat", label: "Typosquat", description: "偽装ドメイン検出" },
  { key: "enableAI", label: "AI", description: "AIプロンプト監視" },
  { key: "enablePrivacy", label: "Privacy", description: "プライバシーポリシー検出" },
  { key: "enableTos", label: "ToS", description: "利用規約検出" },
  { key: "enableLogin", label: "Login", description: "ログインページ検出" },
];

const DEFAULT_ENTERPRISE_STATUS: EnterpriseStatus = {
  isManaged: false,
  ssoRequired: false,
  settingsLocked: false,
  config: null,
};
const logger = createLogger("popup-detection-settings");

export function DetectionSettings() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<DetectionConfig | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus>(DEFAULT_ENTERPRISE_STATUS);

  useEffect(() => {
    sendMessage<DetectionConfig>({ type: "GET_DETECTION_CONFIG" })
      .then((result) => {
        setConfig(result);
      })
      .catch((error) => {
        logger.warn({
          event: "POPUP_DETECTION_CONFIG_LOAD_FAILED",
          error,
        });
        setConfig(DEFAULT_DETECTION_CONFIG);
      });

    sendMessage<EnterpriseStatus>({ type: "GET_ENTERPRISE_STATUS" })
      .then((status) => {
        setEnterpriseStatus(status);
      })
      .catch((error) => {
        logger.warn({
          event: "POPUP_ENTERPRISE_STATUS_LOAD_FAILED",
          error,
        });
        setEnterpriseStatus(DEFAULT_ENTERPRISE_STATUS);
      });
  }, []);

  const isLocked = enterpriseStatus.settingsLocked;

  function handleToggle(key: keyof DetectionConfig) {
    if (!config || isLocked) return;
    const previousConfig = config;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    sendMessage({
      type: "SET_DETECTION_CONFIG",
      data: newConfig,
    }).catch((error) => {
      logger.warn({
        event: "POPUP_DETECTION_CONFIG_SAVE_FAILED",
        error,
      });
      setConfig((current) => {
        if (!current) return current;
        return current[key] === newConfig[key]
          ? previousConfig
          : current;
      });
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
      gridTemplateColumns: "1fr 1fr",
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
  };

  if (!config) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>検出設定</div>
        <div style={styles.description}>読み込み中...</div>
      </div>
    );
  }

  const enabledCount = Object.values(config).filter(Boolean).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          検出設定 ({enabledCount}/{DETECTION_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        isLocked ? (
          <LockedBanner />
        ) : (
          <div style={styles.content}>
            {DETECTION_OPTIONS.map((opt) => (
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
        )
      )}
    </div>
  );
}
