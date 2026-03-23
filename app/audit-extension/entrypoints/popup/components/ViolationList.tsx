import { useState } from "preact/hooks";
import type { CSPViolation } from "@libztbs/csp";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";
import type { ViolationProps } from "../types";

export function ViolationList({ violations }: ViolationProps) {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (violations.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>CSP違反はまだ検出されていません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP違反 ({violations.length > 20000 ? "20000+" : violations.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {violations.slice(0, 20000).map((v, i) => {
          const id = `${v.timestamp}-${i}`;
          return (
            <ViolationCard
              key={id}
              violation={v}
              expanded={expandedId === id}
              onToggle={() => setExpandedId(expandedId === id ? null : id)}
              styles={styles}
              colors={colors}
            />
          );
        })}
      </div>
    </div>
  );
}

function ViolationCard({
  violation,
  expanded,
  onToggle,
  styles,
  colors,
}: {
  violation: CSPViolation;
  expanded: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof usePopupStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const time = formatTime(violation.timestamp);

  return (
    <div style={styles.card}>
      <div
        onClick={onToggle}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: colors.textSecondary }}>
          {time}
        </span>
        <Badge variant={["script-src", "default-src"].includes(violation.directive) ? "danger" : "default"}>
          {violation.directive}
        </Badge>
        <code
          style={{ ...styles.code, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={violation.blockedURL}
        >
          {truncateUrl(violation.blockedURL, 25)}
        </code>
        <span style={{ fontSize: "10px", color: colors.textMuted }}>
          {expanded ? "▼" : "▶"}
        </span>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: "12px",
          }}
        >
          <DetailRow label="ブロックURL" colors={colors}>
            <code style={{ ...styles.code, wordBreak: "break-all" }}>
              {violation.blockedURL}
            </code>
          </DetailRow>

          {violation.sourceFile && (
            <DetailRow label="ソース" colors={colors}>
              <a
                href={violation.sourceFile}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  ...styles.code,
                  color: colors.linkColor || "#3b82f6",
                  textDecoration: "underline",
                  cursor: "pointer",
                  wordBreak: "break-all",
                }}
              >
                {violation.sourceFile}
                {violation.lineNumber != null && `:${violation.lineNumber}`}
                {violation.columnNumber != null && `:${violation.columnNumber}`}
              </a>
            </DetailRow>
          )}

          <DetailRow label="ページ" colors={colors}>
            <code style={{ ...styles.code, wordBreak: "break-all" }}>
              {violation.pageUrl}
            </code>
          </DetailRow>

          <DetailRow label="アクション" colors={colors}>
            <Badge variant={violation.disposition === "enforce" ? "danger" : "warning"}>
              {violation.disposition === "enforce" ? "ブロック" : "レポートのみ"}
            </Badge>
          </DetailRow>

          {violation.originalPolicy && (
            <DetailRow label="ポリシー" colors={colors}>
              <pre
                style={{
                  backgroundColor: colors.bgSecondary,
                  padding: "8px",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: "100px",
                  overflow: "auto",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  margin: "4px 0 0",
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}
              >
                {violation.originalPolicy}
              </pre>
            </DetailRow>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  children,
  colors,
}: {
  label: string;
  children: preact.ComponentChildren;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong style={{ color: colors.textSecondary, fontSize: "11px" }}>{label}: </strong>
      {children}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("ja-JP");
}

function truncateUrl(url: string, maxLen: number): string {
  return url.length > maxLen ? url.substring(0, maxLen) + "…" : url;
}
