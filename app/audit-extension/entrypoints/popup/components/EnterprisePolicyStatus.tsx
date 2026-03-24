import { useState, useEffect } from "preact/hooks";
import { Lock } from "lucide-preact";
import type { EnterpriseStatus } from "@libztbs/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../../../components";
import { sendMessage } from "../utils/messaging";

const DEFAULT_ENTERPRISE_STATUS: EnterpriseStatus = {
  isManaged: false,
  ssoRequired: false,
  settingsLocked: false,
  config: null,
};

export function EnterprisePolicyStatus() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<EnterpriseStatus>(DEFAULT_ENTERPRISE_STATUS);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    sendMessage<EnterpriseStatus>({ type: "GET_ENTERPRISE_STATUS" })
      .then(setStatus)
      .catch(() => setStatus(DEFAULT_ENTERPRISE_STATUS));
  }, []);

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
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    chevron: {
      fontSize: "10px",
      color: colors.textSecondary,
      transition: "transform 0.2s",
      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    },
    content: {
      marginTop: "8px",
      padding: "12px",
      background: colors.bgSecondary,
      borderRadius: "6px",
      border: `1px solid ${colors.border}`,
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      fontSize: "12px",
    },
    label: {
      color: colors.textSecondary,
    },
    value: {
      color: colors.textPrimary,
    },
  };

  const statusBadge = status.isManaged ? (
    <Badge variant="info" size="sm">管理下</Badge>
  ) : (
    <Badge size="sm">個人</Badge>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          エンタープライズポリシー
          {statusBadge}
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          <div style={styles.row}>
            <span style={styles.label}>管理状態</span>
            <span style={styles.value}>
              {status.isManaged ? "組織管理下" : "個人利用"}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>SSO必須</span>
            <span style={styles.value}>
              {status.ssoRequired ? (
                <Badge variant="warning" size="sm">必須</Badge>
              ) : (
                <Badge size="sm">任意</Badge>
              )}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>設定ロック</span>
            <span style={styles.value}>
              {status.settingsLocked ? (
                <Badge variant="danger" size="sm"><Lock size={10} /> ロック</Badge>
              ) : (
                <Badge variant="success" size="sm">解除</Badge>
              )}
            </span>
          </div>
          {status.config && (
            <>
              <div style={{ ...styles.row, borderTop: `1px solid ${colors.borderLight}`, marginTop: "8px", paddingTop: "12px" }}>
                <span style={styles.label}>組織名</span>
                <span style={styles.value}>{status.config.organizationName || "-"}</span>
              </div>
              {status.config.allowedDomains && status.config.allowedDomains.length > 0 && (
                <div style={{ ...styles.row, flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <span style={styles.label}>許可ドメイン</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {status.config.allowedDomains.slice(0, 5).map((d: string) => (
                      <Badge key={d} size="sm">{d}</Badge>
                    ))}
                    {status.config.allowedDomains.length > 5 && (
                      <Badge size="sm">+{status.config.allowedDomains.length - 5}</Badge>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
