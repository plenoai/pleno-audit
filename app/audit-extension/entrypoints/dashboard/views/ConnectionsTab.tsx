import { useMemo } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/casb-types";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";

interface ConnectionsTabProps {
  services: DetectedService[];
  serviceConnections: Record<string, Record<string, number>>;
}

interface ConnectionRow {
  source: string;
  destination: string;
  count: number;
}

export function ConnectionsTab({ services, serviceConnections }: ConnectionsTabProps) {
  const { colors } = useTheme();
  const { searchQuery, setSearchQuery } = useTabFilter();

  const rows = useMemo(() => {
    const serviceDomains = new Set(services.map((s) => s.domain));
    const result: ConnectionRow[] = [];

    for (const [source, destMap] of Object.entries(serviceConnections)) {
      if (!serviceDomains.has(source)) continue;
      for (const [destination, count] of Object.entries(destMap)) {
        result.push({ source, destination, count });
      }
    }

    return result.sort((a, b) => b.count - a.count);
  }, [services, serviceConnections]);

  const filtered = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) => r.source.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const uniqueSources = useMemo(() => new Set(rows.map((r) => r.source)).size, [rows]);

  return (
    <div>
      <div
        style={{
          marginBottom: "16px",
          fontSize: "13px",
          color: colors.textSecondary,
        }}
      >
        {uniqueSources}件のサービスから{rows.length}件の外部通信を検出
      </div>
      <FilteredTab
        data={filtered}
        rowKey={(r) => `${r.source}-${r.destination}`}
        emptyMessage="通信先データがありません"
        filterBar={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="送信元・通信先ドメインで検索..."
          />
        }
        columns={[
          {
            key: "source",
            header: "送信元サービス",
            render: (r) => <code style={{ fontSize: "12px" }}>{r.source}</code>,
          },
          {
            key: "arrow",
            header: "",
            width: "40px",
            render: () => (
              <span style={{ color: colors.textMuted, fontSize: "14px" }}>{"\u2192"}</span>
            ),
          },
          {
            key: "destination",
            header: "通信先ドメイン",
            render: (r) => <code style={{ fontSize: "12px" }}>{r.destination}</code>,
          },
          {
            key: "count",
            header: "リクエスト数",
            width: "120px",
            render: (r) => <Badge variant={r.count >= 10 ? "warning" : "info"}>{r.count}</Badge>,
          },
        ]}
      />
    </div>
  );
}
