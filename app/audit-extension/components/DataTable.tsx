import type { CSSProperties } from "preact/compat";
import { useState, useMemo } from "preact/hooks";
import { useTheme, type ThemeColors } from "../lib/theme";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => preact.ComponentChildren;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyMessage?: string;
  rowKey?: (item: T, index: number) => string;
  rowHighlight?: (item: T) => boolean | "danger" | "warning" | "info";
  expandRow?: (item: T) => preact.ComponentChildren | null;
  onRowClick?: (item: T) => void;
}

function getStyles(colors: ThemeColors, isDark: boolean): Record<string, CSSProperties> {
  return {
    container: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      overflow: "hidden",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
    },
    th: {
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: "12px 16px",
      textAlign: "left",
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
    },
    td: {
      padding: "12px 16px",
      borderBottom: `1px solid ${colors.borderLight}`,
      color: colors.textPrimary,
      verticalAlign: "middle",
    },
    row: {
      transition: "background 0.1s",
    },
    rowHighlightDanger: {
      background: isDark ? "#3d1a1a" : "#fef2f2",
    },
    rowHighlightWarning: {
      background: isDark ? "#3d3a0a" : "#fffbe6",
    },
    rowHighlightInfo: {
      background: isDark ? "#0a2a3d" : "#eff6ff",
    },
    empty: {
      padding: "48px",
      textAlign: "center",
      color: colors.textMuted,
      fontSize: "14px",
    },
    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderTop: `1px solid ${colors.border}`,
      background: colors.bgSecondary,
    },
    pageInfo: {
      fontSize: "13px",
      color: colors.textSecondary,
    },
    pageButtons: {
      display: "flex",
      gap: "8px",
    },
    pageBtn: {
      padding: "6px 12px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      background: colors.bgPrimary,
      fontSize: "12px",
      color: colors.textPrimary,
      cursor: "pointer",
    },
    pageBtnDisabled: {
      padding: "6px 12px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      background: colors.bgSecondary,
      fontSize: "12px",
      color: colors.textMuted,
      cursor: "not-allowed",
    },
  };
}

/** テーブルセル内で使う共通スタイル */
export function getTableCellStyles(colors: ThemeColors) {
  return {
    /** 展開行の外枠 */
    expandContainer: {
      background: colors.bgSecondary,
    } as CSSProperties,
    /** 展開行の各アイテム */
    expandRow: {
      padding: "4px 16px 4px 48px",
      borderBottom: `1px solid ${colors.borderLight}`,
    } as CSSProperties,
    /** 展開行の「他 N 件」テキスト */
    expandRemaining: {
      padding: "4px 16px 4px 48px",
      color: colors.textMuted,
      fontStyle: "italic",
      fontSize: "11px",
    } as CSSProperties,
    /** モノスペースコード（省略付き） */
    mono: {
      fontSize: "11px",
      fontFamily: "monospace",
      color: colors.textSecondary,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      display: "block",
    } as CSSProperties,
    /** リンク */
    link: {
      color: colors.link,
      fontSize: "12px",
    } as CSSProperties,
    /** 展開矢印アイコンのベーススタイル */
    expandArrowBase: {
      fontSize: "10px",
      color: colors.textSecondary,
      display: "inline-block",
      width: "12px",
      textAlign: "center",
      flexShrink: 0,
      transition: "transform 0.2s",
    } as CSSProperties,
    /** タグコンテナ */
    tags: {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
    } as CSSProperties,
    /** ミュートテキスト（空値の「-」等） */
    muted: {
      color: colors.textMuted,
    } as CSSProperties,
    /** アクション列の中央寄せ */
    actionsCell: {
      display: "flex",
      justifyContent: "center",
    } as CSSProperties,
  };
}

/** 展開矢印の動的スタイルを返す */
export function expandArrowStyle(
  base: CSSProperties,
  isExpanded: boolean,
  hasExpandable: boolean,
): CSSProperties {
  return {
    ...base,
    opacity: hasExpandable ? 1 : 0.3,
    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
  };
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 25,
  emptyMessage = "データがありません",
  rowKey = (_item: T, index: number) => String(index),
  rowHighlight,
  expandRow,
  onRowClick,
}: DataTableProps<T>) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginated = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize]
  );

  if (data.length === 0) {
    return (
      <div style={styles.container}>
        <p style={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...styles.th, width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.map((item, i) => {
            const expanded = expandRow?.(item);
            const highlight = rowHighlight?.(item);
            const highlightStyle = highlight === "danger" ? styles.rowHighlightDanger
              : highlight === "warning" || highlight === true ? styles.rowHighlightWarning
              : highlight === "info" ? styles.rowHighlightInfo
              : {};
            return (
              <>
                <tr
                  key={rowKey(item, i)}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    ...styles.row,
                    ...highlightStyle,
                    ...(onRowClick ? { cursor: "pointer" } : {}),
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
                {expanded && (
                  <tr key={`${rowKey(item, i)}-expand`}>
                    <td colSpan={columns.length} style={{ ...styles.td, padding: 0 }}>
                      {expanded}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <span style={styles.pageInfo}>
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} / {data.length}件
          </span>
          <div style={styles.pageButtons}>
            <button
              style={page === 0 ? styles.pageBtnDisabled : styles.pageBtn}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              前へ
            </button>
            <button
              style={page >= totalPages - 1 ? styles.pageBtnDisabled : styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
