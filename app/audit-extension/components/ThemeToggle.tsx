import type { CSSProperties, FunctionComponent } from "preact/compat";
import { Sun, Moon, Monitor } from "lucide-preact";
import { useTheme, type ThemeMode } from "../lib/theme";

const styles: Record<string, CSSProperties> = {
  button: {
    width: "100%",
    padding: "8px 12px",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left" as const,
  },
};

const modeIcons: Record<ThemeMode, FunctionComponent<{ size: number }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const modeLabels: Record<ThemeMode, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();

  const modes: ThemeMode[] = ["light", "dark", "system"];
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
  const Icon = modeIcons[mode];

  return (
    <button
      className="hover-bg"
      style={{
        ...styles.button,
        background: "transparent",
        color: colors.textSecondary,
      }}
      onClick={() => setMode(nextMode)}
      title={`テーマ: ${modeLabels[mode]} → ${modeLabels[nextMode]}`}
    >
      <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
        <Icon size={14} />
      </span>
      {modeLabels[mode]}
    </button>
  );
}
