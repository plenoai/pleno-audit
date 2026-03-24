import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children?: preact.ComponentChildren;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  active?: boolean;
  onClick?: () => void;
}

function getVariantStyles(colors: ThemeColors): Record<BadgeVariant, CSSProperties> {
  return {
    default: {
      background: colors.status.default.bg,
      color: colors.status.default.text,
      border: `1px solid ${colors.status.default.border}`,
    },
    success: {
      background: colors.status.success.bg,
      color: colors.status.success.text,
      border: `1px solid ${colors.status.success.border}`,
    },
    warning: {
      background: colors.status.warning.bg,
      color: colors.status.warning.text,
      border: `1px solid ${colors.status.warning.border}`,
    },
    danger: {
      background: colors.status.danger.bg,
      color: colors.status.danger.text,
      border: `1px solid ${colors.status.danger.border}`,
    },
    info: {
      background: colors.status.info.bg,
      color: colors.status.info.text,
      border: `1px solid ${colors.status.info.border}`,
    },
  };
}

export function Badge({ children, variant = "default", size = "sm", dot = false, active, onClick }: BadgeProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyles(colors);

  if (dot) {
    return (
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: colors.dot[variant],
        }}
        title={typeof children === "string" ? children : undefined}
      />
    );
  }

  const sizeStyles = size === "sm"
    ? { padding: "0px 5px", fontSize: "9px", lineHeight: "1.4" }
    : { padding: "1px 6px", fontSize: "10px", lineHeight: "1.3" };

  const isClickable = onClick != null;
  const isActive = active ?? false;

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "middle",
    borderRadius: "9999px",
    fontWeight: 500,
    ...sizeStyles,
    ...(isActive ? variantStyles[variant] : isClickable ? variantStyles.default : variantStyles[variant]),
    ...(isClickable ? { cursor: "pointer", userSelect: "none" } : {}),
  };

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...style,
          background: isActive ? variantStyles[variant].background : variantStyles.default.background,
          color: isActive ? variantStyles[variant].color : variantStyles.default.color,
          border: isActive ? variantStyles[variant].border : variantStyles.default.border,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <span style={style}>
      {children}
    </span>
  );
}
