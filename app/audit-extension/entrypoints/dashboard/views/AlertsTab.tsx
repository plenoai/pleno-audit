import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { ALL_PLAYBOOKS, type AlertSeverity, type AlertCategory, type PlaybookData } from "libztbs/alerts";
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

const PLAYBOOK_DATA: Record<string, PlaybookData> = Object.fromEntries(
  ALL_PLAYBOOKS.map((p) => [p.id, p]),
);


const severityButtons: { key: AlertSeverity; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "info", label: "Info" },
];

function AlertRow({
  alert,
  isSelected,
  isActive,
  onSelect,
  onOpen,
  onReportFP,
  onDismiss,
}: {
  alert: AlertItem;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: () => void;
  onReportFP: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        background: isActive ? colors.bgSecondary : colors.bgPrimary,
        borderBottom: `1px solid ${colors.borderLight}`,
        borderLeft: isActive ? `3px solid ${colors.interactive}` : "3px solid transparent",
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
        onClick={onOpen}
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
    </div>
  );
}

function AlertDetailSidebar({
  alert,
  onClose,
  onReportFP,
  onDismiss,
}: {
  alert: AlertItem;
  onClose: () => void;
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
        width: "420px",
        minWidth: "420px",
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
              {categoryLabels[alert.category] ?? alert.category}
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
              onClick={onReportFP}
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
              誤検知を報告
            </button>
            <button
              type="button"
              onClick={onDismiss}
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
              無視
            </button>
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
    </div>,
  );
}

export { AlertDetailSidebar };

export interface AlertSidebarState {
  alert: AlertItem;
  onClose: () => void;
  onReportFP: () => void;
  onDismiss: () => void;
}

export function AlertsTab({ onSidebarChange }: { onSidebarChange?: (state: AlertSidebarState | null) => void }) {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);

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
    const patternObjects = toDismiss.map((a) => ({
      category: a.category,
      domain: a.domain,
    }));
    const patternStrings = patternObjects.map(
      (p) => `${p.category}::${p.domain}`,
    );
    sendMessage({
      type: "DISMISS_ALERT_PATTERN",
      data: { patterns: patternObjects },
    }).catch(() => {});
    setDismissedPatterns((prev) => {
      const next = new Set(prev);
      for (const p of patternStrings) next.add(p);
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

  const activeAlert = activeAlertId
    ? alerts.find((a) => a.id === activeAlertId) ?? null
    : null;

  useEffect(() => {
    if (!onSidebarChange) return;
    if (activeAlert) {
      onSidebarChange({
        alert: activeAlert,
        onClose: () => setActiveAlertId(null),
        onReportFP: () => handleReportFP(activeAlert),
        onDismiss: () => {
          handleDismiss(activeAlert);
          setActiveAlertId(null);
        },
      });
    } else {
      onSidebarChange(null);
    }
  }, [activeAlert, onSidebarChange, handleReportFP, handleDismiss]);

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
            description="セキュリティアラートが検出されると表示されます"
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
                {filtered.length}件のアラート
              </span>
            </div>

            {/* Alert rows */}
            {filtered.map((alert) => (
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
                onReportFP={() => handleReportFP(alert)}
                onDismiss={() => handleDismiss(alert)}
              />
            ))}
          </div>
        )}
    </div>
  );
}
