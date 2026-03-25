import { useCallback, useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { DetectedService } from "@libztbs/types";
import { Badge, SearchInput, getTableCellStyles, expandArrowStyle } from "../../../components";
import { ServiceRowMenu } from "../../../components/ServiceRowMenu";
import { sendMessage } from "../../../lib/messaging";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme } from "../../../lib/theme";

interface ServicesTabProps {
  services: DetectedService[];
  serviceConnections: Record<string, string[]>;
  onServiceDeleted?: () => void;
}

function getServiceTags(s: DetectedService): { label: string; variant: "danger" | "warning" | "info" | "success" }[] {
  const tags: { label: string; variant: "danger" | "warning" | "info" | "success" }[] = [];
  if (s.nrdResult?.isNRD) tags.push({ label: "NRD", variant: "danger" });
  if (s.typosquatResult?.isTyposquat) tags.push({ label: "Typosquat", variant: "danger" });
  if (s.hasLoginPage) tags.push({ label: "ログイン", variant: "warning" });
  if (s.aiDetected?.hasAIActivity) tags.push({ label: "AI", variant: "info" });
  for (const dataType of s.sensitiveDataDetected ?? []) {
    tags.push({ label: dataType, variant: "warning" });
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

export function ServicesTab({ services, serviceConnections, onServiceDeleted }: ServicesTabProps) {
  const { colors } = useTheme();
  const cellStyles = getTableCellStyles(colors);
  const { searchQuery, setSearchQuery } = useTabFilter({});
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());
  const [deletedDomains, setDeletedDomains] = useState<Set<string>>(new Set());

  const handleDeleteService = useCallback(
    (domain: string) => {
      sendMessage({ type: "DELETE_SERVICE", data: { domain } }).catch(() => {});
      setDeletedDomains((prev) => new Set(prev).add(domain));
      onServiceDeleted?.();
    },
    [onServiceDeleted],
  );

  const tagSummary = useMemo(() => {
    const map = new Map<string, { variant: "danger" | "warning" | "info" | "success"; count: number }>();
    for (const s of services) {
      for (const tag of getServiceTags(s)) {
        const existing = map.get(tag.label);
        if (existing) existing.count++;
        else map.set(tag.label, { variant: tag.variant, count: 1 });
      }
    }
    return [...map.entries()]
      .map(([label, { variant, count }]) => ({ label, variant, count }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  const toggleTagFilter = (label: string) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = services.filter((s) => !deletedDomains.has(s.domain));
    if (activeTagFilters.size > 0) {
      result = result.filter((s) => {
        const tags = getServiceTags(s);
        return tags.some((t) => activeTagFilters.has(t.label));
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.domain.toLowerCase().includes(q));
    }
    return result;
  }, [services, searchQuery, activeTagFilters, deletedDomains]);

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
          <div style={cellStyles.expandContainer}>
            {shown.map((domain) => (
              <div key={domain} style={cellStyles.expandRow}>
                <code style={cellStyles.mono} title={domain}>
                  └ {domain}
                </code>
              </div>
            ))}
            {remaining > 0 && (
              <div style={cellStyles.expandRemaining}>
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
          {tagSummary.map((tag) => (
            <Badge
              key={tag.label}
              variant={tag.variant}
              active={activeTagFilters.has(tag.label)}
              onClick={() => toggleTagFilter(tag.label)}
            >
              {tag.label} ({tag.count})
            </Badge>
          ))}
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
                <span style={expandArrowStyle(cellStyles.expandArrowBase, isExpanded, hasConnections)}>
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
            if (tags.length === 0 && connCount === 0) return <span style={cellStyles.muted}>-</span>;
            return (
              <div style={cellStyles.tags}>
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
                style={cellStyles.link}
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
                style={cellStyles.link}
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
        {
          key: "actions",
          header: "",
          width: "36px",
          render: (s) => (
            <div style={cellStyles.actionsCell}>
              <ServiceRowMenu onDelete={() => handleDeleteService(s.domain)} />
            </div>
          ),
        },
      ]}
    />
  );
}
