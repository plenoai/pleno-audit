import { useMemo } from "preact/hooks";
import type { NetworkRequest } from "@pleno-audit/csp";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";

interface NetworkTabProps {
  requests: NetworkRequest[];
}

export function NetworkTab({ requests }: NetworkTabProps) {
  const { searchQuery, setSearchQuery } = useTabFilter();

  const filtered = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((r) => r.url.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q));
  }, [requests, searchQuery]);

  return (
    <FilteredTab
      data={filtered}
      rowKey={(r, i) => `${r.timestamp}-${i}`}
      emptyMessage="ネットワークリクエストは記録されていません"
      filterBar={
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL、ドメインで検索..." />
      }
      columns={[
        {
          key: "timestamp",
          header: "日時",
          width: "160px",
          render: (r) => {
            const ts = typeof r.timestamp === "number" ? r.timestamp : new Date(r.timestamp).getTime();
            return new Date(ts).toLocaleString("ja-JP");
          },
        },
        {
          key: "initiatorType",
          header: "送信元",
          width: "120px",
          render: (r) => {
            const record = r as NetworkRequest & {
              initiatorType?: string;
              extensionId?: string;
              extensionName?: string;
            };
            const initiatorType = record.initiatorType || (r.initiator ? "page" : "unknown");
            if (initiatorType === "extension") {
              return (
                <Badge variant="purple">
                  {record.extensionName || record.extensionId?.slice(0, 8) || "Extension"}
                </Badge>
              );
            }
            if (initiatorType === "page") {
              try {
                const domain = r.initiator ? new URL(r.initiator).hostname : "Page";
                return <Badge variant="blue">{truncate(domain, 12)}</Badge>;
              } catch {
                return <Badge variant="blue">Page</Badge>;
              }
            }
            if (initiatorType === "browser") {
              return <Badge variant="gray">Browser</Badge>;
            }
            return <Badge variant="gray">Unknown</Badge>;
          },
        },
        {
          key: "method",
          header: "Method",
          width: "80px",
          render: (r) => <code style={{ fontSize: "11px" }}>{r.method || "GET"}</code>,
        },
        {
          key: "domain",
          header: "ドメイン",
          width: "160px",
          render: (r) => r.domain,
        },
        {
          key: "url",
          header: "URL",
          render: (r) => <span title={r.url}>{truncate(r.url, 50)}</span>,
        },
      ]}
    />
  );
}
