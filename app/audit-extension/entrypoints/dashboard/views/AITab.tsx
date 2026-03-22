import { useMemo } from "preact/hooks";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";

interface AITabProps {
  prompts: CapturedAIPrompt[];
}

export function AITab({ prompts }: AITabProps) {
  const { searchQuery, setSearchQuery } = useTabFilter();

  const filtered = useMemo(() => {
    if (!searchQuery) return prompts;
    const q = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.provider?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.apiEndpoint.toLowerCase().includes(q)
    );
  }, [prompts, searchQuery]);

  return (
    <FilteredTab
      data={filtered}
      rowKey={(p) => p.id}
      emptyMessage="AIプロンプトは記録されていません"
      filterBar={
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Provider、Model、エンドポイントで検索..."
        />
      }
      columns={[
        {
          key: "timestamp",
          header: "日時",
          width: "160px",
          render: (p) => new Date(p.timestamp).toLocaleString("ja-JP"),
        },
        {
          key: "provider",
          header: "Provider",
          width: "100px",
          render: (p) => {
            try {
              return (
                <Badge>{p.provider && p.provider !== "unknown" ? p.provider : new URL(p.apiEndpoint).hostname}</Badge>
              );
            } catch {
              return <Badge>{p.provider || p.apiEndpoint || "unknown"}</Badge>;
            }
          },
        },
        {
          key: "model",
          header: "Model",
          width: "120px",
          render: (p) => <code style={{ fontSize: "11px" }}>{p.model || "-"}</code>,
        },
        {
          key: "prompt",
          header: "プロンプト",
          render: (p) => truncate(p.prompt.messages?.[0]?.content || p.prompt.text || "", 50),
        },
        {
          key: "latency",
          header: "レスポンス",
          width: "100px",
          render: (p) => (p.response ? <Badge>{p.response.latencyMs}ms</Badge> : "-"),
        },
      ]}
    />
  );
}
