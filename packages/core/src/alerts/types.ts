/**
 * @fileoverview Alert System Types
 *
 * Types for real-time security alerts and notifications.
 * Wiz-style alerting for immediate threat response.
 */

/**
 * Alert severity levels
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Alert categories
 */
export type AlertCategory =
  | "nrd" // Newly registered domain
  | "typosquat" // Typosquatting attempt
  | "data_leak" // Sensitive data exposure
  | "data_exfiltration" // Large data transfer (potential exfiltration)
  | "credential_theft" // Credential theft risk
  | "supply_chain" // Supply chain attack risk (missing SRI)
  | "csp_violation" // CSP policy violation
  | "ai_sensitive" // Sensitive data in AI prompt
  | "shadow_ai" // Unauthorized/unknown AI service
  | "extension" // Suspicious extension activity
  | "login" // Login on suspicious site
  | "policy" // Missing privacy/ToS policy
  | "policy_violation" // Enterprise policy violation
  | "tracking_beacon" // Tracking beacon detected
  | "clipboard_hijack" // Clipboard hijack attempt (crypto address)
  | "xss_injection" // XSS payload detected
  | "dom_scraping" // DOM scraping detected
  | "suspicious_download" // Suspicious file download
  | "canvas_fingerprint" // Canvas fingerprinting detected
  | "webgl_fingerprint" // WebGL fingerprinting detected
  | "audio_fingerprint" // AudioContext fingerprinting detected
  | "dynamic_code_execution" // Dynamic code execution (eval, Function)
  | "fullscreen_phishing" // Fullscreen phishing attempt
  | "clipboard_read" // Clipboard read attempt
  | "geolocation_access" // Geolocation API access
  | "websocket_connection" // Suspicious WebSocket connection
  | "webrtc_connection" // WebRTC connection (potential data leak)
  | "broadcast_channel" // BroadcastChannel covert communication
  | "send_beacon" // navigator.sendBeacon covert exfiltration
  | "media_capture" // getUserMedia/getDisplayMedia access
  | "notification_phishing" // Notification API phishing
  | "credential_api" // Credential Management API access
  | "device_sensor" // Device sensor access (motion/orientation)
  | "device_enumeration" // Media device enumeration
  | "storage_exfiltration" // localStorage/sessionStorage mass access
  | "prototype_pollution" // Prototype pollution attack (Object.prototype modification)
  | "dns_prefetch_leak" // DNS prefetch covert channel via dynamic link injection
  | "form_hijack" // Form action hijacking
  | "css_keylogging" // CSS input[value] attribute selector keylogging
  | "performance_observer" // PerformanceObserver resource timing side channel (kept for pipeline compat)
  | "postmessage_exfil" // postMessage cross-origin data exfiltration (kept for pipeline compat)
  | "dom_clobbering" // DOM clobbering — named elements shadowing window globals
  | "cache_api_abuse" // Cache API usage for persistence or cache poisoning (kept for pipeline compat)
  | "fetch_exfiltration" // fetch() cross-origin with large body payload (>10KB)
  | "wasm_execution" // WebAssembly instantiation/compilation of large modules (>1MB)
  | "intersection_observer" // IntersectionObserver bulk element surveillance (kept for pipeline compat)
  | "indexeddb_abuse" // IndexedDB.open() for covert data persistence (kept for pipeline compat)
  | "history_manipulation" // history.pushState/replaceState manipulation (kept for pipeline compat)
  | "message_channel" // MessageChannel constructor for covert communication (kept for pipeline compat)
  | "resize_observer" // ResizeObserver constructor for device fingerprinting (kept for pipeline compat)
  | "execcommand_clipboard" // document.execCommand clipboard bypass
  | "eventsource_channel" // EventSource covert C2 channel (kept for pipeline compat)
  | "font_fingerprint" // FontFace API font fingerprinting (kept for pipeline compat)
  | "idle_callback_timing" // requestIdleCallback timing side channel (kept for pipeline compat)
  | "clipboard_event_sniffing" // Clipboard event listener sniffing (copy/cut/paste) — burst >10 in 5s
  | "drag_event_sniffing" // Drag-and-drop event listener data theft (dragstart/drop) — burst >10 in 5s
  | "selection_sniffing" // Selection API keylogging (selectionchange) — burst >10 in 5s
  | "open_redirect" // Open redirect via URL parameter to external domain
  | "dlp_pii_detected"; // PII detected by pleno-anonymize DLP server

/**
 * Alert status
 */
export type AlertStatus =
  | "new" // Just created
  | "acknowledged" // User has seen it
  | "investigating" // Under investigation
  | "resolved" // Issue resolved
  | "dismissed"; // False positive / ignored

/**
 * Security alert
 */
export interface SecurityAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  domain: string;
  /** Full page URL where the alert was triggered */
  url?: string;
  timestamp: number;
  details: AlertDetails;
  actions: AlertAction[];
  metadata?: Record<string, unknown>;
  /** Number of duplicate alerts merged into this one (1 = no duplicates) */
  count?: number;
}

/**
 * Alert details by category
 */
export type AlertDetails =
  | NRDAlertDetails
  | TyposquatAlertDetails
  | DataLeakAlertDetails
  | DataExfiltrationAlertDetails
  | CredentialTheftAlertDetails
  | SupplyChainAlertDetails
  | CSPAlertDetails
  | AISensitiveAlertDetails
  | ShadowAIAlertDetails
  | ExtensionAlertDetails
  | LoginAlertDetails
  | PolicyAlertDetails
  | PolicyViolationAlertDetails
  | TrackingBeaconAlertDetails
  | ClipboardHijackAlertDetails
  | XSSInjectionAlertDetails
  | DOMScrapingAlertDetails
  | SuspiciousDownloadAlertDetails
  | CanvasFingerprintAlertDetails
  | WebGLFingerprintAlertDetails
  | AudioFingerprintAlertDetails
  | DynamicCodeExecutionAlertDetails
  | FullscreenPhishingAlertDetails
  | SendBeaconAlertDetails
  | MediaCaptureAlertDetails
  | NotificationPhishingAlertDetails
  | CredentialAPIAlertDetails
  | DeviceSensorAlertDetails
  | DeviceEnumerationAlertDetails
  | StorageExfiltrationAlertDetails
  | ClipboardReadAlertDetails
  | GeolocationAccessAlertDetails
  | WebSocketConnectionAlertDetails
  | WebRTCConnectionAlertDetails
  | BroadcastChannelAlertDetails
  | PrototypePollutionAlertDetails
  | DNSPrefetchLeakAlertDetails
  | FormHijackAlertDetails
  | CSSKeyloggingAlertDetails
  | PerformanceObserverAlertDetails
  | PostMessageExfilAlertDetails
  | DOMClobberingAlertDetails
  | CacheAPIAbuseAlertDetails
  | FetchExfiltrationAlertDetails
  | WASMExecutionAlertDetails
  | IntersectionObserverAlertDetails
  | IndexedDBAbuseAlertDetails
  | HistoryManipulationAlertDetails
  | MessageChannelAlertDetails
  | ResizeObserverAlertDetails
  | ExecCommandClipboardAlertDetails
  | EventSourceChannelAlertDetails
  | FontFingerprintAlertDetails
  | IdleCallbackTimingAlertDetails
  | ClipboardEventSniffingAlertDetails
  | DragEventSniffingAlertDetails
  | SelectionSniffingAlertDetails
  | OpenRedirectAlertDetails
  | DLPPIIDetectedAlertDetails;

export interface NRDAlertDetails {
  type: "nrd";
  domainAge: number | null;
  registrationDate: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
}

export interface TyposquatAlertDetails {
  type: "typosquat";
  targetDomain?: string;
  homoglyphCount: number;
  confidence: "high" | "medium" | "low" | "none";
}

export interface DataLeakAlertDetails {
  type: "data_leak";
  dataTypes: string[];
  destination: string;
  maskedSample?: string;
}

export interface CSPAlertDetails {
  type: "csp";
  directive: string;
  blockedURL: string;
  violationCount: number;
}

export interface AISensitiveAlertDetails {
  type: "ai_sensitive";
  provider: string;
  model?: string;
  dataTypes: string[];
}

export interface ShadowAIAlertDetails {
  type: "shadow_ai";
  provider: string;
  providerDisplayName: string;
  category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
  riskLevel: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  model?: string;
}

export interface ExtensionAlertDetails {
  type: "extension";
  extensionId: string;
  extensionName: string;
  riskScore: number;
  flags: string[];
  requestCount: number;
  targetDomains: string[];
}

export interface LoginAlertDetails {
  type: "login";
  hasForm: boolean;
  isNRD: boolean;
  isTyposquat: boolean;
}

export interface PolicyAlertDetails {
  type: "policy";
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasLogin: boolean;
}

export interface DataExfiltrationAlertDetails {
  type: "data_exfiltration";
  sourceDomain: string;
  targetDomain: string;
  bodySize: number;
  sizeKB: number;
  method: string;
  initiator: string;
  sensitiveDataTypes?: string[];
}

export interface CredentialTheftAlertDetails {
  type: "credential_theft";
  sourceDomain: string;
  targetDomain: string;
  formAction: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
}

export interface SupplyChainAlertDetails {
  type: "supply_chain";
  pageDomain: string;
  resourceUrl: string;
  resourceDomain: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
}

export interface PolicyViolationAlertDetails {
  type: "policy_violation";
  ruleId: string;
  ruleName: string;
  ruleType: "domain" | "tool" | "ai" | "data_transfer";
  action: "allow" | "warn";
  matchedPattern: string;
  target: string;
}

export interface TrackingBeaconAlertDetails {
  type: "tracking_beacon";
  sourceDomain: string;
  targetDomain: string;
  url: string;
  bodySize: number;
  initiator: string;
}

export interface ClipboardHijackAlertDetails {
  type: "clipboard_hijack";
  domain: string;
  cryptoType: string;
  textPreview: string;
}

export interface XSSInjectionAlertDetails {
  type: "xss_injection";
  domain: string;
  injectionType: string;
  payloadPreview: string;
}

export interface DOMScrapingAlertDetails {
  type: "dom_scraping";
  domain: string;
  selector: string;
  callCount: number;
}

export interface SuspiciousDownloadAlertDetails {
  type: "suspicious_download";
  domain: string;
  downloadType: string;
  filename: string;
  extension: string;
  size: number;
  mimeType: string;
  /** ダウンロード元URL */
  downloadUrl?: string;
}

export interface CanvasFingerprintAlertDetails {
  type: "canvas_fingerprint";
  domain: string;
  callCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface WebGLFingerprintAlertDetails {
  type: "webgl_fingerprint";
  domain: string;
  parameter: number;
}

export interface AudioFingerprintAlertDetails {
  type: "audio_fingerprint";
  domain: string;
  contextCount: number;
  sampleRate?: number;
}

export interface SendBeaconAlertDetails {
  type: "send_beacon";
  domain: string;
  url: string;
  targetDomain: string;
  dataSize: number;
}

export interface MediaCaptureAlertDetails {
  type: "media_capture";
  domain: string;
  method: string;
  audio: boolean;
  video: boolean;
}

export interface NotificationPhishingAlertDetails {
  type: "notification_phishing";
  domain: string;
  title: string;
  body?: string;
}

export interface StorageExfiltrationAlertDetails {
  type: "storage_exfiltration";
  domain: string;
  storageType: string;
  accessCount: number;
}

export interface CredentialAPIAlertDetails {
  type: "credential_api";
  domain: string;
  method: string;
  /** パスワード認証情報の取得を要求しているか */
  hasPassword?: boolean;
  /** フェデレーション認証（WebAuthn等）を要求しているか */
  hasFederated?: boolean;
}

export interface DeviceSensorAlertDetails {
  type: "device_sensor";
  domain: string;
  sensorType: string;
}

export interface DeviceEnumerationAlertDetails {
  type: "device_enumeration";
  domain: string;
}

export interface DynamicCodeExecutionAlertDetails {
  type: "dynamic_code_execution";
  domain: string;
  method: string;
  codeLength: number;
  /** 実行コードの先頭プレビュー（最大200文字） */
  codePreview?: string;
}

export interface FullscreenPhishingAlertDetails {
  type: "fullscreen_phishing";
  domain: string;
  element: string;
  elementId?: string;
  className?: string;
}

export interface ClipboardReadAlertDetails {
  type: "clipboard_read";
  domain: string;
}

export interface GeolocationAccessAlertDetails {
  type: "geolocation_access";
  domain: string;
  method: string;
  highAccuracy: boolean;
}

export interface WebSocketConnectionAlertDetails {
  type: "websocket_connection";
  domain: string;
  hostname: string;
  wsUrl?: string;
  protocol?: string;
  isExternal: boolean;
}

export interface WebRTCConnectionAlertDetails {
  type: "webrtc_connection";
  domain: string;
}

export interface BroadcastChannelAlertDetails {
  type: "broadcast_channel";
  domain: string;
  channelName: string;
}

export interface PrototypePollutionAlertDetails {
  type: "prototype_pollution";
  domain: string;
  target: string;
  property: string;
  method: string;
}

export interface DNSPrefetchLeakAlertDetails {
  type: "dns_prefetch_leak";
  domain: string;
  rel: string;
  href: string;
  /** 漏洩先ドメイン（hrefから導出） */
  targetDomain: string;
}

export interface FormHijackAlertDetails {
  type: "form_hijack";
  domain: string;
  originalAction: string;
  newAction: string;
  targetDomain: string;
}

export interface CSSKeyloggingAlertDetails {
  type: "css_keylogging";
  domain: string;
  sampleRule: string;
}

export interface PerformanceObserverAlertDetails {
  type: "performance_observer";
  domain: string;
  entryType: string;
}

export interface PostMessageExfilAlertDetails {
  type: "postmessage_exfil";
  domain: string;
  targetOrigin: string;
}

export interface DOMClobberingAlertDetails {
  type: "dom_clobbering";
  domain: string;
  attributeName: string;
  attributeValue: string;
}

export interface CacheAPIAbuseAlertDetails {
  type: "cache_api_abuse";
  domain: string;
  operation: string;
  cacheName: string;
  url?: string;
}

export interface FetchExfiltrationAlertDetails {
  type: "fetch_exfiltration";
  domain: string;
  url: string;
  targetDomain: string;
  mode: string;
  reason: string;
  bodySize?: number;
}

export interface WASMExecutionAlertDetails {
  type: "wasm_execution";
  domain: string;
  method: string;
  byteLength: number | null;
}

export interface IntersectionObserverAlertDetails {
  type: "intersection_observer";
  domain: string;
  observedCount: number;
}

export interface IndexedDBAbuseAlertDetails {
  type: "indexeddb_abuse";
  domain: string;
  dbName: string;
  version: number | null;
}

export interface HistoryManipulationAlertDetails {
  type: "history_manipulation";
  domain: string;
  method: string;
  url: string | null;
  hasState: boolean;
}

export interface MessageChannelAlertDetails {
  type: "message_channel";
  domain: string;
}

export interface ResizeObserverAlertDetails {
  type: "resize_observer";
  domain: string;
}

export interface ExecCommandClipboardAlertDetails {
  type: "execcommand_clipboard";
  domain: string;
  command: string;
}

export interface EventSourceChannelAlertDetails {
  type: "eventsource_channel";
  domain: string;
  url: string;
  /** 接続先が外部ドメインかどうか */
  isExternal: boolean;
}

export interface FontFingerprintAlertDetails {
  type: "font_fingerprint";
  domain: string;
  callCount: number;
}

export interface IdleCallbackTimingAlertDetails {
  type: "idle_callback_timing";
  domain: string;
  callCount: number;
}

export interface ClipboardEventSniffingAlertDetails {
  type: "clipboard_event_sniffing";
  domain: string;
  eventType: string;
}

export interface DragEventSniffingAlertDetails {
  type: "drag_event_sniffing";
  domain: string;
  eventType: string;
}

export interface SelectionSniffingAlertDetails {
  type: "selection_sniffing";
  domain: string;
  eventType: string;
}

export interface OpenRedirectAlertDetails {
  type: "open_redirect";
  domain: string;
  redirectUrl: string;
  parameterName: string;
  isExternal: boolean;
}

export interface DLPPIIDetectedAlertDetails {
  type: "dlp_pii_detected";
  /** スキャンコンテキスト（clipboard / form / ai_prompt） */
  scanContext: "clipboard" | "form" | "ai_prompt";
  /** 検出されたエンティティ種別 */
  entityTypes: string[];
  /** 検出数 */
  entityCount: number;
  /** 検出言語 */
  language: "ja" | "en";
  /** マスク済みサンプル（誤検知判定用） */
  maskedSample?: string;
}

/**
 * Recommended action for an alert
 */
export interface AlertAction {
  id: string;
  label: string;
  type: "investigate" | "dismiss" | "report" | "custom";
  url?: string;
}

/**
 * Alert rule for triggering alerts
 */
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  category: AlertCategory;
  condition: AlertCondition;
  severity: AlertSeverity;
  actions: AlertAction[];
}

/**
 * Condition for triggering an alert
 */
export interface AlertCondition {
  type: "always" | "threshold" | "pattern";
  threshold?: number;
  pattern?: string;
  field?: string;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  showNotifications: boolean;
  playSound: boolean;
  rules: AlertRule[];
}

/**
 * Default alert configuration
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  showNotifications: true,
  playSound: false,
  rules: [],
};

/**
 * Default alert rules
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "nrd-high",
    name: "High confidence NRD",
    enabled: true,
    category: "nrd",
    condition: { type: "always" },
    severity: "high",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
  {
    id: "typosquat-high",
    name: "High confidence typosquat",
    enabled: true,
    category: "typosquat",
    condition: { type: "always" },
    severity: "critical",
    actions: [
      { id: "report", label: "報告", type: "report" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
  {
    id: "data-leak-credentials",
    name: "Credentials in AI prompt",
    enabled: true,
    category: "ai_sensitive",
    condition: { type: "pattern", pattern: "credentials" },
    severity: "critical",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
    ],
  },
  {
    id: "login-suspicious",
    name: "Login on suspicious domain",
    enabled: true,
    category: "login",
    condition: { type: "always" },
    severity: "high",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
];
