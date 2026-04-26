import type { CSSProperties } from "preact/compat";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";

/* ---- Sparkline (enterprise.ui.Sparkline 等価) ---- */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({ data, width = 80, height = 22, color, fill = false }: SparklineProps) {
  const { colors } = useTheme();
  if (!data || data.length === 0) return null;
  const stroke = color ?? colors.interactive;

  let max = data[0];
  let min = data[0];
  for (const v of data) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((d, i) => [i * step, height - ((d - min) / range) * (height - 2) - 1]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = fill ? `${d} L${width},${height} L0,${height} Z` : null;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {area && <path d={area} fill={stroke} opacity="0.12" />}
      <path d={d} stroke={stroke} strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- RiskBarScore ---- */

interface RiskBarScoreProps {
  value: number;
  max?: number;
  /** override 自動色判定 */
  color?: string;
  height?: number;
}

export function RiskBarScore({ value, max = 100, color, height = 6 }: RiskBarScoreProps) {
  const { colors } = useTheme();
  const ratio = Math.min(1, Math.max(0, value / max));
  const w = ratio * 100;
  const c =
    color ??
    (value >= 80
      ? colors.dot.danger
      : value >= 60
        ? colors.dot.warning
        : value >= 40
          ? colors.dot.info
          : colors.dot.success);
  return (
    <div
      style={{
        position: "relative",
        height: `${height}px`,
        background: colors.bgTertiary,
        borderRadius: `${height / 2}px`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${w}%`,
          background: c,
          borderRadius: `${height / 2}px`,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

/* ---- Metric (enterprise.ui.Metric 等価) ---- */

interface MetricProps {
  label: string;
  value: number | string;
  /** ▲/▼ 表示用 (符号で方向を判定) */
  delta?: number;
  /** 単位 (GB, 分 etc) */
  unit?: string;
  /** 補足ラベル (前日比 など) */
  sub?: string;
  /** スパークライン */
  spark?: number[];
  /** delta が増加=悪い系メトリクスは true (デフォルト false: 増加=良) */
  invertDeltaTone?: boolean;
  style?: CSSProperties;
}

export function Metric({
  label,
  value,
  delta,
  unit,
  sub,
  spark,
  invertDeltaTone = false,
  style,
}: MetricProps) {
  const { colors } = useTheme();
  const up = typeof delta === "number" && delta > 0;
  const down = typeof delta === "number" && delta < 0;
  const upTone = invertDeltaTone ? colors.status.danger.text : colors.status.success.text;
  const downTone = invertDeltaTone ? colors.status.success.text : colors.status.danger.text;

  return (
    <div
      style={{
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px", minWidth: 0 }}>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              color: colors.textPrimary,
            }}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {unit && <span style={{ fontSize: fontSize.sm, color: colors.textMuted }}>{unit}</span>}
        </div>
        {spark && <Sparkline data={spark} width={64} height={20} />}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: colors.textMuted,
        }}
      >
        {delta !== undefined && (
          <span
            style={{
              fontFamily: "monospace",
              color: up ? upTone : down ? downTone : colors.textMuted,
            }}
          >
            {up ? "▲" : down ? "▼" : "●"} {Math.abs(delta)}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
