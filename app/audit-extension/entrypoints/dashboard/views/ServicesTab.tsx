import { useMemo } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/casb-types";
import { Badge, Button, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme } from "../../../lib/theme";

interface ServicesTabProps {
  services: DetectedService[];
  nrdServices: DetectedService[];
  loginServices: DetectedService[];
}

export function ServicesTab({ services, nrdServices, loginServices }: ServicesTabProps) {
  const { colors, isDark } = useTheme();
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({
    nrd: false,
    login: false,
  });

  const filtered = useMemo(() => {
    let result = services;
    if (filters.nrd) result = result.filter((s) => s.nrdResult?.isNRD);
    if (filters.login) result = result.filter((s) => s.hasLoginPage);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.domain.toLowerCase().includes(q));
    }
    return result;
  }, [services, searchQuery, filters.nrd, filters.login]);

  return (
    <FilteredTab
      data={filtered}
      rowKey={(s) => s.domain}
      rowHighlight={(s) => s.nrdResult?.isNRD === true}
      emptyMessage="検出されたサービスはありません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="ドメインで検索..." />
          <Button
            variant={filters.nrd ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("nrd", !filters.nrd)}
          >
            NRD ({nrdServices.length})
          </Button>
          <Button
            variant={filters.login ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("login", !filters.login)}
          >
            ログイン ({loginServices.length})
          </Button>
        </>
      }
      columns={[
        {
          key: "domain",
          header: "ドメイン",
          render: (s) => <code style={{ fontSize: "12px" }}>{s.domain}</code>,
        },
        {
          key: "login",
          header: "ログイン",
          width: "80px",
          render: (s) => (s.hasLoginPage ? <Badge variant="warning">検出</Badge> : "-"),
        },
        {
          key: "privacy",
          header: "プライバシーポリシー",
          width: "160px",
          render: (s) =>
            s.privacyPolicyUrl ? (
              <a
                href={s.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: isDark ? "#60a5fa" : "#0070f3", fontSize: "12px" }}
              >
                {truncate(s.privacyPolicyUrl, 25)}
              </a>
            ) : (
              "-"
            ),
        },
        {
          key: "tos",
          header: "利用規約",
          width: "140px",
          render: (s) =>
            s.termsOfServiceUrl ? (
              <a
                href={s.termsOfServiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: isDark ? "#60a5fa" : "#0070f3", fontSize: "12px" }}
              >
                {truncate(s.termsOfServiceUrl, 20)}
              </a>
            ) : (
              "-"
            ),
        },
        {
          key: "nrd",
          header: "NRD",
          width: "100px",
          render: (s) => (s.nrdResult?.isNRD ? <Badge variant="danger">NRD</Badge> : "-"),
        },
        {
          key: "detected",
          header: "検出日時",
          width: "140px",
          render: (s) => new Date(s.detectedAt).toLocaleDateString("ja-JP"),
        },
      ]}
    />
  );
}
