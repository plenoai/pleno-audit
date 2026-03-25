import { useState, useRef, useEffect } from "preact/hooks";
import { useTheme } from "../lib/theme";

interface Props {
  onReportFP: () => void;
  onDismiss: () => void;
}

export function AlertRowMenu({ onReportFP, onDismiss }: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        className="hover-bg"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textMuted,
          fontSize: "14px",
        }}
        title="アクション"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "2px",
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "180px",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <button
            className="hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onReportFP();
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: colors.textPrimary,
              borderRadius: 0,
              textAlign: "left",
              borderBottom: `1px solid ${colors.borderLight}`,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            誤検知を報告 (GitHub Issue)
          </button>
          <button
            className="hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDismiss();
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: colors.textMuted,
              borderRadius: 0,
              textAlign: "left",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            同等のアラートを無視
          </button>
        </div>
      )}
    </div>
  );
}
