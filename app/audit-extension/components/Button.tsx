import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  children: preact.ComponentChildren;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** 指定すると <a> として描画 (Button と同サイズ) */
  href?: string;
  /** href 用 */
  target?: string;
  rel?: string;
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  borderStyle: "solid",
  borderWidth: "1px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 500,
  fontFamily: "inherit",
  lineHeight: 1,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  transition: "all 0.15s",
};

function getVariantStyles(colors: ThemeColors): Record<ButtonVariant, CSSProperties> {
  return {
    primary: {
      background: colors.interactive,
      color: colors.textInverse,
      borderColor: colors.interactive,
    },
    secondary: {
      background: colors.bgPrimary,
      color: colors.textPrimary,
      borderColor: colors.border,
    },
    ghost: {
      background: "transparent",
      color: colors.textSecondary,
      borderColor: "transparent",
    },
  };
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    height: "28px",
    padding: "0 12px",
    fontSize: "12px",
  },
  md: {
    height: "32px",
    padding: "0 16px",
    fontSize: "13px",
  },
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  disabled = false,
  href,
  target,
  rel,
}: ButtonProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyles(colors);

  const style: CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...sizeStyles[size],
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
  };

  if (href) {
    return (
      <a href={href} target={target} rel={rel} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      style={style}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
