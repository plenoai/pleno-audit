import type { CSSProperties } from "preact/compat";
import { useTheme } from "../lib/theme";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "検索... (/)" }: SearchInputProps) {
  const { colors } = useTheme();

  const style: CSSProperties = {
    padding: "8px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: "6px",
    fontSize: "13px",
    minWidth: "240px",
    outline: "none",
    transition: "border-color 0.15s",
    background: colors.bgPrimary,
    color: colors.textPrimary,
  };

  return (
    <input
      type="text"
      data-dashboard-search="true"
      style={style}
      placeholder={placeholder}
      value={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = colors.interactive)}
      onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = colors.border)}
    />
  );
}
