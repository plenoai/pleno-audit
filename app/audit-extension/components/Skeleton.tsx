import { useTheme } from "../lib/theme";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: Record<string, string | number>;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style = {},
}: SkeletonProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${colors.border} 25%, ${colors.bgTertiary} 50%, ${colors.border} 75%)`,
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  spacing?: number;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  spacing = 8,
}: SkeletonTextProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: colors.bgPrimary,
      }}
    >
      <Skeleton height={20} width="40%" style={{ marginBottom: 12 }} />
      <Skeleton height={32} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="80%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr 1fr",
          gap: 16,
          padding: 12,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgTertiary,
        }}
      >
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton height={14} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr 1fr",
            gap: 16,
            padding: 12,
            borderBottom:
              i < rows - 1 ? `1px solid ${colors.border}` : undefined,
          }}
        >
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="50%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        height,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: colors.bgPrimary,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-around",
        padding: 16,
        gap: 8,
      }}
    >
      {[40, 70, 55, 85, 60, 75, 45, 90, 65, 50].map((h, i) => (
        <Skeleton
          key={i}
          width={24}
          height={`${h}%`}
          borderRadius={4}
        />
      ))}
    </div>
  );
}

export function SkeletonStatsGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}
    >
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SkeletonChart height={250} />
      <SkeletonTable rows={5} />
    </div>
  );
}
