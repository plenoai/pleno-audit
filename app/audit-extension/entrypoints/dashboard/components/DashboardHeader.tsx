import { Sun, Moon, Monitor, Search } from "lucide-preact";
import { SettingsMenu } from "../../../components";
import { useTheme, type ThemeMode } from "../../../lib/theme";
import type { DashboardStyles } from "../styles";

interface DashboardHeaderProps {
  styles: DashboardStyles;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
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
  searchQuery,
  onSearchChange,
  searchPlaceholder = "検索...",
  showSearch = true,
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

      {/* Search */}
      {showSearch ? (
        <HeaderSearch
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      ) : (
        <div style={{ flex: 1 }} />
      )}

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

function HeaderSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        flex: "1 1 auto",
        maxWidth: "420px",
        margin: "0 24px",
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        gridTemplateRows: "30px",
        alignItems: "center",
        columnGap: "8px",
        padding: "0 10px",
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: "6px",
        boxSizing: "border-box",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onFocusCapture={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = colors.interactive;
        el.style.background = colors.bgPrimary;
      }}
      onBlurCapture={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = colors.border;
        el.style.background = colors.bgSecondary;
      }}
    >
      <Search size={14} color={colors.textMuted} style={{ gridColumn: 1 }} />
      <input
        type="text"
        data-dashboard-search="true"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        style={{
          gridColumn: 2,
          alignSelf: "center",
          width: "100%",
          height: "28px",
          padding: 0,
          background: "transparent",
          border: 0,
          fontFamily: "inherit",
          fontSize: "12px",
          color: colors.textPrimary,
          outline: "none",
          lineHeight: "28px",
        }}
      />
      <span
        style={{
          gridColumn: 3,
          alignSelf: "center",
          fontFamily: "monospace",
          fontSize: "10px",
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
          padding: "1px 5px",
          borderRadius: "3px",
          background: colors.bgPrimary,
          lineHeight: 1.4,
        }}
      >
        /
      </span>
    </div>
  );
}
