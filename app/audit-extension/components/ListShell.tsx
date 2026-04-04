import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useTheme, spacing, fontSize, borderRadius } from "../lib/theme";
import { truncate } from "../entrypoints/dashboard/utils";
import { EmptyState } from "./EmptyState";
import { Badge } from "./Badge";
import { SearchInput } from "./SearchInput";
import type { TagSummaryItem } from "../entrypoints/dashboard/hooks/useTagFilter";

/* ---- TabRoot ---- */

interface TabRootProps {
  children: ComponentChildren;
}

export function TabRoot({ children }: TabRootProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {children}
    </div>
  );
}

/* ---- TagFilterBar ---- */

interface TagFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder: string;
  tagSummary: TagSummaryItem[];
  activeTagFilters: Set<string>;
  onToggleTag: (label: string) => void;
  children?: ComponentChildren;
}

export function TagFilterBar({
  searchQuery,
  onSearchChange,
  placeholder,
  tagSummary,
  activeTagFilters,
  onToggleTag,
  children,
}: TagFilterBarProps) {
  return (
    <FilterBar>
      <SearchInput value={searchQuery} onChange={onSearchChange} placeholder={placeholder} />
      {tagSummary.map((tag) => (
        <Badge
          key={tag.label}
          variant={tag.variant}
          active={activeTagFilters.has(tag.label)}
          onClick={() => onToggleTag(tag.label)}
        >
          {tag.label} ({tag.count})
        </Badge>
      ))}
      {children}
    </FilterBar>
  );
}

/* ---- useExpandable ---- */

export function useExpandable() {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (key: string) => expandedKeys.has(key),
    [expandedKeys],
  );

  return { expandedKeys, toggle, isExpanded };
}

/* ---- DetailLink ---- */

interface DetailLinkProps {
  label: string;
  href: string;
  maxLength?: number;
}

export function DetailLink({ label, href, maxLength = 60 }: DetailLinkProps) {
  const { colors } = useTheme();
  return (
    <DetailRow>
      <span style={{ color: colors.textMuted }}>{label}:</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: colors.link, textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {truncate(href, maxLength)}
      </a>
    </DetailRow>
  );
}

/* ---- DetailOverflow ("他 N 件") ---- */

interface DetailOverflowProps {
  remaining: number;
}

export function DetailOverflow({ remaining }: DetailOverflowProps) {
  const { colors } = useTheme();
  if (remaining <= 0) return null;
  return (
    <DetailRow>
      <span style={{ color: colors.textMuted }}>他 {remaining} 件</span>
    </DetailRow>
  );
}

/* ---- FilterBar ---- */

interface FilterBarProps {
  children: ComponentChildren;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        alignItems: "center",
        marginBottom: spacing.md,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  );
}

/* ---- ListContainer ---- */

interface ListContainerProps {
  children: ComponentChildren;
}

export function ListContainer({ children }: ListContainerProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ---- ListHeader ---- */

interface ListHeaderProps {
  children: ComponentChildren;
}

export function ListHeader({ children }: ListHeaderProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.sm} ${spacing.lg}`,
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ---- ScrollArea ---- */

interface ScrollAreaProps {
  children: ComponentChildren;
}

export function ScrollArea({ children }: ScrollAreaProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ---- ExpandedPanel ---- */

interface ExpandedPanelProps {
  children: ComponentChildren;
}

export function ExpandedPanel({ children }: ExpandedPanelProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        padding: `${spacing.sm} ${spacing.lg} ${spacing.sm}`,
        paddingLeft: "48px",
      }}
    >
      {children}
    </div>
  );
}

/* ---- DetailRow (single line inside ExpandedPanel) ---- */

interface DetailRowProps {
  children: ComponentChildren;
  highlighted?: boolean;
}

export function DetailRow({ children, highlighted }: DetailRowProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.xs} 0`,
        fontSize: fontSize.sm,
        color: highlighted ? colors.status.danger.text : colors.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

/* ---- ListRow ---- */

interface ListRowProps {
  /** Badges rendered above the title */
  badges: ComponentChildren;
  /** Primary title content (text, icon + text, etc.) */
  title: ComponentChildren;
  /** Secondary meta line (domain, date, counts, etc.) */
  meta: ComponentChildren;
  /** Leading element before content (e.g. checkbox) */
  leading?: ComponentChildren;
  /** Trailing actions (e.g. menu, expand arrow) */
  actions?: ComponentChildren;
  /** Highlighted state (expanded / active) */
  isHighlighted?: boolean;
  /** Show left active indicator bar */
  activeIndicator?: boolean;
  onClick?: () => void;
}

export function ListRow({
  badges,
  title,
  meta,
  leading,
  actions,
  isHighlighted = false,
  activeIndicator,
  onClick,
}: ListRowProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        borderBottom: `1px solid ${colors.border}`,
        background: isHighlighted ? colors.bgSecondary : colors.bgPrimary,
        ...(activeIndicator != null
          ? { borderLeft: activeIndicator ? `3px solid ${colors.interactive}` : "3px solid transparent" }
          : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          padding: `${spacing.md} ${spacing.lg}`,
          cursor: onClick ? "pointer" : undefined,
        }}
        onClick={onClick}
      >
        {leading}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: "2px",
              flexWrap: "wrap",
            }}
          >
            {badges}
          </div>
          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              fontSize: fontSize.base,
              color: colors.textPrimary,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "2px",
            }}
          >
            {title}
          </div>
          {/* Meta row */}
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
            {meta}
          </div>
        </div>
        {actions && (
          <div
            style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- usePagination ---- */

const DEFAULT_PAGE_SIZE = 50;

export function usePagination<T>(
  items: T[],
  resetDeps: unknown[],
  pageSize = DEFAULT_PAGE_SIZE,
) {
  const [currentPage, setCurrentPage] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter change
  useEffect(() => setCurrentPage(0), resetDeps);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = useMemo(
    () => items.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [items, currentPage, pageSize],
  );
  return { currentPage, setCurrentPage, totalPages, paged, pageSize } as const;
}

/* ---- PagedList ---- */

interface PagedListProps {
  /** Total count before filtering (0 → "no data" empty state) */
  allCount: number;
  /** Filtered items count */
  filteredCount: number;
  /** Label suffix, e.g. "アラート" → "12件のアラート" */
  countLabel: string;
  /** Empty state when allCount === 0 */
  emptyTitle: string;
  emptyDescription: string;
  /** Empty state when filteredCount === 0 (default messages if omitted) */
  noMatchTitle?: string;
  noMatchDescription?: string;
  /** Extra elements at start of header (e.g. checkbox) */
  headerLeading?: ComponentChildren;
  /** Pagination state from usePagination */
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** The rendered list items (already paged) */
  children: ComponentChildren;
}

export function PagedList({
  allCount,
  filteredCount,
  countLabel,
  emptyTitle,
  emptyDescription,
  noMatchTitle = "一致する項目がありません",
  noMatchDescription = "検索条件やフィルタを変更してください",
  headerLeading,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  children,
}: PagedListProps) {
  if (allCount === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  if (filteredCount === 0) {
    return <EmptyState title={noMatchTitle} description={noMatchDescription} />;
  }
  return (
    <ListContainer>
      <ListHeader>
        {headerLeading}
        <span style={{ flex: 1 }}>
          {filteredCount}件の{countLabel}
        </span>
      </ListHeader>
      <ScrollArea>{children}</ScrollArea>
      {totalPages > 1 && (
        <PaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredCount}
          onPageChange={onPageChange}
        />
      )}
    </ListContainer>
  );
}

/* ---- PaginationFooter ---- */

interface PaginationFooterProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function PaginationFooter({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationFooterProps) {
  const { colors } = useTheme();
  const isFirst = currentPage === 0;
  const isLast = currentPage >= totalPages - 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${spacing.sm} ${spacing.lg}`,
        background: colors.bgSecondary,
        borderTop: `1px solid ${colors.border}`,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        flexShrink: 0,
      }}
    >
      <span>
        {currentPage * pageSize + 1}–
        {Math.min((currentPage + 1) * pageSize, totalItems)} / {totalItems}件
      </span>
      <div style={{ display: "flex", gap: spacing.sm }}>
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.sm,
            background: isFirst ? colors.bgSecondary : colors.bgPrimary,
            color: isFirst ? colors.textMuted : colors.textPrimary,
            fontSize: fontSize.sm,
            cursor: isFirst ? "default" : "pointer",
          }}
        >
          ← 前
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.sm,
            background: isLast ? colors.bgSecondary : colors.bgPrimary,
            color: isLast ? colors.textMuted : colors.textPrimary,
            fontSize: fontSize.sm,
            cursor: isLast ? "default" : "pointer",
          }}
        >
          次 →
        </button>
      </div>
    </div>
  );
}
