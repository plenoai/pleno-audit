import { useMemo } from "preact/hooks";
import type { NetworkRequest } from "@pleno-audit/csp";
import { Badge, Button, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";

interface DomainsTabProps {
  domainStats: { label: string; value: number }[];
  domainViolationMeta: Record<string, { count: number; lastSeen: number }>;
  networkRequests: NetworkRequest[];
}

export function DomainsTab({ domainStats, domainViolationMeta, networkRequests }: DomainsTabProps) {
  const { searchQuery, setSearchQuery } = useTabFilter();

  const networkByDomain = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of networkRequests) {
      map[r.domain] = (map[r.domain] || 0) + 1;
    }
    return map;
  }, [networkRequests]);

  const rows = useMemo(() => {
    return domainStats
      .map((d, i) => ({
        ...d,
        requests: networkByDomain[d.label] || 0,
        lastSeen: domainViolationMeta[d.label]?.lastSeen ?? 0,
        index: i,
      }))
      .filter((d) => {
        if (!searchQuery) return true;
        return d.label.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [domainStats, networkByDomain, domainViolationMeta, searchQuery]);

  return (
    <FilteredTab
      data={rows}
      rowKey={(d) => d.label}
      rowHighlight={(d) => d.value > 10}
      emptyMessage="ドメインデータなし"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="ドメインで検索..." />
          <Button
            onClick={async () => {
              try {
                const policy = await chrome.runtime.sendMessage({ type: "GENERATE_CSP" });
                if (policy?.policyString) {
                  const blob = new Blob([policy.policyString], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `csp-policy-${new Date().toISOString().slice(0, 10)}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              } catch {
                // CSP generation error
              }
            }}
          >
            CSPポリシー生成
          </Button>
        </>
      }
      columns={[
        {
          key: "domain",
          header: "ドメイン",
          render: (d) => <code style={{ fontSize: "12px" }}>{d.label}</code>,
        },
        {
          key: "violations",
          header: "違反数",
          width: "100px",
          render: (d) => (d.value > 0 ? <Badge variant="danger">{d.value}</Badge> : "-"),
        },
        {
          key: "requests",
          header: "リクエスト数",
          width: "120px",
          render: (d) => d.requests,
        },
        {
          key: "lastSeen",
          header: "最終検出",
          width: "160px",
          render: (d) => (d.lastSeen ? new Date(d.lastSeen).toLocaleString("ja-JP") : "-"),
        },
      ]}
    />
  );
}
