import { useCallback, useMemo, useState } from "preact/hooks";
import { Globe } from "lucide-preact";
import type { AlertSeverity } from "libztbs/alerts";
import type { DetectedService } from "libztbs/types";
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
  SearchInput,
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

function getRiskLabel(score: number): { text: string; variant: "danger" | "warning" | "info" | "default" } {
  if (score >= 40) return { text: "High", variant: "danger" };
  if (score >= 15) return { text: "Medium", variant: "warning" };
  if (score >= 8) return { text: "Low", variant: "info" };
  return { text: "None", variant: "default" };
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
  isActive,
  onSelect,
  onDelete,
}: {
  service: DetectedService;
  serviceConnections: Record<string, string[]>;
  alertsByDomain?: Record<string, DomainAlertSummary>;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const connCount = serviceConnections[service.domain]?.length ?? 0;
  const alertSummary = alertsByDomain?.[service.domain];
  const score = getServiceRiskScore(service, connCount, alertSummary);
  const risk = getRiskLabel(score);
  const tags = getServiceTags(service);
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
  onDelete,
  onNavigateToAlerts,
}: {
  service: DetectedService;
  destinations: string[];
  alertSummary?: DomainAlertSummary;
  onDelete: () => void;
  onNavigateToAlerts?: (domain: string) => void;
}) {
  const { colors } = useTheme();
  const connCount = destinations.length;
  const score = getServiceRiskScore(service, connCount, alertSummary);
  const risk = getRiskLabel(score);
  const tags = getServiceTags(service);

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
            {service.nrdResult?.isNRD && (
              <div>NRD — 信頼度: {service.nrdResult.confidence}</div>
            )}
            {service.typosquatResult?.isTyposquat && (
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
  onNavigateToAlerts,
  onServiceDeleted,
}: ServicesTabProps) {
  const { colors } = useTheme();
  const { searchQuery, setSearchQuery } = useTabFilter({});
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

  const { tagSummary, activeTagFilters, toggleTagFilter, filterByTags: tagFiltered } =
    useTagFilter(services, getServiceTags);

  const filtered = useMemo(() => {
    let result = tagFiltered.filter((s) => !deletedDomains.has(s.domain));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.domain.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const scoreA = getServiceRiskScore(a, serviceConnections[a.domain]?.length ?? 0, alertsByDomain?.[a.domain]);
      const scoreB = getServiceRiskScore(b, serviceConnections[b.domain]?.length ?? 0, alertsByDomain?.[b.domain]);
      return scoreB - scoreA;
    });
    return result;
  }, [tagFiltered, searchQuery, deletedDomains, serviceConnections, alertsByDomain]);

  const activeService = activeDomain
    ? services.find((s) => s.domain === activeDomain && !deletedDomains.has(s.domain)) ?? null
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PageHeader
        title="検出サービス"
        kicker="SaaS DISCOVERY"
        sub="ブラウジング中に検出した SaaS / Web サービスとリスクを一覧表示。NRD・タイポスクワット・AI 利用の指標を集約。"
      />
      <HostPane>
        <HostListPane>
          <HostListFilterBar>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="ドメインで検索... (/)"
            />
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
