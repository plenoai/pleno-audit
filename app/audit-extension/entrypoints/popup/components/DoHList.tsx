import type { DoHRequestRecord } from "@libztbs/extension-runtime";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface Props {
  requests: DoHRequestRecord[];
}

export function DoHList({ requests }: Props) {
  const styles = usePopupStyles();
  const { colors } = useTheme();

  if (requests.length === 0) {
    return null;
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>DoH通信 ({requests.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>時間</th>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>検出方法</th>
              <th style={styles.tableHeader}>状態</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 100).map((r) => (
              <tr key={r.id} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: colors.textSecondary }}>
                    {formatTime(r.timestamp)}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <code style={styles.code}>{r.domain}</code>
                </td>
                <td style={styles.tableCell}>
                  <Badge variant="info">{formatMethod(r.detectionMethod)}</Badge>
                </td>
                <td style={styles.tableCell}>
                  <Badge variant={r.blocked ? "danger" : "warning"}>
                    {r.blocked ? "blocked" : "detected"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ja-JP");
}

function formatMethod(method: string): string {
  switch (method) {
    case "content-type":
      return "Content-Type";
    case "accept-header":
      return "Accept";
    case "url-path":
      return "URL Path";
    case "dns-param":
      return "DNS Param";
    default:
      return method;
  }
}
