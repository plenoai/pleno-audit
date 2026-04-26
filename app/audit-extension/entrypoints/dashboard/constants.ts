import { Layers, Puzzle, Siren, Settings } from "lucide-preact";
import type { ComponentType } from "preact";
import type { LucideProps } from "lucide-preact";
import type { TabType } from "./types";

export interface SidebarTabDef {
  id: TabType;
  label: string;
  icon: ComponentType<LucideProps>;
  /** セクション見出し (Posture, Detection など) */
  section?: string;
}

export const tabs: SidebarTabDef[] = [
  { id: "services", label: "サービス", icon: Layers, section: "Posture" },
  { id: "extensions", label: "拡張機能", icon: Puzzle },
  { id: "alerts", label: "アラート", icon: Siren, section: "Detection" },
  { id: "settings", label: "設定", icon: Settings, section: "Workspace" },
];

export const loadingTabs: SidebarTabDef[] = [
  { id: "services", label: "サービス", icon: Layers },
];

export const validTabs: TabType[] = tabs.map((tab) => tab.id);

export const shortcutTabs: TabType[] = [
  "services",
  "extensions",
  "alerts",
  "settings",
];

/** Display labels for alert categories. Used in badges and expanded panels. */
export const CATEGORY_LABELS: Record<string, string> = {
  nrd: "NRD",
  typosquat: "Typosquat",
  ai_sensitive: "AI機微データ",
  csp_violation: "CSP違反",
  shadow_ai: "Shadow AI",
  network: "通信異常",
  data_exfiltration: "データ漏洩",
  credential_theft: "認証情報窃取",
  xss_injection: "XSS",
  dom_scraping: "DOM収集",
  clipboard_hijack: "Clipboard乗取",
  suspicious_download: "不審DL",
  canvas_fingerprint: "Canvasフィンガープリント",
  webgl_fingerprint: "WebGLフィンガープリント",
  audio_fingerprint: "Audioフィンガープリント",
  tracking_beacon: "Beacon追跡",
  supply_chain: "Supply Chain",
  dynamic_code_execution: "動的コード実行",
  fullscreen_phishing: "Phishing",
  clipboard_read: "Clipboard読取",
  geolocation_access: "位置情報",
  websocket_connection: "WebSocket",
  webrtc_connection: "WebRTC",
  broadcast_channel: "Broadcast",
  send_beacon: "Beacon送信",
  media_capture: "メディア取得",
  notification_phishing: "通知Phishing",
  credential_api: "Credential API",
  device_sensor: "センサー",
  device_enumeration: "デバイス列挙",
  storage_exfiltration: "Storage漏洩",
  prototype_pollution: "Prototype汚染",
  dns_prefetch_leak: "DNS漏洩",
  form_hijack: "Form乗取",
  css_keylogging: "CSSキーロガー",
  performance_observer: "Performance監視",
  postmessage_exfil: "PostMessage漏洩",
  dom_clobbering: "DOM Clobbering",
  cache_api_abuse: "Cache悪用",
  fetch_exfiltration: "Fetch漏洩",
  wasm_execution: "WASM実行",
  intersection_observer: "Intersection監視",
  indexeddb_abuse: "IndexedDB悪用",
  history_manipulation: "履歴改竄",
  message_channel: "MessageChannel",
  resize_observer: "Resize監視",
  execcommand_clipboard: "ExecCommand",
  eventsource_channel: "SSE",
  font_fingerprint: "Fontフィンガープリント",
  idle_callback_timing: "Idle計測",
  clipboard_event_sniffing: "Clipboard盗聴",
  drag_event_sniffing: "Drag盗聴",
  selection_sniffing: "選択盗聴",
};
