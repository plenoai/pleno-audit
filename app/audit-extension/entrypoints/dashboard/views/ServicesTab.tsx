import { useCallback, useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { AlertSeverity } from "libztbs/alerts";
import type { DetectedService } from "libztbs/types";
import { Badge, ListRow, PagedList, ExpandedPanel, DetailRow, DetailLink, DetailOverflow, TabRoot, TagFilterBar, useExpandable, usePagination } from "../../../components";
import { ServiceRowMenu } from "../../../components/ServiceRowMenu";
import { sendMessage } from "../../../lib/messaging";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTagFilter } from "../hooks/useTagFilter";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";
import { CATEGORY_LABELS } from "../constants";

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

function _getServiceRiskLevel(
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

function ServiceRow({
  service,
  serviceConnections,
  alertsByDomain,
  isExpanded,
  onToggleExpand,
  onDelete,
  onNavigateToAlerts,
}: {
  service: DetectedService;
  serviceConnections: Record<string, string[]>;
  alertsByDomain?: Record<string, DomainAlertSummary>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onNavigateToAlerts?: (domain: string) => void;
}) {
  const { colors } = useTheme();
  const connCount = serviceConnections[service.domain]?.length ?? 0;
  const alertSummary = alertsByDomain?.[service.domain];
  const score = getServiceRiskScore(service, connCount, alertSummary);
  const risk = getRiskLabel(score);
  const tags = getServiceTags(service);

  const destinations = serviceConnections[service.domain];
  const hasDestinations = destinations && destinations.length > 0;
  const hasAlerts = alertSummary && alertSummary.total > 0;
  const hasLinks = service.privacyPolicyUrl || service.termsOfServiceUrl;
  const showExpanded = isExpanded && (hasDestinations || hasAlerts || hasLinks);

  return (
    <div>
      <ListRow
        isHighlighted={isExpanded}
        onClick={onToggleExpand}
        badges={
          <>
            <Badge variant={risk.variant} size="sm">{risk.text}</Badge>
            {tags.map((tag) => (
              <Badge key={tag.label} variant={tag.variant} size="sm">
                {tag.label}
              </Badge>
            ))}
          </>
        }
        title={
          <>
            {service.faviconUrl ? (
              <img
                src={service.faviconUrl}
                alt=""
                style={{ width: "16px", height: "16px", flexShrink: 0 }}
              />
            ) : (
              <Globe size={16} style={{ flexShrink: 0, color: colors.textMuted }} />
            )}
            <span>{service.domain}</span>
          </>
        }
        meta={
          <>
            {new Date(service.detectedAt).toLocaleDateString("ja-JP")}
            {connCount > 0 && ` · ${connCount}通信先`}
            {hasAlerts && (
              <>
                {" · "}
                <SeverityDots summary={alertSummary} />
              </>
            )}
          </>
        }
        actions={<ServiceRowMenu onDelete={onDelete} />}
      />

      {/* Expanded detail */}
      {showExpanded && (
        <ExpandedPanel>
          {hasAlerts && (
            <DetailRow>
              <span style={{ color: colors.textSecondary }}>アラート:</span>
              <SeverityDots summary={alertSummary} />
              {alertSummary.categories.slice(0, 4).map((cat) => (
                <Badge key={cat} variant="info" size="sm">
                  {CATEGORY_LABELS[cat] ?? cat}
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
                    onNavigateToAlerts(service.domain);
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
            </DetailRow>
          )}
          {service.privacyPolicyUrl && <DetailLink label="PP" href={service.privacyPolicyUrl} />}
          {service.termsOfServiceUrl && <DetailLink label="ToS" href={service.termsOfServiceUrl} />}
          {hasDestinations && (() => {
            const sorted = [...destinations].sort();
            const shown = sorted.slice(0, 10);
            const remaining = sorted.length - shown.length;
            return (
              <>
                {shown.map((domain) => (
                  <DetailRow key={domain}>└ {domain}</DetailRow>
                ))}
                <DetailOverflow remaining={remaining} />
              </>
            );
          })()}
        </ExpandedPanel>
      )}
    </div>
  );
}

export function ServicesTab({
  services,
  serviceConnections,
  alertsByDomain,
  onNavigateToAlerts,
  onServiceDeleted,
}: ServicesTabProps) {
  const { searchQuery, setSearchQuery } = useTabFilter({});
  const { toggle: toggleExpand, isExpanded } = useExpandable();
  const [deletedDomains, setDeletedDomains] = useState<Set<string>>(new Set());

  const handleDeleteService = useCallback(
    (domain: string) => {
      sendMessage({ type: "DELETE_SERVICE", data: { domain } }).catch(() => {});
      setDeletedDomains((prev) => new Set(prev).add(domain));
      onServiceDeleted?.();
    },
    [onServiceDeleted],
  );

  const { tagSummary, activeTagFilters, toggleTagFilter, filterByTags: tagFiltered } =
    useTagFilter(services, getServiceTags);

  const filtered = useMemo(() => {
    let result = tagFiltered.filter((s) => !deletedDomains.has(s.domain));
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
  }, [tagFiltered, searchQuery, deletedDomains, serviceConnections, alertsByDomain]);

  const { currentPage, setCurrentPage, totalPages, paged, pageSize } =
    usePagination(filtered, [searchQuery, activeTagFilters, deletedDomains]);

  return (
    <TabRoot>
      <TagFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ドメインで検索..."
        tagSummary={tagSummary}
        activeTagFilters={activeTagFilters}
        onToggleTag={toggleTagFilter}
      />

      <PagedList
        allCount={services.length}
        filteredCount={filtered.length}
        countLabel="サービス"
        emptyTitle="検出されたサービスはありません"
        emptyDescription="Webサービスが検出されると表示されます"
        noMatchTitle="条件に一致するサービスはありません"
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      >
        {paged.map((service) => (
          <ServiceRow
            key={service.domain}
            service={service}
            serviceConnections={serviceConnections}
            alertsByDomain={alertsByDomain}
            isExpanded={isExpanded(service.domain)}
            onToggleExpand={() => toggleExpand(service.domain)}
            onDelete={() => handleDeleteService(service.domain)}
            onNavigateToAlerts={onNavigateToAlerts}
          />
        ))}
      </PagedList>
    </TabRoot>
  );
}
