import { useMemo } from "preact/hooks";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";

interface ConnectionsTabProps {
  serviceConnections: Record<string, Record<string, number>>;
  extensionConnections: Record<string, Record<string, number>>;
  knownExtensions: Record<string, { name: string }>;
}

interface ConnectionRow {
  source: string;
  sourceType: "service" | "extension";
  destination: string;
  count: number;
}

export function ConnectionsTab({ serviceConnections, extensionConnections, knownExtensions }: ConnectionsTabProps) {
  const { colors } = useTheme();
  const { searchQuery, setSearchQuery } = useTabFilter();

  const rows = useMemo(() => {
    const result: ConnectionRow[] = [];

    for (const [source, destMap] of Object.entries(serviceConnections)) {
      for (const [destination, count] of Object.entries(destMap)) {
        result.push({ source, sourceType: "service", destination, count });
      }
    }

    for (const [extId, destMap] of Object.entries(extensionConnections)) {
      const extName = knownExtensions[extId]?.name ?? extId;
      for (const [destination, count] of Object.entries(destMap)) {
        result.push({ source: extName, sourceType: "extension", destination, count });
      }
    }

    return result.sort((a, b) => b.count - a.count);
  }, [serviceConnections, extensionConnections, knownExtensions]);

  const filtered = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) => r.source.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const serviceCount = useMemo(() => {
    const sources = new Set(rows.filter((r) => r.sourceType === "service").map((r) => r.source));
    return sources.size;
  }, [rows]);

  const extensionCount = useMemo(() => {
    const sources = new Set(rows.filter((r) => r.sourceType === "extension").map((r) => r.source));
    return sources.size;
  }, [rows]);

  return (
    <div>
      <div
        style={{
          marginBottom: "16px",
          fontSize: "13px",
          color: colors.textSecondary,
        }}
      >
        {serviceCount}件のサービスと{extensionCount}件の拡張機能から{rows.length}件の外部通信を検出
      </div>
      <FilteredTab
        data={filtered}
        rowKey={(r) => `${r.sourceType}-${r.source}-${r.destination}`}
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
            header: "送信元",
            render: (r) => (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Badge variant={r.sourceType === "extension" ? "warning" : "default"} size="sm">
                  {r.sourceType === "extension" ? "拡張" : "サービス"}
                </Badge>
                <code style={{ fontSize: "12px" }}>{r.source}</code>
              </div>
            ),
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
