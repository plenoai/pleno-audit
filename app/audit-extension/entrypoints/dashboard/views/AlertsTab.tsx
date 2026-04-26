import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ALL_PLAYBOOKS, type AlertSeverity, type AlertCategory, type DismissReason, type DismissRecord, type PlaybookData } from "libztbs/alerts";
import { Siren } from "lucide-preact";
import {
  AlertRowMenu,
  Badge,
  Button,
  DetailSection,
  EmptyState,
  HostPane,
  HostListPane,
  HostDetailPane,
  HostListFilterBar,
  HostListBody,
  KeyValueGrid,
  DismissComposer,
  ListRow,
  LoadingState,
  PageHeader,
  SearchInput,
} from "../../../components";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";
import { sendMessage } from "../../../lib/messaging";
import { CATEGORY_LABELS } from "../constants";

interface AlertItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  url?: string;
  timestamp: number;
  details?: Record<string, unknown>;
  count?: number;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const severityVariant: Record<AlertSeverity, "danger" | "warning" | "info"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "info",
};

const PLAYBOOK_DATA: Record<string, PlaybookData> = Object.fromEntries(
  ALL_PLAYBOOKS.map((p) => [p.id, p]),
);

const severityButtons: { key: AlertSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "info", label: "Info" },
];

function AlertRow({
  alert,
  isSelected,
  isActive,
  onSelect,
  onOpen,
  onReportBug,
  onDismissConfirm,
}: {
  alert: AlertItem;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: () => void;
  onReportBug: () => void;
  onDismissConfirm: (reason: DismissReason, comment: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <ListRow
      isHighlighted={isActive}
      activeIndicator={isActive}
      onClick={onOpen}
      leading={
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            onSelect(alert.id, (e.target as HTMLInputElement).checked)
          }
          style={{ flexShrink: 0, cursor: "pointer", accentColor: colors.interactive }}
        />
      }
      badges={
        <>
          <Badge variant={severityVariant[alert.severity]} size="sm">
            {alert.severity}
          </Badge>
          <Badge variant="info" size="sm">
            {CATEGORY_LABELS[alert.category] ?? alert.category}
          </Badge>
          {(alert.count ?? 1) > 1 && (
            <Badge variant="info" size="sm">
              x{alert.count}
            </Badge>
          )}
        </>
      }
      title={alert.title}
      meta={
        <>
          {alert.domain}
          {alert.description && ` · ${truncate(alert.description, 60)}`}
          {" · "}
          {new Date(alert.timestamp).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </>
      }
      actions={
        <AlertRowMenu
          onReportBug={onReportBug}
          dismissTarget={{
            id: alert.id,
            title: alert.title,
            domain: alert.domain,
            severity: alert.severity,
          }}
          onDismissConfirm={onDismissConfirm}
        />
      }
    />
  );
}

/* ============================================================
 * AlertDetailContent — host-pane の DetailPane に直接描画する内容
 * (DetailSidebar の chrome なし版)
 * ============================================================ */

function AlertDetailContent({
  alert,
  onReportBug,
  onDismissConfirm,
}: {
  alert: AlertItem;
  onReportBug: () => void;
  onDismissConfirm: (reason: DismissReason, comment: string) => void;
}) {
  const { colors } = useTheme();
  const dismissPopoverRef = useRef<HTMLDivElement>(null);
  const [showDismissComposer, setShowDismissComposer] = useState(false);
  const detailEntries = Object.entries(alert.details ?? {}).filter(
    ([k]) => k !== "type",
  );
  const sevVariant = severityVariant[alert.severity];
  const sevTone = colors.status[sevVariant];

  useEffect(() => {
    setShowDismissComposer(false);
  }, [alert.id]);

  useEffect(() => {
    if (!showDismissComposer) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        dismissPopoverRef.current &&
        !dismissPopoverRef.current.contains(event.target as Node)
      ) {
        setShowDismissComposer(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDismissComposer]);

  const metaEntries: [string, import("preact").ComponentChildren][] = [
    ["domain", alert.domain],
  ];
  if (alert.url) metaEntries.push(["url", alert.url]);
  metaEntries.push(["timestamp", new Date(alert.timestamp).toLocaleString("ja-JP")]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {/* enterprise風 ヘッダ: アイコン + 見出し + アクション */}
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: borderRadius.md,
            background: sevTone.bg,
            border: `1px solid ${sevTone.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: sevTone.text,
            flexShrink: 0,
          }}
        >
          <Siren size={18} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginBottom: "4px" }}>
            <Badge variant={sevVariant} size="sm">{alert.severity}</Badge>
            <Badge variant="info" size="sm">
              {CATEGORY_LABELS[alert.category] ?? alert.category}
            </Badge>
            {(alert.count ?? 1) > 1 && (
              <Badge variant="info" size="sm">x{alert.count}</Badge>
            )}
          </div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: colors.textPrimary,
              margin: 0,
              wordBreak: "break-all",
            }}
          >
            {alert.title}
          </h2>
          <div
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              marginTop: "3px",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {alert.domain} · {new Date(alert.timestamp).toLocaleTimeString("ja-JP")}
          </div>
        </div>
        <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" onClick={onReportBug}>
            バグを報告
          </Button>
          <div ref={dismissPopoverRef} style={{ position: "relative" }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDismissComposer((prev) => !prev)}
            >
              解決
            </Button>
            {showDismissComposer && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "340px",
                  maxWidth: "calc(100vw - 64px)",
                  zIndex: 10,
                }}
              >
                <DismissComposer
                  alerts={[
                    {
                      id: alert.id,
                      title: alert.title,
                      domain: alert.domain,
                      severity: alert.severity,
                    },
                  ]}
                  onConfirm={(reason, comment) => {
                    onDismissConfirm(reason, comment);
                    setShowDismissComposer(false);
                  }}
                  onCancel={() => setShowDismissComposer(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {alert.description && (
        <DetailSection title="説明">
          <p style={{ fontSize: fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
            {alert.description}
          </p>
        </DetailSection>
      )}

      {/* Evidence + Detection params: 2col grid (enterprise風) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: detailEntries.length > 0 ? "1fr 1fr" : "1fr",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <DetailSection title="メタ情報" meta="RAW">
          <KeyValueGrid entries={metaEntries} />
        </DetailSection>

        {detailEntries.length > 0 && (
          <DetailSection title="検出パラメータ" meta={`${detailEntries.length}件`}>
            <KeyValueGrid
              entries={detailEntries.map(([k, v]) => [
                k,
                typeof v === "object" ? JSON.stringify(v) : String(v),
              ])}
            />
          </DetailSection>
        )}
      </div>

      {/* Playbook 2col grid: response + prevention */}
      {PLAYBOOK_DATA[alert.category] && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: spacing.md,
            alignItems: "start",
          }}
        >
          <DetailSection title="対応方針" meta="PLAYBOOK">
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {PLAYBOOK_DATA[alert.category].response.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: spacing.sm,
                    padding: spacing.sm,
                    background: colors.bgSecondary,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: colors.textMuted,
                      color: colors.bgPrimary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: fontSize.xs,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: 600,
                        color: colors.textPrimary,
                        display: "block",
                      }}
                    >
                      {step.title}
                    </span>
                    <span
                      style={{
                        fontSize: fontSize.xs,
                        color: colors.textMuted,
                        lineHeight: 1.4,
                      }}
                    >
                      {step.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection title="予防策">
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: fontSize.sm,
                color: colors.textSecondary,
                lineHeight: 1.6,
              }}
            >
              {PLAYBOOK_DATA[alert.category].prevention.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </DetailSection>
        </div>
      )}

      <a
        href={`https://plenoai.github.io/pleno-audit/alerts/${alert.category}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: fontSize.sm,
          color: colors.textMuted,
          textDecoration: "none",
        }}
      >
        対応方針の詳細を見る ↗
      </a>
    </div>
  );
}

function DismissedView({
  records,
  onReopen,
}: {
  records: DismissRecord[];
  onReopen: (pattern: string) => void;
}) {
  const { colors } = useTheme();

  if (records.length === 0) {
    return (
      <EmptyState
        title="解決済みアラートはありません"
        description="アラートを解決すると、ここに表示されます"
      />
    );
  }

  return (
    <>
      {records.map((record) => (
        <ListRow
          key={record.pattern}
          badges={
            <>
              <Badge variant={severityVariant[record.alertSnapshot.severity as AlertSeverity] ?? "info"} size="sm">
                {record.alertSnapshot.severity}
              </Badge>
              <Badge variant="info" size="sm">
                {CATEGORY_LABELS[record.alertSnapshot.category] ?? record.alertSnapshot.category}
              </Badge>
            </>
          }
          title={record.alertSnapshot.title}
          meta={
            <>
              {record.alertSnapshot.domain} · {new Date(record.dismissedAt).toLocaleDateString()}
              {record.comment && ` · ${record.comment}`}
            </>
          }
          actions={
            <button
              type="button"
              onClick={() => onReopen(record.pattern)}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.sm,
                background: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: fontSize.sm,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Reopen
            </button>
          }
        />
      ))}
    </>
  );
}

export function AlertsTab() {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [showBulkDismissComposer, setShowBulkDismissComposer] = useState(false);
  const bulkDismissRef = useRef<HTMLDivElement>(null);

  const initialQuery = useMemo(() => {
    const stored = sessionStorage.getItem("alertDomainFilter");
    if (stored) {
      sessionStorage.removeItem("alertDomainFilter");
      return stored;
    }
    return "";
  }, []);

  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter<
    Record<AlertSeverity, boolean>
  >({
    critical: false,
    high: false,
    medium: false,
    low: false,
    info: false,
  });

  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery, setSearchQuery]);

  useEffect(() => {
    function handleFilterEvent() {
      const domain = sessionStorage.getItem("alertDomainFilter");
      if (domain) {
        sessionStorage.removeItem("alertDomainFilter");
        setSearchQuery(domain);
      }
    }
    window.addEventListener("alertDomainFilter", handleFilterEvent);
    return () => window.removeEventListener("alertDomainFilter", handleFilterEvent);
  }, [setSearchQuery]);

  useEffect(() => {
    sendMessage<{ events: AlertItem[]; counts: Record<string, number> }>({
      type: "GET_POPUP_EVENTS",
    })
      .then((res) => {
        setAlerts(res.events);
        setCounts(res.counts);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    sendMessage<DismissRecord[]>({ type: "GET_DISMISS_RECORDS" })
      .then(setDismissRecords)
      .catch(() => {});
  }, []);

  const [dismissedPatterns, setDismissedPatterns] = useState<Set<string>>(
    new Set(),
  );
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissRecords, setDismissRecords] = useState<DismissRecord[]>([]);

  const buildIssueUrl = useCallback((alert: AlertItem) => {
    const label = CATEGORY_LABELS[alert.category] ?? alert.category;
    const title = `[Bug] ${label}: ${alert.title}`;
    const details = alert.details ?? {};
    const detailLines = Object.entries(details)
      .filter(([k]) => k !== "type")
      .map(
        ([k, v]) =>
          `- ${k}: \`${typeof v === "object" ? JSON.stringify(v) : String(v)}\``,
      )
      .join("\n");

    const version = chrome.runtime.getManifest().version;
    const timestamp = new Date(alert.timestamp).toISOString();
    const occurrences = alert.count ?? 1;

    const body = [
      "## Bug Report",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| Category | ${label} (\`${alert.category}\`) |`,
      `| Severity | ${alert.severity} |`,
      `| URL | \`${alert.url ?? alert.domain}\` |`,
      `| Title | ${alert.title} |`,
      `| Occurrences | ${occurrences} |`,
      `| Detected at | ${timestamp} |`,
      "",
      `> ${alert.description}`,
      "",
      detailLines ? `## Alert Details\n${detailLines}` : "",
      "",
      "## Environment",
      "",
      `- Extension Version: ${version}`,
      `- User-Agent: \`${navigator.userAgent}\``,
      "",
      "## What is the issue?",
      "",
      "<!-- Please describe what looks incorrect -->",
      "",
      "## Steps to Reproduce",
      "",
      `1. Navigate to \`${alert.url ?? alert.domain}\``,
      "2. ",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    const params = new URLSearchParams({
      title,
      body,
      labels: "false-positive",
    });
    return `https://github.com/plenoai/pleno-audit/issues/new?${params.toString()}`;
  }, []);

  const handleReportBug = useCallback(
    (alert: AlertItem) => {
      const url = buildIssueUrl(alert);
      chrome.tabs.create({ url });
    },
    [buildIssueUrl],
  );

  const applyDismiss = useCallback(
    (targetAlerts: AlertItem[], reason: DismissReason, comment: string) => {
      if (targetAlerts.length === 1) {
        const a = targetAlerts[0];
        const pattern = `${a.category}::${a.domain}`;
        sendMessage({
          type: "DISMISS_ALERT_PATTERN",
          data: {
            category: a.category,
            domain: a.domain,
            severity: a.severity,
            title: a.title,
            reason,
            comment,
          },
        }).catch(() => {});
        setDismissedPatterns((prev) => new Set(prev).add(pattern));
      } else {
        const patternObjects = targetAlerts.map((a) => ({
          category: a.category,
          domain: a.domain,
          severity: a.severity,
          title: a.title,
        }));
        const patternStrings = patternObjects.map(
          (p) => `${p.category}::${p.domain}`,
        );
        sendMessage({
          type: "DISMISS_ALERT_PATTERN",
          data: { patterns: patternObjects, reason, comment },
        }).catch(() => {});
        setDismissedPatterns((prev) => {
          const next = new Set(prev);
          for (const p of patternStrings) next.add(p);
          return next;
        });
        setSelectedIds(new Set());
      }

      sendMessage<DismissRecord[]>({ type: "GET_DISMISS_RECORDS" })
        .then(setDismissRecords)
        .catch(() => {});
    },
    [],
  );

  const bulkDismissAlerts = useMemo(
    () => alerts.filter((alert) => selectedIds.has(alert.id)),
    [alerts, selectedIds],
  );

  useEffect(() => {
    if (selectedIds.size === 0) {
      setShowBulkDismissComposer(false);
    }
  }, [selectedIds.size]);

  useEffect(() => {
    if (!showBulkDismissComposer) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        bulkDismissRef.current &&
        !bulkDismissRef.current.contains(event.target as Node)
      ) {
        setShowBulkDismissComposer(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBulkDismissComposer]);

  const handleReopen = useCallback((pattern: string) => {
    sendMessage({
      type: "REOPEN_DISMISSED_PATTERN",
      data: { pattern },
    }).catch(() => {});
    setDismissedPatterns((prev) => {
      const next = new Set(prev);
      next.delete(pattern);
      return next;
    });
    sendMessage<DismissRecord[]>({ type: "GET_DISMISS_RECORDS" })
      .then(setDismissRecords)
      .catch(() => {});
  }, []);

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const activeSeverities = useMemo(
    () => severityButtons.filter((b) => filters[b.key]).map((b) => b.key),
    [filters],
  );

  const filtered = useMemo(() => {
    let result = alerts;

    if (dismissedPatterns.size > 0) {
      result = result.filter(
        (a) => !dismissedPatterns.has(`${a.category}::${a.domain}`),
      );
    }

    if (activeSeverities.length > 0) {
      result = result.filter((a) => activeSeverities.includes(a.severity));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.domain.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }

    result = [...result].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.timestamp - a.timestamp,
    );

    return result;
  }, [alerts, activeSeverities, searchQuery, dismissedPatterns]);

  const allSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  }, [allSelected, filtered]);

  const activeAlert = activeAlertId
    ? alerts.find((a) => a.id === activeAlertId) ?? null
    : null;

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PageHeader
        title="アラート"
        kicker="DETECTION"
        sub="検出されたセキュリティイベントを重要度順に一覧。クリックで右側に詳細とプレイブックを表示。"
      />
      <HostPane>
        <HostListPane>
          {/* chip filter (enterprise の chip 行に相当) */}
          <HostListFilterBar>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="検索... (/)"
            />
            {severityButtons.map((b) => {
              const count = counts[b.key] ?? 0;
              if (count === 0) return null;
              return (
                <Badge
                  key={b.key}
                  variant={severityVariant[b.key]}
                  active={filters[b.key]}
                  onClick={() => setFilter(b.key, !filters[b.key])}
                >
                  {b.label} ({count})
                </Badge>
              );
            })}
            {dismissRecords.filter((r) => r.reopenedAt == null).length > 0 && (
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: spacing.xs,
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={showDismissed}
                  onChange={() => setShowDismissed((v) => !v)}
                  style={{ accentColor: colors.interactive, cursor: "pointer" }}
                />
                解決済み ({dismissRecords.filter((r) => r.reopenedAt == null).length})
              </label>
            )}
          </HostListFilterBar>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div
              style={{
                display: "flex",
                gap: spacing.sm,
                alignItems: "center",
                padding: `${spacing.sm} ${spacing.lg}`,
                background: colors.bgSecondary,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: fontSize.sm,
                color: colors.textSecondary,
                flexShrink: 0,
              }}
            >
              <span style={{ fontWeight: 500 }}>{selectedIds.size}件選択中</span>
              <div ref={bulkDismissRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowBulkDismissComposer((prev) => !prev)}
                  style={{
                    padding: `${spacing.xs} ${spacing.sm}`,
                    border: `1px solid ${colors.border}`,
                    borderRadius: borderRadius.sm,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: fontSize.sm,
                    cursor: "pointer",
                  }}
                >
                  一括解決
                </button>
                {showBulkDismissComposer && bulkDismissAlerts.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      width: "340px",
                      maxWidth: "calc(100vw - 32px)",
                      zIndex: 10,
                    }}
                  >
                    <DismissComposer
                      alerts={bulkDismissAlerts.map((alert) => ({
                        id: alert.id,
                        title: alert.title,
                        domain: alert.domain,
                        severity: alert.severity,
                      }))}
                      onConfirm={(reason, comment) => {
                        applyDismiss(bulkDismissAlerts, reason, comment);
                        setShowBulkDismissComposer(false);
                      }}
                      onCancel={() => setShowBulkDismissComposer(false)}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  border: "none",
                  background: "transparent",
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                選択解除
              </button>
            </div>
          )}

          {/* Select all */}
          {!showDismissed && filtered.length > 0 && (
            <div
              style={{
                padding: `${spacing.xs} ${spacing.lg}`,
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                fontSize: fontSize.xs,
                color: colors.textMuted,
                background: colors.bgSecondary,
                flexShrink: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", accentColor: colors.interactive }}
              />
              <span>{filtered.length}件のアラート</span>
            </div>
          )}

          {/* List body (no card wrapper) */}
          <HostListBody>
            {showDismissed ? (
              <DismissedView
                records={dismissRecords.filter((r) => r.reopenedAt == null)}
                onReopen={handleReopen}
              />
            ) : alerts.length === 0 ? (
              <EmptyState
                title="検出されたアラートはありません"
                description="セキュリティ上の問題がなく、安全な状態です"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="一致するアラートがありません"
                description="検索条件やフィルタを変更してください"
              />
            ) : (
              filtered.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  isSelected={selectedIds.has(alert.id)}
                  isActive={activeAlertId === alert.id}
                  onSelect={handleSelect}
                  onOpen={() =>
                    setActiveAlertId((prev) =>
                      prev === alert.id ? null : alert.id,
                    )
                  }
                  onReportBug={() => handleReportBug(alert)}
                  onDismissConfirm={(reason, comment) =>
                    applyDismiss([alert], reason, comment)
                  }
                />
              ))
            )}
          </HostListBody>
        </HostListPane>

        <HostDetailPane>
          {activeAlert ? (
            <AlertDetailContent
              alert={activeAlert}
              onReportBug={() => handleReportBug(activeAlert)}
              onDismissConfirm={(reason, comment) => {
                applyDismiss([activeAlert], reason, comment);
                setActiveAlertId(null);
              }}
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
              リストからアラートを選択して詳細を表示
            </div>
          )}
        </HostDetailPane>
      </HostPane>
    </div>
  );
}
