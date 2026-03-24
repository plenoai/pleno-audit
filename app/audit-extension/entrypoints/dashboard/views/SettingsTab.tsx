import { useState, useEffect, useCallback } from "preact/hooks";
import { Badge, Button } from "../../../components";
import { sendMessage } from "../../../lib/messaging";
import { useTheme } from "../../../lib/theme";
import {
  createLogger,
  DEFAULT_DETECTION_CONFIG,
  type DetectionConfig,
  type EnterpriseStatus,
  DEFAULT_DOH_MONITOR_CONFIG,
  type DoHMonitorConfig,
  type DoHAction,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  type NetworkMonitorConfig,
} from "@libztbs/extension-runtime";
import {
  type CSPConfig,
  DEFAULT_CSP_CONFIG,
  type GeneratedCSPByDomain,
  type DomainCSPPolicy,
} from "@libztbs/csp";
import { Lock } from "lucide-preact";
import type { CSSProperties } from "preact/compat";

const logger = createLogger("dashboard-settings");

// ============================================================================
// Shared Styles
// ============================================================================

const styles = {
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    cursor: "pointer",
    userSelect: "none",
  } as CSSProperties,
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
  } as CSSProperties,
  chevron: (expanded: boolean): CSSProperties => ({
    fontSize: "10px",
    display: "inline-block",
    width: "12px",
    textAlign: "center",
    transition: "transform 0.2s",
    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    flexShrink: 0,
  }),
  content: {
    paddingBottom: "12px",
  } as CSSProperties,
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  } as CSSProperties,
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  } as CSSProperties,
  option: (colors: ReturnType<typeof useTheme>["colors"]): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    background: colors.bgSecondary,
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  }),
  checkbox: {
    width: "14px",
    height: "14px",
    cursor: "pointer",
    flexShrink: 0,
  } as CSSProperties,
  radio: {
    width: "14px",
    height: "14px",
    cursor: "pointer",
    flexShrink: 0,
  } as CSSProperties,
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: 0,
  } as CSSProperties,
  labelTitle: {
    fontSize: "12px",
    fontWeight: 500,
  } as CSSProperties,
  labelDesc: {
    fontSize: "10px",
    opacity: 0.7,
  } as CSSProperties,
  infoRow: (colors: ReturnType<typeof useTheme>["colors"]): CSSProperties => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    background: colors.bgSecondary,
    borderRadius: "6px",
    fontSize: "12px",
  }),
  codeBlock: (colors: ReturnType<typeof useTheme>["colors"]): CSSProperties => ({
    background: colors.bgTertiary,
    borderRadius: "4px",
    padding: "8px 10px",
    fontSize: "11px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    color: colors.textSecondary,
    maxHeight: "200px",
    overflow: "auto",
  }),
};

// ============================================================================
// Section Component
// ============================================================================

function Section({
  title,
  headerRight,
  expanded,
  onToggle,
  children,
  borderColor,
}: {
  title: string;
  headerRight?: preact.ComponentChildren;
  expanded: boolean;
  onToggle: () => void;
  children: preact.ComponentChildren;
  borderColor: string;
}) {
  const { colors } = useTheme();
  return (
    <div style={{ borderTop: `1px solid ${borderColor}` }}>
      <div
        style={{ ...styles.sectionHeader, color: colors.textPrimary }}
        onClick={onToggle}
      >
        <div style={styles.sectionTitle}>
          <span style={styles.chevron(expanded)}>▶</span>
          <span>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {headerRight}
        </div>
      </div>
      {expanded && <div style={styles.content}>{children}</div>}
    </div>
  );
}

// ============================================================================
// LockedBanner
// ============================================================================

function LockedBanner({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 10px",
        background: colors.status?.warning?.bg || "#fef3c7",
        borderRadius: "6px",
        marginBottom: "8px",
      }}
    >
      <Lock size={12} />
      <span
        style={{
          fontSize: "11px",
          color: colors.status?.warning?.text || "#92400e",
        }}
      >
        この設定は組織によって管理されています
      </span>
    </div>
  );
}

// ============================================================================
// SettingsTab
// ============================================================================

export function SettingsTab() {
  const { colors } = useTheme();

  // Section expand state (all collapsed by default)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    detection: false,
    csp: false,
    doh: false,
    network: false,
    enterprise: false,
    cspPolicy: false,
  });

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Data state
  const [detectionConfig, setDetectionConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);
  const [cspConfig, setCspConfig] = useState<CSPConfig>(DEFAULT_CSP_CONFIG);
  const [dohConfig, setDohConfig] = useState<DoHMonitorConfig>(DEFAULT_DOH_MONITOR_CONFIG);
  const [networkConfig, setNetworkConfig] = useState<NetworkMonitorConfig>(DEFAULT_NETWORK_MONITOR_CONFIG);
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus | null>(null);
  const [cspPolicies, setCspPolicies] = useState<GeneratedCSPByDomain | null>(null);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  // Load all configs on mount
  useEffect(() => {
    (async () => {
      try {
        const [detection, csp, doh, network, enterprise] = await Promise.all([
          sendMessage<DetectionConfig>({ type: "GET_DETECTION_CONFIG" }),
          sendMessage<CSPConfig>({ type: "GET_CSP_CONFIG" }),
          sendMessage<DoHMonitorConfig>({ type: "GET_DOH_MONITOR_CONFIG" }),
          sendMessage<NetworkMonitorConfig>({ type: "GET_NETWORK_MONITOR_CONFIG" }),
          sendMessage<EnterpriseStatus>({ type: "GET_ENTERPRISE_STATUS" }),
        ]);
        setDetectionConfig(detection);
        setCspConfig(csp);
        setDohConfig(doh);
        setNetworkConfig(network);
        setEnterpriseStatus(enterprise);
      } catch (error) {
        logger.error("Failed to load settings", error);
      }
    })();

    // Load CSP policies from storage
    chrome.storage.local.get("generatedCSPPolicy").then((result) => {
      if (result.generatedCSPPolicy) {
        setCspPolicies(result.generatedCSPPolicy as GeneratedCSPByDomain);
      }
    });
  }, []);

  // Save helpers
  const saveDetection = useCallback(async (config: DetectionConfig) => {
    setDetectionConfig(config);
    try {
      await sendMessage({ type: "SET_DETECTION_CONFIG", data: config });
    } catch (error) {
      logger.error("Failed to save detection config", error);
    }
  }, []);

  const saveCsp = useCallback(async (config: CSPConfig) => {
    setCspConfig(config);
    try {
      await sendMessage({ type: "SET_CSP_CONFIG", data: config });
    } catch (error) {
      logger.error("Failed to save CSP config", error);
    }
  }, []);

  const saveDoh = useCallback(async (config: DoHMonitorConfig) => {
    setDohConfig(config);
    try {
      await sendMessage({ type: "SET_DOH_MONITOR_CONFIG", data: config });
    } catch (error) {
      logger.error("Failed to save DoH config", error);
    }
  }, []);

  const saveNetwork = useCallback(async (config: NetworkMonitorConfig) => {
    setNetworkConfig(config);
    try {
      await sendMessage({ type: "SET_NETWORK_MONITOR_CONFIG", data: config });
    } catch (error) {
      logger.error("Failed to save network config", error);
    }
  }, []);

  // Detection count
  const detectionKeys: (keyof DetectionConfig)[] = [
    "enableNRD",
    "enableTyposquat",
    "enableAI",
    "enablePrivacy",
    "enableTos",
    "enableLogin",
  ];
  const detectionEnabledCount = detectionKeys.filter((k) => detectionConfig[k]).length;

  // CSP count
  const cspKeys: (keyof CSPConfig)[] = ["enabled", "collectCSPViolations", "collectNetworkRequests"];
  const cspEnabledCount = cspKeys.filter((k) => cspConfig[k]).length;

  // DoH action labels
  const dohActionLabels: Record<DoHAction, string> = {
    detect: "検出のみ",
    alert: "通知",
    block: "ブロック",
  };

  // Network count
  const networkKeys: (keyof NetworkMonitorConfig)[] = ["enabled", "captureAllRequests", "excludeOwnExtension"];
  const networkEnabledCount = networkKeys.filter((k) => networkConfig[k]).length;

  const isLocked = enterpriseStatus?.settingsLocked ?? false;

  const togglePolicyExpand = (domain: string) => {
    setExpandedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      logger.error("Failed to copy to clipboard", error);
    }
  };

  const regenerateCSP = async () => {
    try {
      const result = await sendMessage<GeneratedCSPByDomain>({ type: "REGENERATE_CSP_POLICY" });
      setCspPolicies(result);
    } catch (error) {
      logger.error("Failed to regenerate CSP policy", error);
    }
  };

  return (
    <div
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      {/* 1. 検出設定 */}
      <Section
        title="検出設定"
        headerRight={
          <Badge variant="info" size="sm">
            {detectionEnabledCount}/{detectionKeys.length}
          </Badge>
        }
        expanded={expanded.detection}
        onToggle={() => toggle("detection")}
        borderColor="transparent"
      >
        {isLocked ? (
          <LockedBanner colors={colors} />
        ) : (
          <div style={styles.grid2}>
            {(
              [
                { key: "enableNRD", title: "NRD", desc: "新規登録ドメイン検出" },
                { key: "enableTyposquat", title: "Typosquat", desc: "偽装ドメイン検出" },
                { key: "enableAI", title: "AI", desc: "AIプロンプト監視" },
                { key: "enablePrivacy", title: "Privacy", desc: "プライバシーポリシー検出" },
                { key: "enableTos", title: "ToS", desc: "利用規約検出" },
                { key: "enableLogin", title: "Login", desc: "ログインページ検出" },
              ] as const
            ).map(({ key, title, desc }) => (
              <label key={key} style={styles.option(colors)}>
                <input
                  type="checkbox"
                  checked={detectionConfig[key]}
                  onChange={() =>
                    saveDetection({ ...detectionConfig, [key]: !detectionConfig[key] })
                  }
                  style={styles.checkbox}
                />
                <div style={styles.label}>
                  <span style={{ ...styles.labelTitle, color: colors.textPrimary }}>{title}</span>
                  <span style={{ ...styles.labelDesc, color: colors.textSecondary }}>{desc}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </Section>

      {/* 2. CSP設定 */}
      <Section
        title="CSP設定"
        headerRight={
          <Badge variant="info" size="sm">
            {cspEnabledCount}/{cspKeys.length}
          </Badge>
        }
        expanded={expanded.csp}
        onToggle={() => toggle("csp")}
        borderColor={colors.border}
      >
        <div style={styles.grid3}>
          {(
            [
              { key: "enabled", title: "CSP監査", desc: "CSP違反を監査" },
              { key: "collectCSPViolations", title: "違反収集", desc: "CSP違反を収集" },
              { key: "collectNetworkRequests", title: "リクエスト", desc: "ネットワークリクエスト収集" },
            ] as const
          ).map(({ key, title, desc }) => (
            <label key={key} style={styles.option(colors)}>
              <input
                type="checkbox"
                checked={cspConfig[key]}
                onChange={() => saveCsp({ ...cspConfig, [key]: !cspConfig[key] })}
                style={styles.checkbox}
              />
              <div style={styles.label}>
                <span style={{ ...styles.labelTitle, color: colors.textPrimary }}>{title}</span>
                <span style={{ ...styles.labelDesc, color: colors.textSecondary }}>{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* 3. DoH監視 */}
      <Section
        title="DoH監視"
        headerRight={
          <Badge variant="info" size="sm">
            {dohActionLabels[dohConfig.action]}
          </Badge>
        }
        expanded={expanded.doh}
        onToggle={() => toggle("doh")}
        borderColor={colors.border}
      >
        <div style={styles.grid3}>
          {(
            [
              { action: "detect" as DoHAction, title: "検出のみ", desc: "通知なし" },
              { action: "alert" as DoHAction, title: "通知", desc: "検出時に通知" },
              { action: "block" as DoHAction, title: "ブロック", desc: "DoH通信をブロック" },
            ] as const
          ).map(({ action, title, desc }) => (
            <label key={action} style={styles.option(colors)}>
              <input
                type="radio"
                name="doh-action"
                checked={dohConfig.action === action}
                onChange={() => saveDoh({ ...dohConfig, action })}
                style={styles.radio}
              />
              <div style={styles.label}>
                <span style={{ ...styles.labelTitle, color: colors.textPrimary }}>{title}</span>
                <span style={{ ...styles.labelDesc, color: colors.textSecondary }}>{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* 4. Network Monitor */}
      <Section
        title="Network Monitor"
        headerRight={
          <Badge variant="info" size="sm">
            {networkEnabledCount}/{networkKeys.length}
          </Badge>
        }
        expanded={expanded.network}
        onToggle={() => toggle("network")}
        borderColor={colors.border}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(
            [
              { key: "enabled", title: "ネットワーク監視", desc: "全リクエストを監視" },
              { key: "captureAllRequests", title: "全リクエスト", desc: "拡張機能以外も記録" },
              { key: "excludeOwnExtension", title: "自身を除外", desc: "Pleno Auditを除外" },
            ] as const
          ).map(({ key, title, desc }) => (
            <label key={key} style={styles.option(colors)}>
              <input
                type="checkbox"
                checked={networkConfig[key]}
                onChange={() =>
                  saveNetwork({ ...networkConfig, [key]: !networkConfig[key] })
                }
                style={styles.checkbox}
              />
              <div style={styles.label}>
                <span style={{ ...styles.labelTitle, color: colors.textPrimary }}>{title}</span>
                <span style={{ ...styles.labelDesc, color: colors.textSecondary }}>{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* 5. エンタープライズポリシー */}
      <Section
        title="エンタープライズポリシー"
        headerRight={
          enterpriseStatus?.isManaged ? (
            <Badge variant="warning" size="sm">管理対象</Badge>
          ) : (
            <Badge variant="success" size="sm">未管理</Badge>
          )
        }
        expanded={expanded.enterprise}
        onToggle={() => toggle("enterprise")}
        borderColor={colors.border}
      >
        {enterpriseStatus ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={styles.infoRow(colors)}>
              <span style={{ color: colors.textSecondary }}>管理状態</span>
              <Badge variant={enterpriseStatus.isManaged ? "warning" : "success"} size="sm">
                {enterpriseStatus.isManaged ? "管理対象" : "未管理"}
              </Badge>
            </div>
            <div style={styles.infoRow(colors)}>
              <span style={{ color: colors.textSecondary }}>SSO必須</span>
              <Badge variant={enterpriseStatus.ssoRequired ? "danger" : "info"} size="sm">
                {enterpriseStatus.ssoRequired ? "必須" : "不要"}
              </Badge>
            </div>
            <div style={styles.infoRow(colors)}>
              <span style={{ color: colors.textSecondary }}>設定ロック</span>
              <Badge variant={enterpriseStatus.settingsLocked ? "danger" : "success"} size="sm">
                {enterpriseStatus.settingsLocked ? "ロック中" : "解除"}
              </Badge>
            </div>
            {enterpriseStatus.isManaged && enterpriseStatus.config && (
              <>
                {enterpriseStatus.config.policy?.allowedDomains &&
                  enterpriseStatus.config.policy.allowedDomains.length > 0 && (
                    <div style={styles.infoRow(colors)}>
                      <span style={{ color: colors.textSecondary }}>許可ドメイン</span>
                      <span style={{ fontSize: "11px", color: colors.textPrimary }}>
                        {enterpriseStatus.config.policy.allowedDomains.join(", ")}
                      </span>
                    </div>
                  )}
              </>
            )}
          </div>
        ) : (
          <div style={{ color: colors.textMuted, fontSize: "12px", padding: "8px 0" }}>
            読み込み中...
          </div>
        )}
      </Section>

      {/* 6. CSPポリシー */}
      {cspPolicies && cspPolicies.policies.length > 0 && (
        <Section
          title="CSPポリシー"
          headerRight={
            <Badge variant="info" size="sm">
              {cspPolicies.totalDomains} ドメイン
            </Badge>
          }
          expanded={expanded.cspPolicy}
          onToggle={() => toggle("cspPolicy")}
          borderColor={colors.border}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <Button variant="secondary" size="sm" onClick={regenerateCSP}>
                再生成
              </Button>
            </div>
            {cspPolicies.policies.map((domainPolicy: DomainCSPPolicy) => {
              const isExpanded = expandedPolicies.has(domainPolicy.domain);
              return (
                <div
                  key={domainPolicy.domain}
                  style={{
                    background: colors.bgSecondary,
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                    onClick={() => togglePolicyExpand(domainPolicy.domain)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={styles.chevron(isExpanded)}>▶</span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: colors.textPrimary,
                        }}
                      >
                        {domainPolicy.domain}
                      </span>
                      <Badge variant="info" size="sm">
                        {domainPolicy.reportCount} レポート
                      </Badge>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        copyToClipboard(domainPolicy.policy.policyString);
                      }}
                    >
                      コピー
                    </Button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "0 10px 10px" }}>
                      <pre style={styles.codeBlock(colors)}>
                        {domainPolicy.policy.policyString}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
