import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import type { AlertSeverity, DismissReason } from "libztbs/alerts";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";
import { DISMISS_REASON_OPTIONS } from "../lib/dismiss-reasons";
import { Badge } from "./Badge";

interface Props {
  onReportBug: () => void;
  dismissTarget: {
    id: string;
    title: string;
    domain: string;
    severity: AlertSeverity;
  };
  onDismissConfirm: (reason: DismissReason, comment: string) => void;
}

export function AlertRowMenu({
  onReportBug,
  dismissTarget,
  onDismissConfirm,
}: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<DismissReason>("false_positive");
  const [comment, setComment] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const trimmedComment = useMemo(() => comment.trim(), [comment]);

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

  useEffect(() => {
    if (!isOpen) return;
    setReason("false_positive");
    setComment("");
  }, [isOpen, dismissTarget.id]);

  return (
    <div
      ref={menuRef}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        className="hover-bg"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
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
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.lg,
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
            width: "340px",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <button
            className="hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onReportBug();
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
            バグを報告 (GitHub Issue)
          </button>

          <div
            style={{
              padding: spacing.md,
              borderTop: `1px solid ${colors.borderLight}`,
            }}
          >
            <div
              style={{
                marginBottom: spacing.sm,
                color: colors.textPrimary,
                fontSize: fontSize.md,
                fontWeight: 600,
              }}
            >
              Dismiss
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                minWidth: 0,
                marginBottom: spacing.md,
                padding: spacing.sm,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.md,
              }}
            >
              <Badge
                variant={
                  dismissTarget.severity === "critical" || dismissTarget.severity === "high"
                    ? "danger"
                    : dismissTarget.severity === "medium"
                      ? "warning"
                      : "info"
                }
                size="sm"
              >
                {dismissTarget.severity}
              </Badge>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: colors.textPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dismissTarget.title}
                </div>
                <div
                  style={{
                    color: colors.textMuted,
                    fontSize: fontSize.xs,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dismissTarget.domain}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: spacing.md }}>
              {DISMISS_REASON_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: spacing.sm,
                    padding: `${spacing.xs} ${spacing.sm}`,
                    marginBottom: "2px",
                    borderRadius: borderRadius.md,
                    cursor: "pointer",
                    background: reason === option.value ? colors.bgSecondary : "transparent",
                    border: `1px solid ${reason === option.value ? colors.border : "transparent"}`,
                  }}
                >
                  <input
                    type="radio"
                    name={`dismiss-reason-${dismissTarget.id}`}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    style={{ marginTop: "2px", accentColor: colors.interactive }}
                  />
                  <div>
                    <div
                      style={{
                        color: colors.textPrimary,
                        fontSize: fontSize.sm,
                        fontWeight: 500,
                      }}
                    >
                      {option.label}
                    </div>
                    <div
                      style={{
                        color: colors.textMuted,
                        fontSize: fontSize.xs,
                        lineHeight: 1.4,
                      }}
                    >
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <textarea
                value={comment}
                onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
                placeholder="理由を入力..."
                style={{
                  width: "100%",
                  minHeight: "72px",
                  padding: spacing.sm,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  fontSize: fontSize.sm,
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.md,
                  background: "transparent",
                  color: colors.textSecondary,
                  fontSize: fontSize.sm,
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismissConfirm(reason, trimmedComment);
                  setIsOpen(false);
                }}
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  border: "none",
                  borderRadius: borderRadius.md,
                  background: colors.interactive,
                  color: "#fff",
                  fontSize: fontSize.sm,
                  cursor: "pointer",
                  fontWeight: 500,
                  opacity: 1,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
