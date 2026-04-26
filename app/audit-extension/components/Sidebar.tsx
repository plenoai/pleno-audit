import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { LucideProps } from "lucide-preact";
import { useTheme } from "../lib/theme";
import { useAnimationEnabled } from "../lib/motion";
import { Badge } from "./Badge";

interface SidebarTab {
  id: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  /** セクション見出し (この項目の上に挿入される) */
  section?: string;
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
    const btn = nav.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
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
        padding: "12px 0",
        display: "flex",
        flexDirection: "column",
        gap: "1px",
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
        const Icon = tab.icon;
        return (
          <span key={tab.id} style={{ display: "contents" }}>
            {tab.section && (
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: colors.textMuted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "10px 18px 4px",
                }}
              >
                {tab.section}
              </div>
            )}
            <button
              type="button"
              data-tab={tab.id}
              onClick={() => onChange(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "7px 18px",
                border: "none",
                background: isActive ? colors.bgSecondary : "transparent",
                color: isActive ? colors.textPrimary : colors.textSecondary,
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
                transition: animationEnabled ? "background 0.2s ease, color 0.2s ease" : "none",
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
              {Icon && (
                <Icon
                  size={14}
                  strokeWidth={1.75}
                  color={colors.textMuted}
                  style={{ flexShrink: 0 }}
                />
              )}
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.id === "alerts" && alertBadge && alertBadge.count > 0 && (
                <Badge variant={alertBadge.variant} size="sm">
                  {alertBadge.count}
                </Badge>
              )}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
