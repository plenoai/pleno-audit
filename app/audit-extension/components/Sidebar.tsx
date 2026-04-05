import { useEffect, useRef, useState } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { useAnimationEnabled } from "../lib/motion";
import { Badge } from "./Badge";

interface SidebarTab {
  id: string;
  label: string;
}

interface AlertBadge {
  count: number;
  variant: "danger" | "warning";
}

interface SidebarProps {
  tabs: SidebarTab[];
  activeTab: string;
  onChange: (id: string) => void;
  /** Badge shown next to the "alerts" tab when count > 0 */
  alertBadge?: AlertBadge | null;
}

export function Sidebar({ tabs, activeTab, onChange, alertBadge }: SidebarProps) {
  const { colors } = useTheme();
  const animationEnabled = useAnimationEnabled();
  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number }>({ top: 0, height: 0 });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const btn = nav.children[idx + 1] as HTMLElement | undefined; // +1 for indicator div
    if (btn) {
      setIndicatorStyle({ top: btn.offsetTop, height: btn.offsetHeight });
    }
  }, [activeTab, tabs]);

  return (
    <nav
      ref={navRef}
      style={{
        position: "relative",
        width: "240px",
        minWidth: "240px",
        background: colors.bgPrimary,
        borderRight: `1px solid ${colors.border}`,
        padding: "16px 0",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        overflowY: "auto",
      }}
    >
      {/* Sliding active indicator */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${indicatorStyle.top}px`,
          width: "2px",
          height: `${indicatorStyle.height}px`,
          background: colors.interactive,
          borderRadius: "0 1px 1px 0",
          transition: animationEnabled ? "top 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 22px",
              border: "none",
              background: isActive ? colors.bgSecondary : "transparent",
              color: isActive ? colors.textPrimary : colors.textSecondary,
              fontSize: "13px",
              fontWeight: isActive ? 500 : 400,
              textAlign: "left",
              cursor: "pointer",
              borderLeft: "2px solid transparent",
              transition: animationEnabled ? "background 0.2s ease, color 0.2s ease, font-weight 0.2s ease" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = colors.bgSecondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {tab.label}
            {tab.id === "alerts" && alertBadge && alertBadge.count > 0 && (
              <span style={{ marginLeft: "8px" }}>
                <Badge variant={alertBadge.variant} size="sm">
                  {alertBadge.count}
                </Badge>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
