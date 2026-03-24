import type { ThemeColors } from "../../lib/theme";

export function createDashboardStyles(colors: ThemeColors, isDark: boolean) {
  return {
    wrapper: {
      display: "flex",
      flexDirection: "column" as const,
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
    body: {
      display: "flex",
      flex: 1,
      minHeight: 0,
    },
    container: {
      flex: 1,
      maxWidth: "1200px",
      padding: "24px",
      overflowY: "auto" as const,
    },
    header: {
      position: "sticky" as const,
      top: 0,
      zIndex: 10,
      background: colors.bgPrimary,
      borderBottom: `1px solid ${colors.border}`,
      padding: "12px 24px",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: "20px",
      fontWeight: 600,
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: "13px",
      marginTop: "4px",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "12px",
      marginBottom: "24px",
    },
    filterBar: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "16px",
      flexWrap: "wrap" as const,
    },
    section: {
      marginBottom: "32px",
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      marginBottom: "24px",
    },
    chartContainer: {
      height: "200px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    chartBar: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    chartLabel: {
      fontSize: "12px",
      color: colors.textSecondary,
      width: "100px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    chartBarInner: {
      height: "20px",
      background: colors.interactive,
      borderRadius: "4px",
      minWidth: "4px",
    },
    chartValue: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "40px",
    },
    code: {
      fontSize: "12px",
      fontFamily: "monospace",
      flex: 1,
      color: colors.textPrimary,
    },
    link: {
      color: isDark ? "#60a5fa" : "#0070f3",
      fontSize: "12px",
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center" as const,
      padding: "24px",
    },
  };
}

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
