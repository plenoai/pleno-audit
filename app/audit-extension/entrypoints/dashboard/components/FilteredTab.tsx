import type { ComponentChildren } from "preact";
import { DataTable } from "../../../components";
import { useTheme } from "../../../lib/theme";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => ComponentChildren;
}

interface FilteredTabProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T, index: number) => string;
  rowHighlight?: (item: T) => boolean;
  emptyMessage: string;
  filterBar?: ComponentChildren;
}

export function FilteredTab<T>({
  data,
  columns,
  rowKey,
  rowHighlight,
  emptyMessage,
  filterBar,
}: FilteredTabProps<T>) {
  const { colors } = useTheme();

  return (
    <div style={{ marginBottom: "32px" }}>
      {filterBar && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap" as const,
          }}
        >
          {filterBar}
        </div>
      )}
      <DataTable
        data={data}
        columns={columns}
        rowKey={rowKey}
        rowHighlight={rowHighlight}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
