import type { TabType } from "./types";

export const tabs: { id: TabType; label: string }[] = [
  { id: "services", label: "サービス" },
  { id: "extensions", label: "拡張機能" },
  { id: "alerts", label: "アラート" },
  { id: "settings", label: "設定" },
];

export const loadingTabs: { id: TabType; label: string }[] = [
  { id: "services", label: "サービス" },
];

export const validTabs: TabType[] = tabs.map((tab) => tab.id);

export const shortcutTabs: TabType[] = [
  "services",
  "extensions",
  "alerts",
  "settings",
];

/** Short display labels for alert categories. Used in badges and expanded panels. */
export const CATEGORY_LABELS: Record<string, string> = {
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
