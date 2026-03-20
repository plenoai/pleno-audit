import { useMemo } from "preact/hooks";
import type { NetworkRequest } from "@pleno-audit/csp";
import { Badge, Button, DataTable } from "../../../components";
import type { DashboardStyles } from "../styles";

interface DomainsTabProps {
  styles: DashboardStyles;
  domainStats: { label: string; value: number }[];
  domainViolationMeta: Record<string, { count: number; lastSeen: number }>;
  networkRequests: NetworkRequest[];
}

export function DomainsTab({ styles, domainStats, domainViolationMeta, networkRequests }: DomainsTabProps) {
  const networkByDomain = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of networkRequests) {
      map[r.domain] = (map[r.domain] || 0) + 1;
    }
    return map;
  }, [networkRequests]);

  return (
    <div style={styles.section}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
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
      </div>

      <DataTable
        data={domainStats.map((d, i) => ({
          ...d,
          requests: networkByDomain[d.label] || 0,
          lastSeen: domainViolationMeta[d.label]?.lastSeen ?? 0,
          index: i,
        }))}
        rowKey={(d) => d.label}
        rowHighlight={(d) => d.value > 10}
        emptyMessage="ドメインデータなし"
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
    </div>
  );
}
