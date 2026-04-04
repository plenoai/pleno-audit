import type { PlaybookData } from '../types';
import { phishingDomainPlaybooks } from './phishing-domain';
import { dataExfiltrationPlaybooks } from './data-exfiltration';
import { fingerprintingPlaybooks } from './fingerprinting';
import { codeInjectionPlaybooks } from './code-injection';
import { credentialClipboardPlaybooks } from './credential-clipboard';
import { networkCommunicationPlaybooks } from './network-communication';
import { monitoringSurveillancePlaybooks } from './monitoring-surveillance';
import { aiPolicyPlaybooks } from './ai-policy';
import { storageMediaPlaybooks } from './storage-media';

export interface AlertGroup {
  id: string;
  label: string;
  alertIds: string[];
}

export const ALERT_GROUPS: AlertGroup[] = [
  {
    id: 'phishing-domain',
    label: 'フィッシング・ドメイン',
    alertIds: ['nrd', 'typosquat', 'open_redirect', 'fullscreen_phishing', 'notification_phishing'],
  },
  {
    id: 'data-exfiltration',
    label: 'データ窃取',
    alertIds: ['data_exfiltration', 'fetch_exfiltration', 'send_beacon', 'postmessage_exfil', 'dns_prefetch_leak', 'storage_exfiltration'],
  },
  {
    id: 'fingerprinting',
    label: 'フィンガープリント',
    alertIds: ['canvas_fingerprint', 'webgl_fingerprint', 'audio_fingerprint', 'font_fingerprint', 'device_sensor', 'device_enumeration', 'resize_observer'],
  },
  {
    id: 'code-injection',
    label: 'コードインジェクション',
    alertIds: ['xss_injection', 'dynamic_code_execution', 'prototype_pollution', 'dom_clobbering', 'css_keylogging', 'wasm_execution'],
  },
  {
    id: 'credential-clipboard',
    label: '認証・クリップボード',
    alertIds: ['credential_theft', 'credential_api', 'form_hijack', 'clipboard_hijack', 'execcommand_clipboard', 'clipboard_read', 'clipboard_event_sniffing'],
  },
  {
    id: 'network-communication',
    label: 'ネットワーク・通信',
    alertIds: ['websocket_connection', 'webrtc_connection', 'broadcast_channel', 'message_channel', 'eventsource_channel', 'tracking_beacon'],
  },
  {
    id: 'monitoring-surveillance',
    label: '監視・サーベイランス',
    alertIds: ['dom_scraping', 'intersection_observer', 'performance_observer', 'selection_sniffing', 'drag_event_sniffing', 'idle_callback_timing', 'geolocation_access'],
  },
  {
    id: 'ai-policy',
    label: 'AI・ポリシー',
    alertIds: ['ai_sensitive', 'shadow_ai', 'csp_violation', 'policy_violation', 'extension', 'supply_chain'],
  },
  {
    id: 'storage-media',
    label: 'ストレージ・メディア',
    alertIds: ['media_capture', 'suspicious_download', 'cache_api_abuse', 'indexeddb_abuse', 'history_manipulation'],
  },
];

export const ALL_PLAYBOOKS: PlaybookData[] = [
  ...phishingDomainPlaybooks,
  ...dataExfiltrationPlaybooks,
  ...fingerprintingPlaybooks,
  ...codeInjectionPlaybooks,
  ...credentialClipboardPlaybooks,
  ...networkCommunicationPlaybooks,
  ...monitoringSurveillancePlaybooks,
  ...aiPolicyPlaybooks,
  ...storageMediaPlaybooks,
];
