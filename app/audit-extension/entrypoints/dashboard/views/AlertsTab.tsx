import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ALL_PLAYBOOKS, type AlertSeverity, type AlertCategory, type DismissReason, type DismissRecord, type PlaybookData } from "libztbs/alerts";
import {
  AlertRowMenu,
  Badge,
  DismissComposer,
  SearchInput,
  EmptyState,
  LoadingState,
  FilterBar,
  ListContainer,
  ListHeader,
  ListRow,
  PagedList,
  ScrollArea,
  TabRoot,
  usePagination,
} from "../../../components";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";
import { sendMessage } from "../../../lib/messaging";
import { useAnimationEnabled } from "../../../lib/motion";
import { DISMISS_REASON_LABELS } from "../../../lib/dismiss-reasons";
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

const severityVariant: Record<
  AlertSeverity,
  "danger" | "warning" | "info"
> = {
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

function AlertDetailSidebar({
  alert,
  onClose,
  onReportBug,
  onDismissConfirm,
}: {
  alert: AlertItem;
  onClose: () => void;
  onReportBug: () => void;
  onDismissConfirm: (reason: DismissReason, comment: string) => void;
}) {
  const { colors } = useTheme();
  const animationEnabled = useAnimationEnabled();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dismissPopoverRef = useRef<HTMLDivElement>(null);
  const [showDismissComposer, setShowDismissComposer] = useState(false);
  const detailEntries = Object.entries(alert.details ?? {}).filter(
    ([k]) => k !== "type",
  );

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el || !animationEnabled) return;
    el.style.transform = "translateX(100%)";
    el.style.opacity = "0";
    requestAnimationFrame(() => {
      el.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
    });
  }, [alert, animationEnabled]);

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

  return (
    <div
      ref={sidebarRef}
      style={{
        width: "420px",
        minWidth: "420px",
        marginLeft: "auto",
        background: colors.bgPrimary,
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing.md} ${spacing.lg}`,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: fontSize.lg,
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          アラート詳細
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "20px",
            color: colors.textMuted,
            padding: spacing.xs,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: spacing.lg,
        }}
      >
        {/* Title */}
        <code
          style={{
            fontSize: fontSize.lg,
            fontFamily: "monospace",
            color: colors.textPrimary,
            display: "block",
            wordBreak: "break-all",
            marginBottom: spacing.sm,
          }}
        >
          {alert.title}
        </code>

        {/* Badges + actions row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
          }}
        >
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
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
          </div>
          <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onReportBug}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.sm,
                background: colors.bgPrimary,
                color: colors.textSecondary,
                fontSize: fontSize.sm,
                cursor: "pointer",
              }}
            >
              バグを報告
            </button>
            <div ref={dismissPopoverRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowDismissComposer((prev) => !prev)}
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  background: colors.bgPrimary,
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
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
                      onClose();
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
          <p
            style={{
              fontSize: fontSize.md,
              color: colors.textSecondary,
              marginBottom: spacing.md,
              lineHeight: 1.5,
            }}
          >
            {alert.description}
          </p>
        )}

        {/* Meta */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 12px",
            fontSize: fontSize.sm,
            fontFamily: "monospace",
            padding: spacing.md,
            background: colors.bgSecondary,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.border}`,
            marginBottom: spacing.md,
          }}
        >
          <span style={{ color: colors.textMuted }}>domain:</span>
          <span style={{ color: colors.textPrimary, wordBreak: "break-all" }}>
            {alert.domain}
          </span>
          {alert.url && (
            <>
              <span style={{ color: colors.textMuted }}>url:</span>
              <span style={{ color: colors.textPrimary, wordBreak: "break-all" }}>
                {alert.url}
              </span>
            </>
          )}
          <span style={{ color: colors.textMuted }}>timestamp:</span>
          <span style={{ color: colors.textPrimary }}>
            {new Date(alert.timestamp).toLocaleString("ja-JP")}
          </span>
        </div>

        {/* Alert-specific details */}
        {detailEntries.length > 0 && (
          <div style={{ marginBottom: spacing.md }}>
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: 600,
                color: colors.textSecondary,
                display: "block",
                marginBottom: spacing.sm,
              }}
            >
              検出パラメータ
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "4px 12px",
                fontSize: fontSize.sm,
                fontFamily: "monospace",
                padding: spacing.md,
                background: colors.bgSecondary,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.border}`,
              }}
            >
              {detailEntries.map(([key, value]) => (
                <>
                  <span key={`${key}-label`} style={{ color: colors.textMuted }}>
                    {key}:
                  </span>
                  <span
                    key={`${key}-value`}
                    style={{
                      color: colors.textPrimary,
                      wordBreak: "break-all",
                    }}
                    title={String(value)}
                  >
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* Playbook: response steps */}
        {PLAYBOOK_DATA[alert.category] && (
          <div style={{ marginBottom: spacing.md }}>
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: 600,
                color: colors.textSecondary,
                display: "block",
                marginBottom: spacing.sm,
              }}
            >
              対応方針
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
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
          </div>
        )}

        {/* Playbook: prevention */}
        {PLAYBOOK_DATA[alert.category] && (
          <div style={{ marginBottom: spacing.md }}>
            <span
              style={{
                fontSize: fontSize.sm,
                fontWeight: 600,
                color: colors.textSecondary,
                display: "block",
                marginBottom: spacing.sm,
              }}
            >
              予防策
            </span>
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
          </div>
        )}

        {/* External link */}
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
    </div>
  );
}

export { AlertDetailSidebar };

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
        title="Dismiss 済みアラートはありません"
        description="アラートを Dismiss すると、ここに表示されます"
      />
    );
  }

  return (
    <ListContainer>
      <ListHeader>
        {records.length}件の Dismiss 済みアラート
      </ListHeader>
      <ScrollArea>
        {records.map((record) => {
          const reasonInfo = DISMISS_REASON_LABELS[record.reason] ?? { label: record.reason, description: "" };
          return (
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
                  <Badge variant="info" size="sm">
                    {reasonInfo.label}
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
          );
        })}
      </ScrollArea>
    </ListContainer>
  );
}

export interface AlertSidebarState {
  alert: AlertItem;
  onClose: () => void;
  onReportBug: () => void;
  onDismissConfirm: (reason: DismissReason, comment: string) => void;
}

export function AlertsTab({ onSidebarChange }: { onSidebarChange?: (state: AlertSidebarState | null) => void }) {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [showBulkDismissComposer, setShowBulkDismissComposer] = useState(false);
  const bulkDismissRef = useRef<HTMLDivElement>(null);

  // Initial search query from Services tab navigation
  const initialQuery = useMemo(() => {
    const stored = sessionStorage.getItem("alertDomainFilter");
    if (stored) {
      sessionStorage.removeItem("alertDomainFilter");
      return stored;
    }
    return "";
  }, []);

  const { searchQuery, setSearchQuery, filters, setFilter, resetAll } = useTabFilter<
    Record<AlertSeverity, boolean>
  >({
    critical: false,
    high: false,
    medium: false,
    low: false,
    info: false,
  });

  // Apply initial domain filter
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery, setSearchQuery]);

  // Listen for domain filter events from Services tab
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

      // Refresh dismiss records
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
    // Refresh dismiss records
    sendMessage<Array<{
      pattern: string;
      reason: DismissReason;
      comment?: string;
      dismissedAt: number;
      reopenedAt?: number;
      alertSnapshot: { category: string; domain: string; severity: string; title: string };
    }>>({ type: "GET_DISMISS_RECORDS" })
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

    // Sort by severity (most critical first), then by timestamp (newest first)
    result = [...result].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.timestamp - a.timestamp,
    );

    return result;
  }, [alerts, activeSeverities, searchQuery, dismissedPatterns]);

  const { currentPage, setCurrentPage, totalPages, paged, pageSize } =
    usePagination(filtered, [activeSeverities, searchQuery, dismissedPatterns]);

  const allSelected =
    paged.length > 0 && paged.every((a) => selectedIds.has(a.id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((a) => a.id)));
    }
  }, [allSelected, paged]);

  const activeAlert = activeAlertId
    ? alerts.find((a) => a.id === activeAlertId) ?? null
    : null;

  useEffect(() => {
    if (!onSidebarChange) return;
    if (activeAlert) {
      onSidebarChange({
        alert: activeAlert,
        onClose: () => setActiveAlertId(null),
        onReportBug: () => handleReportBug(activeAlert),
        onDismissConfirm: (reason, comment) => {
          applyDismiss([activeAlert], reason, comment);
          setActiveAlertId(null);
        },
      });
    } else {
      onSidebarChange(null);
    }
  }, [activeAlert, onSidebarChange, handleReportBug, applyDismiss]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <TabRoot>
        {/* Filter bar */}
        <FilterBar>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="タイトル・ドメインで検索... (/)"
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
            <>
              <span
                style={{
                  display: "inline-block",
                  width: "1px",
                  height: "20px",
                  background: colors.border,
                  marginInline: spacing.xs,
                  flexShrink: 0,
                }}
              />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: spacing.xs,
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  checked={showDismissed}
                  onChange={() => setShowDismissed((v) => !v)}
                  style={{ accentColor: colors.interactive, cursor: "pointer" }}
                />
                Dismissed ({dismissRecords.filter((r) => r.reopenedAt == null).length})
              </label>
            </>
          )}
        </FilterBar>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              alignItems: "center",
              padding: `${spacing.sm} ${spacing.lg}`,
              marginBottom: spacing.sm,
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              fontSize: fontSize.md,
              color: colors.textSecondary,
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {selectedIds.size}件選択中
            </span>
            <div ref={bulkDismissRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() =>
                  setShowBulkDismissComposer((prev) => !prev)
                }
                style={{
                  padding: `${spacing.xs} ${spacing.sm}`,
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  fontSize: fontSize.md,
                  cursor: "pointer",
                }}
              >
                一括 Dismiss
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
                fontSize: fontSize.md,
                cursor: "pointer",
              }}
            >
              選択解除
            </button>
          </div>
        )}

        {/* Alert list */}
        {showDismissed ? (
          <DismissedView
            records={dismissRecords.filter((r) => r.reopenedAt == null)}
            onReopen={handleReopen}
          />
        ) : (
          <PagedList
            allCount={alerts.length}
            filteredCount={filtered.length}
            countLabel="アラート"
            emptyTitle="検出されたアラートはありません"
            emptyDescription="セキュリティ上の問題がなく、安全な状態です"
            onResetFilter={resetAll}
            headerLeading={
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                style={{ cursor: "pointer", accentColor: colors.interactive }}
              />
            }
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          >
            {paged.map((alert) => (
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
            ))}
          </PagedList>
        )}
    </TabRoot>
  );
}
