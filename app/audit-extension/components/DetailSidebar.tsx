import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";
import { useAnimationEnabled } from "../lib/motion";

interface DetailSidebarProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  /** 再マウント時のスライドイン用キー（アラートID等） */
  animationKey?: string;
}

export function DetailSidebar({ title, onClose, children, footer, animationKey }: DetailSidebarProps) {
  const { colors } = useTheme();
  const animationEnabled = useAnimationEnabled();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el || !animationEnabled) return;
    el.style.transform = "translateX(100%)";
    el.style.opacity = "0";
    requestAnimationFrame(() => {
      el.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
    });
  }, [animationKey, animationEnabled]);

  return (
    <div
      ref={sidebarRef}
      style={{
        width: "420px",
        minWidth: "420px",
        height: "100%",
        marginLeft: "auto",
        background: colors.bgPrimary,
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing.md} ${spacing.lg}`,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: fontSize.lg, fontWeight: 600, color: colors.textPrimary }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "20px",
            color: colors.textMuted,
            padding: spacing.xs,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: spacing.lg }}>
        {children}
      </div>

      {footer && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            gap: spacing.sm,
            padding: `${spacing.md} ${spacing.lg}`,
            borderTop: `1px solid ${colors.border}`,
            background: colors.bgPrimary,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/* ---- DetailSection: enterprise の card-hd + card-body 等価 ---- */

interface DetailSectionProps {
  title: string;
  meta?: string;
  children: ComponentChildren;
}

export function DetailSection({ title, meta, children }: DetailSectionProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
      }}
    >
      <div
        style={{
          padding: `${spacing.sm} ${spacing.md}`,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <span style={{ fontSize: fontSize.md, fontWeight: 500, color: colors.textPrimary }}>
          {title}
        </span>
        {meta && (
          <span
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <div style={{ padding: spacing.md }}>{children}</div>
    </div>
  );
}

/* ---- KeyValueGrid: enterprise の monospace meta block と同等 ---- */

interface KeyValueGridProps {
  entries: [string, ComponentChildren][];
}

export function KeyValueGrid({ entries }: KeyValueGridProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "6px 12px",
        fontSize: fontSize.sm,
        fontFamily: "monospace",
      }}
    >
      {entries.map(([key, value]) => (
        <>
          <span key={`${key}-k`} style={{ color: colors.textMuted }}>{key}:</span>
          <span key={`${key}-v`} style={{ color: colors.textPrimary, wordBreak: "break-all" }}>
            {value}
          </span>
        </>
      ))}
    </div>
  );
}
