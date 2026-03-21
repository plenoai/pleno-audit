import { useMemo } from "preact/hooks";
import type { CSPViolation } from "@pleno-audit/csp";
import { Badge, SearchInput, Select } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";

interface ViolationsTabProps {
  violations: CSPViolation[];
  directives: string[];
}

export function ViolationsTab({ violations, directives }: ViolationsTabProps) {
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({ directive: "" });

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (filters.directive && v.directive !== filters.directive) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.pageUrl.toLowerCase().includes(q) ||
          v.blockedURL.toLowerCase().includes(q) ||
          v.directive.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [violations, searchQuery, filters.directive]);

  return (
    <FilteredTab
      data={filtered}
      rowKey={(v, i) => `${v.timestamp}-${i}`}
      rowHighlight={(v) => ["script-src", "default-src"].includes(v.directive)}
      emptyMessage="CSP違反は記録されていません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL、ドメインで検索..." />
          <Select
            value={filters.directive}
            onChange={(v) => setFilter("directive", v)}
            options={directives.map((d) => ({ value: d, label: d }))}
            placeholder="Directive"
          />
        </>
      }
      columns={[
        {
          key: "timestamp",
          header: "日時",
          width: "160px",
          render: (v) => new Date(v.timestamp).toLocaleString("ja-JP"),
        },
        {
          key: "page",
          header: "ページ",
          render: (v) => <span title={v.pageUrl}>{truncate(v.pageUrl, 40)}</span>,
        },
        {
          key: "directive",
          header: "Directive",
          width: "120px",
          render: (v) => (
            <Badge variant={["script-src", "default-src"].includes(v.directive) ? "danger" : "default"}>
              {v.directive}
            </Badge>
          ),
        },
        {
          key: "blocked",
          header: "ブロックURL",
          render: (v) => <span title={v.blockedURL}>{truncate(v.blockedURL, 40)}</span>,
        },
      ]}
    />
  );
}
