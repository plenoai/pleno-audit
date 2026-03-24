import { useTheme } from "../lib/theme";

interface SidebarTab {
  id: string;
  label: string;
}

interface SidebarProps {
  tabs: SidebarTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Sidebar({ tabs, activeTab, onChange }: SidebarProps) {
  const { colors } = useTheme();

  return (
    <nav
      style={{
        width: "180px",
        minWidth: "180px",
        background: colors.bgPrimary,
        borderRight: `1px solid ${colors.border}`,
        padding: "48px 0 16px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: isActive ? colors.bgSecondary : "transparent",
              color: isActive ? colors.textPrimary : colors.textSecondary,
              fontSize: "13px",
              fontWeight: isActive ? 500 : 400,
              textAlign: "left",
              cursor: "pointer",
              borderLeft: isActive ? `2px solid ${colors.interactive}` : "2px solid transparent",
              transition: "all 0.15s ease",
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
          </button>
        );
      })}
    </nav>
  );
}
