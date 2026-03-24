import { useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { DetectedService } from "@libztbs/types";
import { Badge, SearchInput } from "../../../components";
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
  for (const dataType of s.sensitiveDataDetected ?? []) {
    tags.push({ label: dataType, variant: "danger" });
  }
  return tags;
}

/**
 * サービスのリスクスコアを算出（0-100）
 *
 * - NRD: +40（新規ドメインはフィッシングリスク大）
 *   - confidence high: +10, medium: +5
 *   - domainAge < 30日: +5
 * - Typosquat: +35（typosquatResult.totalScoreで加重）
 * - AI: +5（情報漏洩リスクはあるが基本的なリスクは低い）
 * - Login: +5（認証情報の存在、ただしloginページは一般的）
 * - プライバシーポリシー/利用規約なし: 各+3（コンプライアンスリスク）
 */
function getServiceRiskScore(s: DetectedService, connectionCount: number): number {
  let score = 0;

  if (s.nrdResult?.isNRD) {
    score += 40;
    if (s.nrdResult.confidence === "high") score += 10;
    else if (s.nrdResult.confidence === "medium") score += 5;
    if (s.nrdResult.domainAge !== null && s.nrdResult.domainAge < 30) score += 5;
  }

  if (s.typosquatResult?.isTyposquat) {
    score += 25 + Math.min(10, s.typosquatResult.totalScore);
  }

  if (s.aiDetected?.hasAIActivity) score += 5;
  if (s.hasLoginPage) score += 5;
  if (!s.privacyPolicyUrl) score += 3;
  if (!s.termsOfServiceUrl) score += 3;
  if (connectionCount > 20) score += 3;

  return Math.min(100, score);
}

function getServiceRiskLevel(s: DetectedService, connectionCount: number): false | "danger" | "warning" | "info" {
  const score = getServiceRiskScore(s, connectionCount);
  if (score >= 40) return "danger";
  if (score >= 15) return "warning";
  if (score >= 8) return "info";
  return false;
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
      rowHighlight={(s) => getServiceRiskLevel(s, serviceConnections[s.domain]?.length ?? 0)}
      onRowClick={(s) => {
        const destinations = serviceConnections[s.domain];
        if (destinations && destinations.length > 0) toggleExpand(s.domain);
      }}
      expandRow={(s) => {
        if (!expandedDomains.has(s.domain)) return null;
        const destinations = serviceConnections[s.domain];
        if (!destinations || destinations.length === 0) return null;
        const sorted = [...destinations].sort();
        const shown = sorted.slice(0, 10);
        const remaining = sorted.length - shown.length;
        return (
          <div style={{ background: colors.bgSecondary }}>
            {shown.map((domain) => (
              <div
                key={domain}
                style={{
                  padding: "4px 16px 4px 48px",
                  borderBottom: `1px solid ${colors.borderLight}`,
                }}
              >
                <code
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                  title={domain}
                >
                  └ {domain}
                </code>
              </div>
            ))}
            {remaining > 0 && (
              <div
                style={{
                  padding: "4px 16px 4px 48px",
                  color: colors.textMuted,
                  fontStyle: "italic",
                  fontSize: "11px",
                }}
              >
                他 {remaining} 件
              </div>
            )}
          </div>
        );
      }}
      emptyMessage="検出されたサービスはありません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="ドメインで検索..." />
          <Badge variant="danger" active={filters.nrd} onClick={() => setFilter("nrd", !filters.nrd)}>
            NRD ({nrdServices.length})
          </Badge>
          <Badge variant="warning" active={filters.login} onClick={() => setFilter("login", !filters.login)}>
            ログイン ({loginServices.length})
          </Badge>
          <Badge variant="danger" active={filters.typosquat} onClick={() => setFilter("typosquat", !filters.typosquat)}>
            Typosquat ({typosquatServices.length})
          </Badge>
          <Badge variant="info" active={filters.ai} onClick={() => setFilter("ai", !filters.ai)}>
            AI ({aiServices.length})
          </Badge>
        </>
      }
      columns={[
        {
          key: "domain",
          header: "ドメイン",
          render: (s) => {
            const hasConnections = (serviceConnections[s.domain]?.length ?? 0) > 0;
            const isExpanded = expandedDomains.has(s.domain);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    color: colors.textSecondary,
                    opacity: hasConnections ? 1 : 0.3,
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    display: "inline-block",
                    width: "12px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  ▶
                </span>
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
            );
          },
        },
        {
          key: "tags",
          header: "タグ",
          width: "180px",
          render: (s) => {
            const tags = getServiceTags(s);
            const connCount = serviceConnections[s.domain]?.length ?? 0;
            if (tags.length === 0 && connCount === 0) return <span style={{ color: colors.textMuted }}>-</span>;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {connCount > 0 && (
                  <Badge variant="info" size="sm">{connCount} 通信先</Badge>
                )}
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
