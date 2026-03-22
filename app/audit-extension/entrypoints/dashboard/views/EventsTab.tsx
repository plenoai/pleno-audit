import { useMemo } from "preact/hooks";
import type { EventLog } from "@pleno-audit/casb-types";
import { Badge, SearchInput, Select } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { EVENT_FILTER_TYPES, getEventBadgeVariant, getEventLabel } from "../domain/events";
import { truncate } from "../utils";

interface EventsTabProps {
  events: EventLog[];
}

export function EventsTab({ events }: EventsTabProps) {
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({ eventType: "" });

  const filtered = useMemo(() => {
    let result = events;
    if (filters.eventType) {
      result = result.filter((e) => e.type === filters.eventType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.type.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
    }
    return result;
  }, [events, searchQuery, filters.eventType]);

  return (
    <FilteredTab
      data={filtered}
      rowKey={(e) => e.id}
      emptyMessage="イベントは記録されていません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="イベントタイプ、ドメインで検索..." />
          <Select
            value={filters.eventType}
            onChange={(v) => setFilter("eventType", v)}
            options={EVENT_FILTER_TYPES.map((type) => ({
              value: type,
              label: getEventLabel(type),
            }))}
            placeholder="タイプ"
          />
        </>
      }
      columns={[
        {
          key: "timestamp",
          header: "日時",
          width: "160px",
          render: (e) => new Date(e.timestamp).toLocaleString("ja-JP"),
        },
        {
          key: "type",
          header: "タイプ",
          width: "140px",
          render: (e) => (
            <Badge variant={getEventBadgeVariant(e.type)}>
              {e.type}
            </Badge>
          ),
        },
        {
          key: "domain",
          header: "ドメイン",
          width: "200px",
          render: (e) => <code style={{ fontSize: "12px" }}>{e.domain}</code>,
        },
        {
          key: "details",
          header: "詳細",
          render: (e) => {
            const d = e.details as Record<string, unknown>;
            if (!d) return "-";
            if (e.type === "csp_violation") return `${d.directive}: ${truncate(String(d.blockedURL || ""), 30)}`;
            if (e.type === "ai_prompt_sent") return `${d.provider}/${d.model}`;
            return truncate(JSON.stringify(d) ?? "", 50);
          },
        },
      ]}
    />
  );
}
