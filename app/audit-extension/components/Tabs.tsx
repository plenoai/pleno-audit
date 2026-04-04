import type { CSSProperties } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useTheme, type ThemeColors } from "../lib/theme";
import { useAnimationEnabled } from "../lib/motion";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

function getStyles(colors: ThemeColors): Record<string, CSSProperties> {
  return {
    container: {
      position: "relative",
      display: "flex",
      borderBottom: `1px solid ${colors.border}`,
      marginBottom: "24px",
    },
    tab: {
      padding: "12px 16px",
      border: "none",
      borderBottom: "2px solid transparent",
      background: "transparent",
      fontSize: "14px",
      color: colors.textSecondary,
      cursor: "pointer",
      transition: "color 0.2s ease",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    tabActive: {
      padding: "12px 16px",
      border: "none",
      borderBottom: "2px solid transparent",
      background: "transparent",
      fontSize: "14px",
      color: colors.textPrimary,
      fontWeight: 500,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    count: {
      background: colors.bgTertiary,
      color: colors.textSecondary,
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 500,
    },
    countActive: {
      background: colors.interactive,
      color: colors.textInverse,
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 500,
      transition: "background 0.2s ease",
    },
  };
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const { colors } = useTheme();
  const animationEnabled = useAnimationEnabled();
  const styles = getStyles(colors);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = tabs.findIndex((t) => t.id === activeTab);
    // +1 to skip the indicator div
    const btn = container.children[idx + 1] as HTMLElement | undefined;
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [activeTab, tabs]);

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Sliding underline indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "-1px",
          left: `${indicator.left}px`,
          width: `${indicator.width}px`,
          height: "2px",
          background: colors.interactive,
          borderRadius: "1px 1px 0 0",
          transition: animationEnabled ? "left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            style={isActive ? styles.tabActive : styles.tab}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={isActive ? styles.countActive : styles.count}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
