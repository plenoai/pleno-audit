import type { ComponentChildren } from "preact";
import { useTheme, spacing, fontSize } from "../lib/theme";

interface PageHeaderProps {
  title: string;
  /** 小見出し (UPPERCASE) */
  kicker?: string;
  /** 説明文 */
  sub?: string;
  /** 右側のアクション */
  actions?: ComponentChildren;
}

export function PageHeader({ title, kicker, sub, actions }: PageHeaderProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: spacing.lg,
        padding: "18px 24px 14px",
        background: colors.bgPrimary,
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" }}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            {title}
          </h2>
          {kicker && (
            <span
              style={{
                fontSize: "10px",
                color: colors.textMuted,
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "2px 6px",
                border: `1px solid ${colors.border}`,
                borderRadius: "4px",
              }}
            >
              {kicker}
            </span>
          )}
        </div>
        {sub && (
          <div
            style={{
              fontSize: fontSize.sm,
              color: colors.textMuted,
              marginTop: "4px",
              maxWidth: "60ch",
              lineHeight: 1.5,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
