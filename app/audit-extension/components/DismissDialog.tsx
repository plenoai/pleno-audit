import { useState } from "preact/hooks";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";

interface Props {
  onConfirm: (reason: string, comment?: string) => void;
  onCancel: () => void;
}

const DISMISS_REASONS = [
  { value: "false_positive", label: "誤検知", description: "このアラートは実際のセキュリティリスクではない" },
  { value: "wont_fix", label: "リスク受容", description: "リスクを認識した上で対応しない" },
  { value: "used_in_tests", label: "テスト環境", description: "テストまたは開発環境でのみ使用" },
] as const;

export function DismissDialog({ onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<string>("false_positive");
  const [comment, setComment] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
          width: "420px",
          maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: `0 0 ${spacing.lg}`, color: colors.textPrimary, fontSize: fontSize.lg }}>
          アラートを無視
        </h3>

        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: "block", marginBottom: spacing.sm, color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: 500 }}>
            理由
          </label>
          {DISMISS_REASONS.map((r) => (
            <label
              key={r.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: spacing.sm,
                padding: spacing.sm,
                marginBottom: "2px",
                borderRadius: borderRadius.md,
                cursor: "pointer",
                background: reason === r.value ? colors.bgSecondary : "transparent",
                border: `1px solid ${reason === r.value ? colors.border : "transparent"}`,
              }}
            >
              <input
                type="radio"
                name="dismiss-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ marginTop: "2px", accentColor: colors.interactive }}
              />
              <div>
                <div style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: 500 }}>
                  {r.label}
                </div>
                <div style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  {r.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: "block", marginBottom: spacing.xs, color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: 500 }}>
            コメント（任意）
          </label>
          <textarea
            value={comment}
            onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
            placeholder="補足説明を入力..."
            style={{
              width: "100%",
              minHeight: "60px",
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
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason, comment || undefined)}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              border: "none",
              borderRadius: borderRadius.md,
              background: colors.interactive,
              color: "#fff",
              fontSize: fontSize.md,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            無視する
          </button>
        </div>
      </div>
    </div>
  );
}
