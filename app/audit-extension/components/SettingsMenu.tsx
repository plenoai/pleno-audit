import { useState, useRef, useEffect } from "preact/hooks";
import { Settings } from "lucide-preact";
import { useTheme } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onClearData: () => void;
  onExport?: () => void;
  onImport?: () => Promise<{ success: boolean; message: string }>;
}

export function SettingsMenu({ onClearData, onExport, onImport }: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        className="hover-bg"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textSecondary,
          fontSize: "16px",
        }}
        title="メニュー"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "160px",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
            <ThemeToggle />
          </div>

          {onExport && (
            <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
              <button
                className="hover-bg"
                onClick={() => { setIsOpen(false); onExport(); }}
                style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.textPrimary, borderRadius: "4px", textAlign: "left" }}
              >
                <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                エクスポート
              </button>
            </div>
          )}

          {onImport && (
            <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
              <button
                className="hover-bg"
                onClick={async () => {
                  setIsOpen(false);
                  await onImport();
                }}
                style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.textPrimary, borderRadius: "4px", textAlign: "left" }}
              >
                <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                インポート
              </button>
            </div>
          )}

          <div style={{ padding: "4px" }}>
            <button
              className="hover-bg"
              onClick={() => { setIsOpen(false); onClearData(); }}
              style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.status.danger.text, borderRadius: "4px", textAlign: "left" }}
            >
              <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              データを削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
