/**
 * Theme system — CSS variable based (aligned with website)
 * CSS variables are defined in dashboard/index.html
 */

import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderLight: string;
  interactive: string;
  interactiveHover: string;
  scrollbar: {
    track: string;
    thumb: string;
    thumbHover: string;
  };
  status: {
    default: { bg: string; text: string; border: string };
    success: { bg: string; text: string; border: string };
    warning: { bg: string; text: string; border: string };
    danger: { bg: string; text: string; border: string };
    info: { bg: string; text: string; border: string };
  };
  dot: {
    default: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

/** CSS変数参照による単一カラーオブジェクト — light/darkはCSSが切り替える */
export const themeColors: ThemeColors = {
  bgPrimary: "var(--background)",
  bgSecondary: "var(--secondary)",
  bgTertiary: "var(--tertiary)",
  textPrimary: "var(--foreground)",
  textSecondary: "var(--muted-foreground)",
  textMuted: "var(--muted)",
  textInverse: "var(--primary-foreground)",
  border: "var(--border)",
  borderLight: "var(--border-light)",
  interactive: "var(--primary)",
  interactiveHover: "var(--muted-foreground)",
  scrollbar: {
    track: "var(--scrollbar-track)",
    thumb: "var(--scrollbar-thumb)",
    thumbHover: "var(--scrollbar-thumb-hover)",
  },
  status: {
    default: {
      bg: "var(--tertiary)",
      text: "var(--muted-foreground)",
      border: "var(--border)",
    },
    success: {
      bg: "var(--success-bg)",
      text: "var(--success-foreground)",
      border: "var(--success-border)",
    },
    warning: {
      bg: "var(--warning-bg)",
      text: "var(--warning-foreground)",
      border: "var(--warning-border)",
    },
    danger: {
      bg: "var(--danger-bg)",
      text: "var(--danger-foreground)",
      border: "var(--danger-border)",
    },
    info: {
      bg: "var(--info-bg)",
      text: "var(--info-foreground)",
      border: "var(--info-border)",
    },
  },
  dot: {
    default: "var(--muted-foreground)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
  },
};

/** @deprecated 互換性のため残存。themeColorsを使用してください */
export const lightColors = themeColors;
/** @deprecated 互換性のため残存。themeColorsを使用してください */
export const darkColors = themeColors;

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const defaultContext: ThemeContextValue = {
  mode: "system",
  isDark: false,
  colors: themeColors,
  setMode: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultContext);

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeState(): ThemeContextValue {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["themeMode"]).then((result) => {
      if (result.themeMode) {
        setModeState(result.themeMode);
      }
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    chrome.storage.local.set({ themeMode: newMode });
  };

  const isDark = mode === "dark" || (mode === "system" && systemDark);

  // .dark クラスでCSS変数を切り替え
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return { mode, isDark, colors: themeColors, setMode };
}

/** スペーシングスケール */
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
} as const;

/** フォントサイズスケール */
export const fontSize = {
  xs: "10px",
  sm: "11px",
  md: "12px",
  base: "13px",
  lg: "14px",
  xl: "16px",
  xxl: "20px",
  display: "32px",
} as const;

/** グリッド設定 */
export const grid = {
  statsMinWidth: "140px",
  cardMinWidth: "280px",
} as const;

/** ボーダー半径 */
export const borderRadius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
} as const;

/** Severity色を取得 */
export function getSeverityColor(
  severity: string,
  colors: ThemeColors,
): string {
  switch (severity) {
    case "critical":
      return colors.dot.danger;
    case "high":
      return colors.dot.warning;
    case "medium":
      return colors.dot.info;
    case "low":
      return colors.dot.success;
    default:
      return colors.dot.default;
  }
}
