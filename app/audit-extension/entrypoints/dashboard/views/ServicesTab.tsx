import { useCallback, useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { AlertSeverity } from "libztbs/alerts";
import type { DetectedService } from "libztbs/types";
import {
  computeServiceRiskScore,
  getRiskLevel,
  getServiceRiskFlags,
  isPatternDismissed,
  type RiskLevel,
  type ServiceRiskFlag,
} from "libztbs/detectors";
import {
  Badge,
  Button,
  EmptyState,
  HostPane,
  HostListPane,
  HostDetailPane,
  HostListFilterBar,
  HostListBody,
  ListRow,
  PageHeader,
  RiskBarScore,
  DetailSection,
  KeyValueGrid,
} from "../../../components";
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
  dismissedPatterns?: Set<string>;
  onNavigateToAlerts?: (domain: string) => void;
  onServiceDeleted?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

type TagVariant = "danger" | "warning" | "info" | "success";

interface UITag {
  label: string;
  variant: TagVariant;
}

function flagToTag(flag: ServiceRiskFlag): UITag {
  switch (flag.kind) {
    case "nrd":
      return { label: "NRD", variant: "danger" };
    case "typosquat":
      return { label: "Typosquat", variant: "danger" };
    case "login":
      return { label: "ログイン", variant: "warning" };
    case "ai":
      return { label: "AI", variant: "info" };
    case "sensitive-data":
      return { label: flag.dataType, variant: "warning" };
  }
}

function getServiceTags(
  s: DetectedService,
  dismissedPatterns?: ReadonlySet<string>,
): UITag[] {
  return getServiceRiskFlags(s, dismissedPatterns).map(flagToTag);
}

const RISK_LABEL: Record<RiskLevel, { text: string; variant: "danger" | "warning" | "info" | "default" }> = {
  high: { text: "High", variant: "danger" },
  medium: { text: "Medium", variant: "warning" },
  low: { text: "Low", variant: "info" },
  none: { text: "None", variant: "default" },
};

function getRiskLabel(score: number) {
  return RISK_LABEL[getRiskLevel(score)];
}

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
  dismissedPatterns,
  isActive,
  onSelect,
  onDelete,
}: {
  service: DetectedService;
  serviceConnections: Record<string, string[]>;
  alertsByDomain?: Record<string, DomainAlertSummary>;
  dismissedPatterns?: Set<string>;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const connCount = serviceConnections[service.domain]?.length ?? 0;
  const alertSummary = alertsByDomain?.[service.domain];
  const score = computeServiceRiskScore({
    service,
    connectionCount: connCount,
    alertSummary,
    dismissedPatterns,
  });
  const risk = getRiskLabel(score);
  const tags = getServiceTags(service, dismissedPatterns);
  const hasAlerts = alertSummary && alertSummary.total > 0;

  return (
    <ListRow
      isHighlighted={isActive}
      activeIndicator={isActive}
      onClick={onSelect}
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
              style={{ width: "14px", height: "14px", flexShrink: 0 }}
            />
          ) : (
            <Globe size={14} style={{ flexShrink: 0, color: colors.textMuted }} />
          )}
          <span>{service.domain}</span>
        </>
      }
      meta={
        <>
          {connCount > 0 && `${connCount}通信先`}
          {hasAlerts && (
            <>
              {connCount > 0 && " · "}
              <SeverityDots summary={alertSummary} />
            </>
          )}
        </>
      }
      actions={<ServiceRowMenu onDelete={onDelete} />}
    />
  );
}

function ServiceDetailContent({
  service,
  destinations,
  alertSummary,
  dismissedPatterns,
  onDelete,
  onNavigateToAlerts,
}: {
  service: DetectedService;
  destinations: string[];
  alertSummary?: DomainAlertSummary;
  dismissedPatterns?: Set<string>;
  onDelete: () => void;
  onNavigateToAlerts?: (domain: string) => void;
}) {
  const { colors } = useTheme();
  const connCount = destinations.length;
  const score = computeServiceRiskScore({
    service,
    connectionCount: connCount,
    alertSummary,
    dismissedPatterns,
  });
  const risk = getRiskLabel(score);
  const tags = getServiceTags(service, dismissedPatterns);
  const nrdActive =
    service.nrdResult?.isNRD && !isPatternDismissed(dismissedPatterns, "nrd", service.domain);
  const typosquatActive =
    service.typosquatResult?.isTyposquat &&
    !isPatternDismissed(dismissedPatterns, "typosquat", service.domain);

  const meta: [string, import("preact").ComponentChildren][] = [
    ["domain", service.domain],
    ["検出日時", new Date(service.detectedAt).toLocaleString("ja-JP")],
    ["通信先数", `${connCount}`],
  ];
  if (service.nrdResult?.domainAge !== null && service.nrdResult?.domainAge !== undefined) {
    meta.push(["ドメイン年齢", `${service.nrdResult.domainAge}日`]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: borderRadius.md,
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {service.faviconUrl ? (
            <img src={service.faviconUrl} alt="" style={{ width: "20px", height: "20px" }} />
          ) : (
            <Globe size={18} color={colors.textMuted} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: "4px" }}>
            <Badge variant={risk.variant} size="sm">{risk.text}</Badge>
            {tags.map((tag) => (
              <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
            ))}
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 500, letterSpacing: "-0.01em", color: colors.textPrimary, margin: 0, wordBreak: "break-all" }}>
            {service.domain}
          </h2>
          <div style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: "3px", fontFamily: "monospace" }}>
            {connCount}通信先 · 検出 {new Date(service.detectedAt).toLocaleDateString("ja-JP")}
          </div>
        </div>
        <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0, alignItems: "center" }}>
          <Button variant="secondary" size="sm" onClick={onDelete}>
            削除
          </Button>
          {alertSummary && onNavigateToAlerts && (
            <Button variant="primary" size="sm" onClick={() => onNavigateToAlerts(service.domain)}>
              トリアージ →
            </Button>
          )}
        </div>
      </div>

      {/* 2col: メタ + リスク */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md, alignItems: "start" }}>
        <DetailSection title="基本情報">
          <KeyValueGrid entries={meta} />
        </DetailSection>

        <DetailSection title="リスクスコア" meta={`${score} / 100`}>
          <RiskBarScore value={score} />
          <div style={{ marginTop: spacing.sm, display: "flex", flexDirection: "column", gap: spacing.xs, fontSize: fontSize.sm, color: colors.textSecondary }}>
            {nrdActive && service.nrdResult && (
              <div>NRD — 信頼度: {service.nrdResult.confidence}</div>
            )}
            {typosquatActive && service.typosquatResult && (
              <div>タイポスクワット候補 — スコア: {service.typosquatResult.totalScore}</div>
            )}
            {service.hasLoginPage && <div>ログインページ検出</div>}
            {service.aiDetected?.hasAIActivity && <div>AI 利用検出</div>}
            {!service.privacyPolicyUrl && <div>プライバシーポリシー未掲載</div>}
            {!service.termsOfServiceUrl && <div>利用規約未掲載</div>}
          </div>
        </DetailSection>
      </div>

      {alertSummary && alertSummary.total > 0 && (
        <DetailSection title="関連アラート" meta={`${alertSummary.total}件`}>
          <div style={{ marginBottom: spacing.sm }}>
            <SeverityDots summary={alertSummary} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            {alertSummary.categories.map((cat) => (
              <Badge key={cat} variant="info" size="sm">
                {CATEGORY_LABELS[cat] ?? cat}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}

      {(service.privacyPolicyUrl || service.termsOfServiceUrl) && (
        <DetailSection title="ポリシー">
          {service.privacyPolicyUrl && (
            <div style={{ marginBottom: spacing.xs }}>
              <a
                href={service.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.link, textDecoration: "none", fontSize: fontSize.sm, wordBreak: "break-all" }}
              >
                プライバシーポリシー ↗
              </a>
            </div>
          )}
          {service.termsOfServiceUrl && (
            <div>
              <a
                href={service.termsOfServiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colors.link, textDecoration: "none", fontSize: fontSize.sm, wordBreak: "break-all" }}
              >
                利用規約 ↗
              </a>
            </div>
          )}
        </DetailSection>
      )}

      {destinations.length > 0 && (
        <DetailSection title="通信先" meta={`${destinations.length}件`}>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, fontSize: fontSize.sm, fontFamily: "monospace" }}>
            {[...destinations].sort().slice(0, 30).map((d) => (
              <div key={d} style={{ color: colors.textPrimary, wordBreak: "break-all" }}>
                {d}
              </div>
            ))}
            {destinations.length > 30 && (
              <div style={{ color: colors.textMuted }}>他 {destinations.length - 30} 件</div>
            )}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

export function ServicesTab({
  services,
  serviceConnections,
  alertsByDomain,
  dismissedPatterns,
  onNavigateToAlerts,
  onServiceDeleted,
  searchQuery,
  setSearchQuery,
}: ServicesTabProps) {
  const { colors } = useTheme();
  useTabFilter({ searchQuery, setSearchQuery });
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [deletedDomains, setDeletedDomains] = useState<Set<string>>(new Set());

  const handleDeleteService = useCallback(
    (domain: string) => {
      sendMessage({ type: "DELETE_SERVICE", data: { domain } }).catch(() => {});
      setDeletedDomains((prev) => new Set(prev).add(domain));
      setActiveDomain((prev) => (prev === domain ? null : prev));
      onServiceDeleted?.();
    },
    [onServiceDeleted],
  );

  const getTagsForService = useCallback(
    (s: DetectedService) => getServiceTags(s, dismissedPatterns),
    [dismissedPatterns],
  );

  const { tagSummary, activeTagFilters, toggleTagFilter, filterByTags: tagFiltered } =
    useTagFilter(services, getTagsForService);

  const filtered = useMemo(() => {
    let result = tagFiltered.filter((s) => !deletedDomains.has(s.domain));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.domain.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const scoreA = computeServiceRiskScore({
        service: a,
        connectionCount: serviceConnections[a.domain]?.length ?? 0,
        alertSummary: alertsByDomain?.[a.domain],
        dismissedPatterns,
      });
      const scoreB = computeServiceRiskScore({
        service: b,
        connectionCount: serviceConnections[b.domain]?.length ?? 0,
        alertSummary: alertsByDomain?.[b.domain],
        dismissedPatterns,
      });
      return scoreB - scoreA;
    });
    return result;
  }, [tagFiltered, searchQuery, deletedDomains, serviceConnections, alertsByDomain, dismissedPatterns]);

  const activeService = activeDomain
    ? services.find((s) => s.domain === activeDomain && !deletedDomains.has(s.domain)) ?? null
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PageHeader
        title="サービス"
        kicker="DISCOVERY"
        sub="検出されたサービスをリスク順に一覧。クリックで右側にドメインの詳細と該当アラートを表示。"
      />
      <HostPane>
        <HostListPane>
          {tagSummary.length > 0 && (
            <HostListFilterBar>
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
            </HostListFilterBar>
          )}

          {filtered.length > 0 && (
            <div
              style={{
                padding: `${spacing.xs} ${spacing.lg}`,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: fontSize.xs,
                color: colors.textMuted,
                background: colors.bgSecondary,
                flexShrink: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {filtered.length}件のサービス
            </div>
          )}

          <HostListBody>
            {services.length === 0 ? (
              <EmptyState title="検出されたサービスはありません" description="ブラウジングを始めるとサービスが検出されます" />
            ) : filtered.length === 0 ? (
              <EmptyState title="条件に一致するサービスはありません" description="検索条件やフィルタを変更してください" />
            ) : (
              filtered.map((service) => (
                <ServiceRow
                  key={service.domain}
                  service={service}
                  serviceConnections={serviceConnections}
                  alertsByDomain={alertsByDomain}
                  dismissedPatterns={dismissedPatterns}
                  isActive={activeDomain === service.domain}
                  onSelect={() =>
                    setActiveDomain((prev) => (prev === service.domain ? null : service.domain))
                  }
                  onDelete={() => handleDeleteService(service.domain)}
                />
              ))
            )}
          </HostListBody>
        </HostListPane>

        <HostDetailPane>
          {activeService ? (
            <ServiceDetailContent
              service={activeService}
              destinations={serviceConnections[activeService.domain] ?? []}
              alertSummary={alertsByDomain?.[activeService.domain]}
              dismissedPatterns={dismissedPatterns}
              onDelete={() => handleDeleteService(activeService.domain)}
              onNavigateToAlerts={onNavigateToAlerts}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.textMuted,
                fontSize: fontSize.sm,
              }}
            >
              リストからサービスを選択して詳細を表示
            </div>
          )}
        </HostDetailPane>
      </HostPane>
    </div>
  );
}
