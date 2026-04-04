import { useEffect, useMemo, useState } from "preact/hooks";
import type { AlertSeverity, DismissReason } from "libztbs/alerts";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";
import { DISMISS_REASON_OPTIONS } from "../lib/dismiss-reasons";
import { Badge } from "./Badge";

export interface DismissTargetPreview {
  id: string;
  title: string;
  domain: string;
  severity: AlertSeverity;
}

interface Props {
  alerts: DismissTargetPreview[];
  onConfirm: (reason: DismissReason, comment: string) => void;
  onCancel: () => void;
}

export function DismissComposer({ alerts, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<DismissReason>("false_positive");
  const [comment, setComment] = useState("");
  const trimmedComment = useMemo(() => comment.trim(), [comment]);
  const previewAlerts = alerts.slice(0, 3);

  useEffect(() => {
    setReason("false_positive");
    setComment("");
  }, [alerts]);

  return (
    <div
      style={{
        backgroundColor: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
      }}
    >
      <div
        style={{
          marginBottom: spacing.sm,
          color: colors.textPrimary,
          fontSize: fontSize.lg,
          fontWeight: 600,
        }}
      >
        Dismiss
      </div>
      <div
        style={{
          marginBottom: spacing.lg,
          padding: spacing.md,
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {previewAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                minWidth: 0,
              }}
            >
              <Badge
                variant={
                  alert.severity === "critical" || alert.severity === "high"
                    ? "danger"
                    : alert.severity === "medium"
                      ? "warning"
                      : "info"
                }
                size="sm"
              >
                {alert.severity}
              </Badge>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: colors.textPrimary,
                    fontSize: fontSize.md,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alert.title}
                </div>
                <div
                  style={{
                    color: colors.textMuted,
                    fontSize: fontSize.sm,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alert.domain}
                </div>
              </div>
            </div>
          ))}
          {alerts.length > previewAlerts.length && (
            <div style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              他 {alerts.length - previewAlerts.length} 件
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: spacing.lg }}>
        <label
          style={{
            display: "block",
            marginBottom: spacing.sm,
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: 500,
          }}
        >
          理由
        </label>
        {DISMISS_REASON_OPTIONS.map((option) => (
          <label
            key={option.value}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: spacing.sm,
              padding: spacing.sm,
              marginBottom: "2px",
              borderRadius: borderRadius.md,
              cursor: "pointer",
              background: reason === option.value ? colors.bgSecondary : "transparent",
              border: `1px solid ${reason === option.value ? colors.border : "transparent"}`,
            }}
          >
            <input
              type="radio"
              name="dismiss-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              style={{ marginTop: "2px", accentColor: colors.interactive }}
            />
            <div>
              <div
                style={{
                  color: colors.textPrimary,
                  fontSize: fontSize.md,
                  fontWeight: 500,
                }}
              >
                {option.label}
              </div>
              <div style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {option.description}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ marginBottom: spacing.lg }}>
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
            fontSize: fontSize.md,
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: `${spacing.sm} ${spacing.lg}`,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            background: "transparent",
            color: colors.textSecondary,
            fontSize: fontSize.md,
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(reason, trimmedComment);
          }}
          style={{
            padding: `${spacing.sm} ${spacing.lg}`,
            border: "none",
            borderRadius: borderRadius.md,
            background: colors.interactive,
            color: "#fff",
            fontSize: fontSize.md,
            cursor: "pointer",
            fontWeight: 500,
            opacity: 1,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
