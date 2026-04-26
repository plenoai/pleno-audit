import { Sun, Moon, Monitor } from "lucide-preact";
import { SettingsMenu } from "../../../components";
import { useTheme, type ThemeMode } from "../../../lib/theme";
import type { DashboardStyles } from "../styles";

interface DashboardHeaderProps {
  styles: DashboardStyles;
  onClearData: () => void;
  onExport: () => void;
  onImport: () => Promise<{ success: boolean; message: string }>;
}

const MODE_ICON: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const MODE_LABEL: Record<ThemeMode, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export function DashboardHeader({
  styles: _styles,
  onClearData,
  onExport,
  onImport,
}: DashboardHeaderProps) {
  const { colors, mode, setMode } = useTheme();
  const modes: ThemeMode[] = ["light", "dark", "system"];
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
  const ThemeIcon = MODE_ICON[mode];

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: colors.bgPrimary,
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
        height: "52px",
        whiteSpace: "nowrap",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "5px",
            background: colors.interactive,
            color: colors.textInverse,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 500,
            fontSize: "13px",
          }}
        >
          P
        </span>
        <span style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.01em", color: colors.textPrimary }}>
          Pleno
        </span>
        <span
          style={{
            fontSize: "10px",
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "monospace",
            padding: "2px 6px",
            border: `1px solid ${colors.border}`,
            borderRadius: "4px",
            marginLeft: "4px",
          }}
        >
          ZTBS Audit
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setMode(nextMode)}
          title={`テーマ: ${MODE_LABEL[mode]} → ${MODE_LABEL[nextMode]}`}
          style={{
            width: "28px",
            height: "28px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "6px",
            cursor: "pointer",
            color: colors.textMuted,
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.bgTertiary;
            e.currentTarget.style.borderColor = colors.border;
            e.currentTarget.style.color = colors.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
            e.currentTarget.style.color = colors.textMuted;
          }}
        >
          <ThemeIcon size={15} />
        </button>

        <SettingsMenu onClearData={onClearData} onExport={onExport} onImport={onImport} />
      </div>
    </header>
  );
}
