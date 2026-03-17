import type { EventLogType } from "@pleno-audit/detectors";

export type EventCategory = "security" | "ai" | "policy" | "session" | "network";

type EventDefinition = {
  type: EventLogType;
  label: string;
  color: string;
  category: EventCategory;
};

const EVENT_DEFINITIONS: ReadonlyArray<EventDefinition> = [
  { type: "login_detected", label: "ログイン検出", color: "#3b82f6", category: "session" },
  { type: "privacy_policy_found", label: "プライバシーポリシー", color: "#22c55e", category: "policy" },
  { type: "terms_of_service_found", label: "利用規約", color: "#22c55e", category: "policy" },
  { type: "cookie_set", label: "Cookie設定", color: "#f59e0b", category: "session" },
  { type: "csp_violation", label: "CSP違反", color: "#ef4444", category: "security" },
  { type: "network_request", label: "ネットワーク", color: "#6b7280", category: "network" },
  { type: "ai_prompt_sent", label: "AIプロンプト", color: "#8b5cf6", category: "ai" },
  { type: "ai_response_received", label: "AIレスポンス", color: "#8b5cf6", category: "ai" },
  { type: "nrd_detected", label: "NRD検出", color: "#f97316", category: "security" },
  { type: "typosquat_detected", label: "タイポスクワット", color: "#dc2626", category: "security" },
  { type: "extension_request", label: "拡張機能リクエスト", color: "#06b6d4", category: "network" },
  { type: "ai_sensitive_data_detected", label: "AI機密情報検出", color: "#be185d", category: "security" },
];

const EVENT_LABELS = new Map<EventLogType, string>(
  EVENT_DEFINITIONS.map((definition) => [definition.type, definition.label])
);

const EVENT_COLORS = new Map<EventLogType, string>(
  EVENT_DEFINITIONS.map((definition) => [definition.type, definition.color])
);

export const EVENT_COLOR_MAP: Record<string, string> = Object.fromEntries(
  EVENT_DEFINITIONS.map((definition) => [definition.type, definition.color])
);

export const EVENT_CATEGORIES: Record<EventCategory, EventLogType[]> = {
  security: ["nrd_detected", "typosquat_detected", "csp_violation", "ai_sensitive_data_detected"],
  ai: ["ai_prompt_sent", "ai_response_received", "ai_sensitive_data_detected"],
  policy: ["privacy_policy_found", "terms_of_service_found"],
  session: ["login_detected", "cookie_set"],
  network: ["network_request", "extension_request"],
};

export const EVENT_FILTER_TYPES = [
  "csp_violation",
  "login_detected",
  "ai_prompt_sent",
  "nrd_detected",
] as const;

export function getEventLabel(type: string): string {
  return EVENT_LABELS.get(type as EventLogType) ?? type;
}

export function getEventColor(type: string): string | undefined {
  return EVENT_COLORS.get(type as EventLogType);
}

export function getEventBadgeVariant(type: string): "danger" | "warning" | "default" {
  if (type.includes("violation") || type.includes("nrd")) return "danger";
  if (type.includes("ai") || type.includes("login")) return "warning";
  return "default";
}

export const THREAT_EVENT_TYPES = [
  "nrd_detected",
  "typosquat_detected",
  "threat_intel_match",
  "DATA_EXFILTRATION_DETECTED",
  "CREDENTIAL_THEFT_DETECTED",
  "SUPPLY_CHAIN_RISK_DETECTED",
] as const;

export type ThreatEventType = (typeof THREAT_EVENT_TYPES)[number];

const THREAT_NOTIFICATION_CATALOG: Record<ThreatEventType, { severity: "critical" | "warning" | "info"; title: string }> = {
  DATA_EXFILTRATION_DETECTED: { severity: "critical", title: "データ漏洩の可能性" },
  CREDENTIAL_THEFT_DETECTED: { severity: "critical", title: "認証情報窃取の可能性" },
  threat_intel_match: { severity: "critical", title: "脅威インテリジェンス一致" },
  nrd_detected: { severity: "warning", title: "新規登録ドメイン検出" },
  typosquat_detected: { severity: "warning", title: "タイポスクワット検出" },
  SUPPLY_CHAIN_RISK_DETECTED: { severity: "warning", title: "サプライチェーンリスク" },
};

export function isThreatEventType(type: string): type is ThreatEventType {
  return (THREAT_EVENT_TYPES as readonly string[]).includes(type);
}

export function getThreatNotification(type: string) {
  if (!isThreatEventType(type)) return null;
  return THREAT_NOTIFICATION_CATALOG[type];
}
