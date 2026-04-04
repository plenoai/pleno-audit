import { useRef, useState, useEffect, useCallback } from "preact/hooks";
import type { JSX } from "preact";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => JSX.Element;
  overscan?: number;
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * 軽量な仮想スクローリングリストコンポーネント
 * 大量のアイテム（1000+）を効率的にレンダリング
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  overscan = 3,
  className,
  style = {},
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    startIndex + visibleCount + overscan * 2
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height,
        overflow: "auto",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          height: totalHeight,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, i) => (
            <div
              key={startIndex + i}
              style={{
                height: itemHeight,
                boxSizing: "border-box",
              }}
            >
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface VirtualTableProps<T> {
  items: T[];
  columns: {
    key: string;
    header: string;
    width?: string;
    render: (item: T) => JSX.Element | string;
  }[];
  rowHeight?: number;
  height?: number;
  headerHeight?: number;
  emptyMessage?: string;
}

/**
 * 仮想スクローリング対応テーブル
 * 大量行（5000+）を効率的に表示
 */
export function VirtualTable<T>({
  items,
  columns,
  rowHeight = 44,
  height = 400,
  headerHeight = 40,
  emptyMessage = "データがありません",
}: VirtualTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const bodyHeight = height - headerHeight;
  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.ceil(bodyHeight / rowHeight);
  const overscan = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    startIndex + visibleCount + overscan * 2
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (items.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted-foreground)",
          fontSize: 14,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={{
        height,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          height: headerHeight,
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              flex: col.width ? `0 0 ${col.width}` : 1,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--muted-foreground)",
            }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        style={{
          height: bodyHeight,
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: totalHeight,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {visibleItems.map((item, i) => (
              <div
                key={startIndex + i}
                style={{
                  display: "flex",
                  height: rowHeight,
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    style={{
                      flex: col.width ? `0 0 ${col.width}` : 1,
                      padding: "0 16px",
                      display: "flex",
                      alignItems: "center",
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.render(item)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with count */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        {items.length.toLocaleString()} 件
      </div>
    </div>
  );
}
