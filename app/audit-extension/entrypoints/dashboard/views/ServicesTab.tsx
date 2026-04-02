import { useCallback, useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { AlertSeverity } from "libztbs/alerts";
import type { DetectedService } from "libztbs/types";
import { Badge, SearchInput, getTableCellStyles, expandArrowStyle } from "../../../components";
import { ServiceRowMenu } from "../../../components/ServiceRowMenu";
import { sendMessage } from "../../../lib/messaging";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";

interface DomainAlertSummary {
  total: number;
  maxSeverity: AlertSeverity;
  bySeverity: Record<AlertSeverity, number>;
  categories: string[];
}

interface ServicesTabProps {
  services: DetectedService[];
  serviceConnections: Record<string, string[]>;
  alertsByDomain?: Record<string, DomainAlertSummary>;
  onNavigateToAlerts?: (domain: string) => void;
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

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

const categoryLabels: Record<string, string> = {
  nrd: "NRD",
  typosquat: "Typosquat",
  ai_sensitive: "AI",
  csp_violation: "CSP",
  shadow_ai: "DoH",
  data_exfiltration: "Exfil",
  credential_theft: "Cred",
  xss_injection: "XSS",
  dom_scraping: "DOM",
  clipboard_hijack: "Clip",
  canvas_fingerprint: "Canvas",
  webgl_fingerprint: "WebGL",
  audio_fingerprint: "Audio",
  tracking_beacon: "Beacon",
  supply_chain: "Supply",
  dynamic_code_execution: "Eval",
  fullscreen_phishing: "Phish",
};

function getServiceRiskScore(
  s: DetectedService,
  connectionCount: number,
  alertSummary?: DomainAlertSummary,
): number {
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

  if (alertSummary && alertSummary.total > 0) {
    score += SEVERITY_WEIGHT[alertSummary.maxSeverity] ?? 0;
  }

  return Math.min(100, score);
}

function getServiceRiskLevel(
  s: DetectedService,
  connectionCount: number,
  alertSummary?: DomainAlertSummary,
): false | "danger" | "warning" | "info" {
  const score = getServiceRiskScore(s, connectionCount, alertSummary);
  if (score >= 40) return "danger";
  if (score >= 15) return "warning";
  if (score >= 8) return "info";
  return false;
}

function getRiskLabel(score: number): { text: string; variant: "danger" | "warning" | "info" | "default" } {
  if (score >= 40) return { text: "High", variant: "danger" };
  if (score >= 15) return { text: "Medium", variant: "warning" };
  if (score >= 8) return { text: "Low", variant: "info" };
  return { text: "None", variant: "default" };
}

/** Severity dots: compact display of per-severity counts */
function SeverityDots({ summary }: { summary: DomainAlertSummary }) {
  const { colors } = useTheme();
  const colorMap: Record<AlertSeverity, string> = {
    critical: colors.dot.danger,
    high: colors.dot.warning,
    medium: colors.dot.info,
    low: colors.dot.success,
    info: colors.dot.default,
  };
  const nonZero = SEVERITY_ORDER.filter((s) => summary.bySeverity[s] > 0);
  if (nonZero.length === 0) return null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: spacing.xs }}>
      {nonZero.map((s) => (
        <span
          key={s}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            fontSize: fontSize.xs,
            color: colors.textSecondary,
          }}
          title={`${s}: ${summary.bySeverity[s]}`}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: colorMap[s],
            }}
          />
          {summary.bySeverity[s]}
        </span>
      ))}
    </span>
  );
}

export function ServicesTab({
  services,
  serviceConnections,
  alertsByDomain,
  onNavigateToAlerts,
  onServiceDeleted,
}: ServicesTabProps) {
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
    // Sort by risk score descending
    result = [...result].sort((a, b) => {
      const scoreA = getServiceRiskScore(a, serviceConnections[a.domain]?.length ?? 0, alertsByDomain?.[a.domain]);
      const scoreB = getServiceRiskScore(b, serviceConnections[b.domain]?.length ?? 0, alertsByDomain?.[b.domain]);
      return scoreB - scoreA;
    });
    return result;
  }, [services, searchQuery, activeTagFilters, deletedDomains, serviceConnections, alertsByDomain]);

  const toggleExpand = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  return (
    <FilteredTab
      data={filtered}
      rowKey={(s) => s.domain}
      rowHighlight={() => false}
      onRowClick={(s) => toggleExpand(s.domain)}
      expandRow={(s) => {
        if (!expandedDomains.has(s.domain)) return null;
        const destinations = serviceConnections[s.domain];
        const alertSummary = alertsByDomain?.[s.domain];
        const hasDestinations = destinations && destinations.length > 0;
        const hasAlerts = alertSummary && alertSummary.total > 0;
        const hasLinks = s.privacyPolicyUrl || s.termsOfServiceUrl;

        if (!hasDestinations && !hasAlerts && !hasLinks) return null;

        return (
          <div style={cellStyles.expandContainer}>
            {/* Alert summary with navigate link */}
            {hasAlerts && (
              <div
                style={{
                  ...cellStyles.expandRow,
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                  アラート:
                </span>
                <SeverityDots summary={alertSummary} />
                {alertSummary.categories.slice(0, 4).map((cat) => (
                  <Badge key={cat} variant="info" size="sm">
                    {categoryLabels[cat] ?? cat}
                  </Badge>
                ))}
                {alertSummary.categories.length > 4 && (
                  <span style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                    +{alertSummary.categories.length - 4}
                  </span>
                )}
                {onNavigateToAlerts && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToAlerts(s.domain);
                    }}
                    style={{
                      marginLeft: "auto",
                      padding: `2px ${spacing.sm}`,
                      border: `1px solid ${colors.border}`,
                      borderRadius: borderRadius.sm,
                      background: colors.bgPrimary,
                      color: colors.link,
                      fontSize: fontSize.sm,
                      cursor: "pointer",
                    }}
                  >
                    トリアージ →
                  </button>
                )}
              </div>
            )}
            {/* Links */}
            {hasLinks && (
              <div
                style={{
                  ...cellStyles.expandRow,
                  display: "flex",
                  gap: spacing.lg,
                  fontSize: fontSize.sm,
                }}
              >
                {s.privacyPolicyUrl && (
                  <span>
                    <span style={{ color: colors.textMuted }}>PP: </span>
                    <a
                      href={s.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={cellStyles.link}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {truncate(s.privacyPolicyUrl, 40)}
                    </a>
                  </span>
                )}
                {s.termsOfServiceUrl && (
                  <span>
                    <span style={{ color: colors.textMuted }}>ToS: </span>
                    <a
                      href={s.termsOfServiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={cellStyles.link}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {truncate(s.termsOfServiceUrl, 40)}
                    </a>
                  </span>
                )}
              </div>
            )}
            {/* Connections */}
            {hasDestinations && (() => {
              const sorted = [...destinations].sort();
              const shown = sorted.slice(0, 10);
              const remaining = sorted.length - shown.length;
              return (
                <>
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
                </>
              );
            })()}
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
          key: "risk",
          header: "リスク",
          width: "70px",
          render: (s) => {
            const score = getServiceRiskScore(
              s,
              serviceConnections[s.domain]?.length ?? 0,
              alertsByDomain?.[s.domain],
            );
            const risk = getRiskLabel(score);
            return <Badge variant={risk.variant} size="sm">{risk.text}</Badge>;
          },
        },
        {
          key: "domain",
          header: "ドメイン",
          render: (s) => {
            const isExpanded = expandedDomains.has(s.domain);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
                <span
                  style={{
                    ...cellStyles.expandArrowBase,
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
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
                <code style={{ fontSize: fontSize.md }}>{s.domain}</code>
              </div>
            );
          },
        },
        {
          key: "alerts",
          header: "アラート",
          width: "140px",
          render: (s) => {
            const summary = alertsByDomain?.[s.domain];
            if (!summary || summary.total === 0) {
              return <span style={cellStyles.muted}>-</span>;
            }
            return <SeverityDots summary={summary} />;
          },
        },
        {
          key: "tags",
          header: "タグ",
          width: "200px",
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
          key: "detected",
          header: "検出日時",
          width: "100px",
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
