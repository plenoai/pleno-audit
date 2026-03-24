import { useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { DetectedService } from "@libztbs/types";
import { Badge, Button, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme } from "../../../lib/theme";

interface ServicesTabProps {
  services: DetectedService[];
  nrdServices: DetectedService[];
  loginServices: DetectedService[];
  typosquatServices: DetectedService[];
  aiServices: DetectedService[];
  serviceConnections: Record<string, string[]>;
}

function getServiceTags(s: DetectedService): { label: string; variant: "danger" | "warning" | "info" | "success" }[] {
  const tags: { label: string; variant: "danger" | "warning" | "info" | "success" }[] = [];
  if (s.nrdResult?.isNRD) tags.push({ label: "NRD", variant: "danger" });
  if (s.typosquatResult?.isTyposquat) tags.push({ label: "Typosquat", variant: "danger" });
  if (s.hasLoginPage) tags.push({ label: "ログイン", variant: "warning" });
  if (s.aiDetected?.hasAIActivity) tags.push({ label: "AI", variant: "info" });
  return tags;
}

export function ServicesTab({ services, nrdServices, loginServices, typosquatServices, aiServices, serviceConnections }: ServicesTabProps) {
  const { colors, isDark } = useTheme();
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({
    nrd: false,
    login: false,
    typosquat: false,
    ai: false,
  });
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = services;
    if (filters.nrd) result = result.filter((s) => s.nrdResult?.isNRD);
    if (filters.login) result = result.filter((s) => s.hasLoginPage);
    if (filters.typosquat) result = result.filter((s) => s.typosquatResult?.isTyposquat);
    if (filters.ai) result = result.filter((s) => s.aiDetected?.hasAIActivity);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.domain.toLowerCase().includes(q));
    }
    return result;
  }, [services, searchQuery, filters.nrd, filters.login, filters.typosquat, filters.ai]);

  const toggleExpand = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

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
          <Button
            variant={filters.typosquat ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("typosquat", !filters.typosquat)}
          >
            Typosquat ({typosquatServices.length})
          </Button>
          <Button
            variant={filters.ai ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter("ai", !filters.ai)}
          >
            AI ({aiServices.length})
          </Button>
        </>
      }
      columns={[
        {
          key: "domain",
          header: "ドメイン",
          render: (s) => (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {s.faviconUrl ? (
                <img
                  src={s.faviconUrl}
                  alt=""
                  style={{ width: "16px", height: "16px", borderRadius: "2px", flexShrink: 0 }}
                />
              ) : (
                <Globe size={12} style={{ flexShrink: 0, color: colors.textMuted }} />
              )}
              <code style={{ fontSize: "12px" }}>{s.domain}</code>
            </div>
          ),
        },
        {
          key: "tags",
          header: "タグ",
          width: "180px",
          render: (s) => {
            const tags = getServiceTags(s);
            if (tags.length === 0) return <span style={{ color: colors.textMuted }}>-</span>;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {tags.map((tag) => (
                  <Badge key={tag.label} variant={tag.variant} size="sm">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            );
          },
        },
        {
          key: "connections",
          header: "通信先",
          width: "120px",
          render: (s) => {
            const destinations = serviceConnections[s.domain];
            if (!destinations || destinations.length === 0) {
              return <span style={{ color: colors.textMuted }}>-</span>;
            }
            const sorted = [...destinations].sort();
            const isExpanded = expandedDomains.has(s.domain);
            return (
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(s.domain);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: isDark ? "#60a5fa" : "#0070f3",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "10px" }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
                  <Badge variant="info">{sorted.length}</Badge>
                </button>
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px",
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      borderRadius: "6px",
                      fontSize: "11px",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {sorted.map((domain) => (
                      <div
                        key={domain}
                        style={{
                          padding: "3px 0",
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}
                      >
                        <code style={{ fontSize: "11px", color: colors.textPrimary }}>{domain}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          },
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
          key: "detected",
          header: "検出日時",
          width: "140px",
          render: (s) => new Date(s.detectedAt).toLocaleDateString("ja-JP"),
        },
      ]}
    />
  );
}
