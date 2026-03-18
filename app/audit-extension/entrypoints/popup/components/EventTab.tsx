import { useMemo, useState } from "preact/hooks";
import type { DetectedService, CapturedAIPrompt } from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DoHRequestRecord } from "@pleno-audit/extension-runtime";
import type { AlertSeverity, AlertCategory } from "@pleno-audit/detectors";
import { analyzePrompt } from "@pleno-audit/detectors";
import { Badge, Button } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface EventTabProps {
  services: DetectedService[];
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
  aiPrompts: CapturedAIPrompt[];
  doHRequests: DoHRequestRecord[];
}

interface EventItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  domain: string;
  timestamp: number;
}

function convertToEvents(
  services: DetectedService[],
  violations: CSPViolation[],
  networkRequests: NetworkRequest[],
  aiPrompts: CapturedAIPrompt[],
  doHRequests: DoHRequestRecord[]
): EventItem[] {
  const events: EventItem[] = [];

  for (const service of services) {
    if (service.nrdResult?.isNRD) {
      const age = service.nrdResult.domainAge;
      events.push({
        id: `nrd-${service.domain}`,
        category: "nrd",
        severity: age !== null && age < 7 ? "critical" : "high",
        title: service.domain,
        domain: service.domain,
        timestamp: service.nrdResult.checkedAt,
      });
    }
    if (service.typosquatResult?.isTyposquat) {
      const score = service.typosquatResult.totalScore;
      events.push({
        id: `typosquat-${service.domain}`,
        category: "typosquat",
        severity: score >= 70 ? "critical" : score >= 40 ? "high" : "medium",
        title: service.domain,
        domain: service.domain,
        timestamp: service.typosquatResult.checkedAt,
      });
    }
  }

  for (const prompt of aiPrompts) {
    const { pii, risk } = analyzePrompt(prompt.prompt);
    if (pii.hasSensitiveData) {
      if (risk.riskLevel !== "info" && risk.riskLevel !== "low") {
        events.push({
          id: `ai-${prompt.id}`,
          category: "ai_sensitive",
          severity: risk.riskLevel,
          title: prompt.provider || new URL(prompt.apiEndpoint).hostname,
          domain: new URL(prompt.apiEndpoint).hostname,
          timestamp: prompt.timestamp,
        });
      }
    }
  }

  for (const v of violations.slice(0, 50)) {
    events.push({
      id: `csp-${v.timestamp}-${v.blockedURL}`,
      category: "csp_violation",
      severity: v.directive === "script-src" || v.directive === "default-src" ? "high" : "medium",
      title: v.directive,
      domain: new URL(v.pageUrl).hostname,
      timestamp: new Date(v.timestamp).getTime(),
    });
  }

  for (const r of doHRequests.slice(0, 20)) {
    events.push({
      id: `doh-${r.id}`,
      category: "shadow_ai",
      severity: r.blocked ? "high" : "medium",
      title: r.domain,
      domain: r.domain,
      timestamp: r.timestamp,
    });
  }

  // Network requests (info level)
  for (const req of networkRequests.slice(0, 100)) {
    let domain: string;
    try {
      domain = new URL(req.url).hostname;
    } catch {
      domain = req.url;
    }
    events.push({
      id: `net-${req.timestamp}-${req.url}`,
      category: "network" as AlertCategory,
      severity: "info",
      title: `${req.method} ${domain}`,
      domain,
      timestamp: new Date(req.timestamp).getTime(),
    });
  }

  // Sort by timestamp descending (newest first)
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function getSeverityVariant(sev: AlertSeverity): "danger" | "warning" | "info" | "default" {
  switch (sev) {
    case "critical": case "high": return "danger";
    case "medium": return "warning";
    case "low": return "info";
    default: return "default";
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  nrd: "NRD",
  typosquat: "Typosquat",
  ai_sensitive: "AI",
  csp_violation: "CSP",
  shadow_ai: "DoH",
  network: "Net",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function EventTab({ services, violations, networkRequests, aiPrompts, doHRequests }: EventTabProps) {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const events = useMemo(
    () => convertToEvents(services, violations, networkRequests, aiPrompts, doHRequests),
    [services, violations, networkRequests, aiPrompts, doHRequests]
  );

  const counts = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    for (const e of events) {
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    }
    return bySeverity;
  }, [events]);

  const filtered = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    // Severity filter
    if (["critical", "high", "medium", "low", "info"].includes(q)) {
      return events.filter((e) => e.severity === q);
    }
    // Text search
    return events.filter((e) => e.title.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
  }, [events, searchQuery]);

  if (events.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>イベントはありません</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Filter Bar */}
      <div style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          placeholder="検索..."
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "6px 10px",
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            fontSize: "12px",
            background: colors.bgPrimary,
            color: colors.textPrimary,
            outline: "none",
          }}
        />
        {(counts.critical ?? 0) > 0 && (
          <Button
            variant={searchQuery === "critical" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "critical" ? "" : "critical")}
          >
            Critical ({counts.critical})
          </Button>
        )}
        {(counts.high ?? 0) > 0 && (
          <Button
            variant={searchQuery === "high" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "high" ? "" : "high")}
          >
            High ({counts.high})
          </Button>
        )}
        {(counts.medium ?? 0) > 0 && (
          <Button
            variant={searchQuery === "medium" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "medium" ? "" : "medium")}
          >
            Medium ({counts.medium})
          </Button>
        )}
        {(counts.info ?? 0) > 0 && (
          <Button
            variant={searchQuery === "info" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "info" ? "" : "info")}
          >
            Info ({counts.info})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <table style={{ ...styles.table, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "64px" }} />
            <col style={{ width: "72px" }} />
            <col />
            <col style={{ width: "48px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.tableHeader}>Severity</th>
              <th style={styles.tableHeader}>Category</th>
              <th style={styles.tableHeader}>Target</th>
              <th style={{ ...styles.tableHeader, textAlign: "right" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((e) => (
              <tr key={e.id} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <Badge variant={getSeverityVariant(e.severity)} size="sm">{e.severity}</Badge>
                </td>
                <td style={styles.tableCell}>
                  <Badge size="sm">{CATEGORY_LABELS[e.category] || e.category}</Badge>
                </td>
                <td style={{ ...styles.tableCell, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <code style={{ ...styles.code, background: "transparent", padding: 0 }} title={e.title}>{e.title}</code>
                </td>
                <td style={{ ...styles.tableCell, textAlign: "right", fontFamily: "monospace", fontSize: "11px", color: colors.textMuted }}>
                  {formatTime(e.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: colors.textMuted, borderTop: `1px solid ${colors.borderLight}` }}>
            +{filtered.length - 100} more
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: colors.textMuted }}>
            該当するイベントがありません
          </div>
        )}
      </div>
    </div>
  );
}
