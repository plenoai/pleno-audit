import { useEffect, useMemo, useState } from "preact/hooks";
import type { AlertSeverity, AlertCategory } from "@libztbs/alerts";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { truncate } from "../utils";
import { useTheme } from "../../../lib/theme";
import { sendMessage } from "../../../lib/messaging";

interface AlertItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  timestamp: number;
  details?: Record<string, unknown>;
  count?: number;
}

const severityVariant: Record<AlertSeverity, "danger" | "warning" | "info"> = {
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

export function AlertsTab() {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
    sendMessage<{ events: AlertItem[]; counts: Record<string, number> }>({
      type: "GET_POPUP_EVENTS",
    })
      .then((res) => {
        setAlerts(res.events);
        setCounts(res.counts);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeSeverities = useMemo(
    () => severityButtons.filter((b) => filters[b.key]).map((b) => b.key),
    [filters],
  );

  const filtered = useMemo(() => {
    let result = alerts;

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

    return result;
  }, [alerts, activeSeverities, searchQuery]);

  if (loading) {
    return (
      <div
        style={{
          padding: "48px 0",
          textAlign: "center",
          color: colors.textMuted,
        }}
      >
        読み込み中...
      </div>
    );
  }

  return (
    <FilteredTab
      data={filtered}
      rowKey={(a) => a.id}
      rowHighlight={(a) => severityVariant[a.severity] ?? false}
      onRowClick={(a) => toggleExpand(a.id)}
      expandRow={(a) => {
        if (!expandedIds.has(a.id)) return null;
        const details = a.details ?? {};
        const detailEntries = Object.entries(details).filter(
          ([k]) => k !== "type",
        );
        return (
          <div
            style={{
              background: colors.bgSecondary,
              padding: "8px 16px 8px 48px",
              borderBottom: `1px solid ${colors.borderLight}`,
            }}
          >
            {a.description && (
              <div
                style={{
                  fontSize: "12px",
                  color: colors.textSecondary,
                  marginBottom: detailEntries.length > 0 ? "6px" : 0,
                }}
              >
                {a.description}
              </div>
            )}
            {detailEntries.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "2px 12px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              >
                {detailEntries.map(([key, value]) => (
                  <>
                    <span
                      key={`${key}-label`}
                      style={{ color: colors.textMuted }}
                    >
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
            )}
          </div>
        );
      }}
      emptyMessage="検出されたアラートはありません"
      filterBar={
        <>
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
        </>
      }
      columns={[
        {
          key: "severity",
          header: "重要度",
          width: "80px",
          render: (a) => (
            <Badge variant={severityVariant[a.severity]} size="sm">
              {a.severity}
            </Badge>
          ),
        },
        {
          key: "category",
          header: "カテゴリ",
          width: "100px",
          render: (a) => (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Badge variant="info" size="sm">
                {categoryLabels[a.category] ?? a.category}
              </Badge>
              {(a.count ?? 1) > 1 && (
                <span
                  style={{
                    fontSize: "10px",
                    color: colors.textMuted,
                    fontWeight: 600,
                  }}
                  title={`${a.count} 回検出`}
                >
                  x{a.count}
                </span>
              )}
            </span>
          ),
        },
        {
          key: "title",
          header: "対象",
          render: (a) => (
            <code
              style={{
                fontSize: "12px",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
              title={a.title}
            >
              {truncate(a.title, 60)}
            </code>
          ),
        },
        {
          key: "timestamp",
          header: "時刻",
          width: "80px",
          render: (a) =>
            new Date(a.timestamp).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            }),
        },
      ]}
    />
  );
}
