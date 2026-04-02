import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { AlertSeverity, AlertCategory } from "libztbs/alerts";
import {
  AlertRowMenu,
  Badge,
  SearchInput,
  EmptyState,
  LoadingState,
} from "../../../components";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme, spacing, fontSize, borderRadius } from "../../../lib/theme";
import { sendMessage } from "../../../lib/messaging";

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

const categoryLabels: Record<string, string> = {
  nrd: "NRD",
  typosquat: "Typosquat",
  ai_sensitive: "AI",
  csp_violation: "CSP",
  shadow_ai: "DoH",
  network: "Net",
  data_exfiltration: "Exfil",
  credential_theft: "Cred",
  xss_injection: "XSS",
  dom_scraping: "DOM",
  clipboard_hijack: "Clip",
  suspicious_download: "DL",
  canvas_fingerprint: "Canvas",
  webgl_fingerprint: "WebGL",
  audio_fingerprint: "Audio",
  tracking_beacon: "Beacon",
  supply_chain: "Supply",
  dynamic_code_execution: "Eval",
  fullscreen_phishing: "Phish",
  clipboard_read: "Clip",
  geolocation_access: "Geo",
  websocket_connection: "WS",
  webrtc_connection: "RTC",
  broadcast_channel: "BC",
  send_beacon: "Beacon",
  media_capture: "Media",
  notification_phishing: "Notify",
  credential_api: "Cred API",
  device_sensor: "Sensor",
  device_enumeration: "DevEnum",
  storage_exfiltration: "Storage",
  prototype_pollution: "Proto",
  dns_prefetch_leak: "DNS",
  form_hijack: "FormHijack",
  css_keylogging: "CSSKey",
  performance_observer: "PerfObs",
  postmessage_exfil: "PostMsg",
  dom_clobbering: "DOMClob",
  cache_api_abuse: "Cache",
  fetch_exfiltration: "FetchExfil",
  wasm_execution: "WASM",
  intersection_observer: "IO",
  indexeddb_abuse: "IDB",
  history_manipulation: "History",
  message_channel: "MsgCh",
  resize_observer: "ResizeObs",
  execcommand_clipboard: "ExecCmd",
  eventsource_channel: "SSE",
  font_fingerprint: "Font",
  idle_callback_timing: "Idle",
  clipboard_event_sniffing: "ClipSniff",
  drag_event_sniffing: "DragSniff",
  selection_sniffing: "SelSniff",
};

const severityButtons: { key: AlertSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "info", label: "Info" },
];

function SeverityBar({ severity }: { severity: AlertSeverity }) {
  const { colors } = useTheme();
  const colorMap: Record<AlertSeverity, string> = {
    critical: colors.dot.danger,
    high: colors.dot.warning,
    medium: colors.dot.info,
    low: colors.dot.success,
    info: colors.dot.default,
  };
  return (
    <span
      style={{
        width: "3px",
        alignSelf: "stretch",
        borderRadius: "2px",
        background: colorMap[severity],
        flexShrink: 0,
      }}
    />
  );
}

function AlertRow({
  alert,
  isSelected,
  onSelect,
  isExpanded,
  onToggleExpand,
  onReportFP,
  onDismiss,
}: {
  alert: AlertItem;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReportFP: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const detailEntries = Object.entries(alert.details ?? {}).filter(
    ([k]) => k !== "type",
  );

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderBottom: `1px solid ${colors.borderLight}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          padding: `${spacing.sm} ${spacing.lg}`,
          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            onSelect(alert.id, (e.target as HTMLInputElement).checked)
          }
          style={{ flexShrink: 0, cursor: "pointer", accentColor: colors.interactive }}
        />

        {/* Severity bar */}
        <SeverityBar severity={alert.severity} />

        {/* Severity badge */}
        <Badge variant={severityVariant[alert.severity]} size="sm">
          {alert.severity}
        </Badge>

        {/* Category */}
        <Badge variant="info" size="sm">
          {categoryLabels[alert.category] ?? alert.category}
        </Badge>

        {/* Count */}
        {(alert.count ?? 1) > 1 && (
          <span
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              fontWeight: 600,
            }}
          >
            x{alert.count}
          </span>
        )}

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <code
            style={{
              fontSize: fontSize.md,
              fontFamily: "monospace",
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
            title={alert.title}
          >
            {truncate(alert.title, 50)}
          </code>
          <span
            style={{
              fontSize: fontSize.sm,
              color: colors.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {alert.domain}
            {alert.description && ` — ${truncate(alert.description, 60)}`}
          </span>
        </div>

        {/* Timestamp */}
        <span
          style={{
            fontSize: fontSize.sm,
            color: colors.textMuted,
            flexShrink: 0,
          }}
        >
          {new Date(alert.timestamp).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* Actions */}
        <AlertRowMenu onReportFP={onReportFP} onDismiss={onDismiss} />
      </div>

      {/* Expanded details */}
      {isExpanded && detailEntries.length > 0 && (
        <div
          style={{
            padding: `0 ${spacing.lg} ${spacing.sm} 48px`,
            background: colors.bgSecondary,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "2px 12px",
              fontSize: fontSize.sm,
              fontFamily: "monospace",
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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
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
    </div>
  );
}

export function AlertsTab() {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Initial search query from Services tab navigation
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

  const [dismissedPatterns, setDismissedPatterns] = useState<Set<string>>(
    new Set(),
  );

  const buildIssueUrl = useCallback((alert: AlertItem) => {
    const label = categoryLabels[alert.category] ?? alert.category;
    const title = `[FP] ${label}: ${alert.title}`;
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
      "## False Positive Report",
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
      "## Why is this a false positive?",
      "",
      "<!-- Please describe why this alert is incorrect -->",
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

  const handleReportFP = useCallback(
    (alert: AlertItem) => {
      const url = buildIssueUrl(alert);
      chrome.tabs.create({ url });
    },
    [buildIssueUrl],
  );

  const handleDismiss = useCallback((alert: AlertItem) => {
    const pattern = `${alert.category}::${alert.domain}`;
    sendMessage({
      type: "DISMISS_ALERT_PATTERN",
      data: { category: alert.category, domain: alert.domain },
    }).catch(() => {});
    setDismissedPatterns((prev) => new Set(prev).add(pattern));
  }, []);

  const handleBulkDismiss = useCallback(() => {
    const toDismiss = alerts.filter((a) => selectedIds.has(a.id));
    const patterns = new Set<string>();
    for (const a of toDismiss) {
      const pattern = `${a.category}::${a.domain}`;
      patterns.add(pattern);
      sendMessage({
        type: "DISMISS_ALERT_PATTERN",
        data: { category: a.category, domain: a.domain },
      }).catch(() => {});
    }
    setDismissedPatterns((prev) => {
      const next = new Set(prev);
      for (const p of patterns) next.add(p);
      return next;
    });
    setSelectedIds(new Set());
  }, [alerts, selectedIds]);

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

  const allSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  }, [allSelected, filtered]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div style={{ marginBottom: "32px" }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: spacing.sm,
          alignItems: "center",
          marginBottom: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="タイトル・ドメインで検索..."
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
      </div>

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
          <button
            type="button"
            onClick={handleBulkDismiss}
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
            一括無視
          </button>
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
      {filtered.length === 0 ? (
        <EmptyState
          title="検出されたアラートはありません"
          description="セキュリティアラートが検出されると、重要度順に表示されます"
        />
      ) : (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.lg,
            overflow: "hidden",
          }}
        >
          {/* List header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.lg}`,
              background: colors.bgSecondary,
              borderBottom: `1px solid ${colors.border}`,
              fontSize: fontSize.sm,
              color: colors.textSecondary,
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              style={{ cursor: "pointer", accentColor: colors.interactive }}
            />
            <span style={{ flex: 1 }}>
              {filtered.length}件のアラート（重要度順）
            </span>
          </div>

          {/* Alert rows */}
          {filtered.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isSelected={selectedIds.has(alert.id)}
              onSelect={handleSelect}
              isExpanded={expandedIds.has(alert.id)}
              onToggleExpand={() => {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(alert.id)) next.delete(alert.id);
                  else next.add(alert.id);
                  return next;
                });
              }}
              onReportFP={() => handleReportFP(alert)}
              onDismiss={() => handleDismiss(alert)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
