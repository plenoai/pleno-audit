/**
 * Extension Storage Schema
 */
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
} from "@pleno-audit/detectors";
import type { CSPConfig, CSPReport, GeneratedCSPByDomain } from "@pleno-audit/csp";
import type { PolicyConfig } from "@pleno-audit/alerts";

// Forecast config removed - enterprise feature

/**
 * Network Monitor Config - 全ネットワークリクエスト監視設定
 * CSPと並ぶコア機能として、全リクエストを記録しposture（態勢）を可視化
 */
export interface NetworkMonitorConfig {
  enabled: boolean;
  /** 全リクエストをキャプチャ（trueの場合、拡張機能以外も監視） */
  captureAllRequests: boolean;
  /** 自身の拡張機能を除外 */
  excludeOwnExtension: boolean;
  /** 除外するドメイン */
  excludedDomains: string[];
  /** 除外する拡張機能ID */
  excludedExtensions: string[];
}

export const DEFAULT_NETWORK_MONITOR_CONFIG: NetworkMonitorConfig = {
  enabled: true,
  captureAllRequests: true,
  excludeOwnExtension: true,
  excludedDomains: [],
  excludedExtensions: [],
};

/** リクエストの発信元タイプ */
export type InitiatorType = "extension" | "page" | "browser" | "unknown";

/**
 * Network Request Record - 全ネットワークリクエストの統一型
 */
export interface NetworkRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  domain: string;
  resourceType: string;
  /** リクエスト発信元 (chrome-extension://xxx, https://xxx, null) */
  initiator: string | null;
  /** 発信元タイプ */
  initiatorType: InitiatorType;
  /** 拡張機能の場合のID */
  extensionId?: string;
  /** 拡張機能の場合の名前 */
  extensionName?: string;
  /** タブID (-1 = Service Worker) */
  tabId: number;
  /** フレームID (0 = main frame) */
  frameId: number;
  /** 検出方法 */
  detectedBy: "webRequest" | "declarativeNetRequest";
}

export interface DataRetentionConfig {
  retentionDays: number;
  autoCleanupEnabled: boolean;
  lastCleanupTimestamp: number;
}

export const DEFAULT_DATA_RETENTION_CONFIG: DataRetentionConfig = {
  retentionDays: 180, // 6ヶ月
  autoCleanupEnabled: true,
  lastCleanupTimestamp: 0,
};

export interface DetectionConfig {
  enableNRD: boolean;
  enableTyposquat: boolean;
  enableAI: boolean;
  enablePrivacy: boolean;
  enableTos: boolean;
  enableLogin: boolean;
  enableExtension: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enableNRD: false,
  enableTyposquat: true,
  enableAI: true,
  enablePrivacy: true,
  enableTos: true,
  enableLogin: true,
  enableExtension: true,
};

/**
 * ブロック設定（ユーザー同意ベース、デフォルト無効）
 */
export interface BlockingConfig {
  enabled: boolean; // 全体のブロック機能有効/無効
  blockTyposquat: boolean; // タイポスクワット検出時にブロック
  blockNRDLogin: boolean; // NRDでのログイン時に警告
  blockHighRiskExtension: boolean; // 高リスク拡張機能をブロック
  blockSensitiveDataToAI: boolean; // 機密データのAI送信をブロック
  userConsentGiven: boolean; // ユーザーが同意したか
  consentTimestamp: number; // 同意日時
}

export const DEFAULT_BLOCKING_CONFIG: BlockingConfig = {
  enabled: false, // デフォルト無効（ユーザー同意が必要）
  blockTyposquat: true,
  blockNRDLogin: true,
  blockHighRiskExtension: false,
  blockSensitiveDataToAI: false,
  userConsentGiven: false,
  consentTimestamp: 0,
};

/**
 * 通知設定（デフォルト無効）
 */
export interface NotificationConfig {
  enabled: boolean; // 通知全体の有効/無効
  severityFilter: ("critical" | "high" | "medium" | "low" | "info")[]; // 通知する重大度
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: false, // デフォルト無効
  severityFilter: ["critical", "high"],
};

/**
 * アラートクールダウン永続化用
 * キー: アラートの種類とドメイン/IDの組み合わせ
 * 値: 最後のアラート発火時刻
 */
export interface AlertCooldownData {
  [key: string]: number;
}

export interface ExtensionRequestRecord {
  id: string;
  extensionId: string;
  extensionName: string;
  timestamp: number;
  url: string;
  method: string;
  resourceType: string;
  domain: string;
  statusCode?: number;
  /** 検出方法: webRequest または declarativeNetRequest */
  detectedBy?: "webRequest" | "declarativeNetRequest";
}

export type DoHDetectionMethod =
  | "content-type"
  | "accept-header"
  | "url-path"
  | "dns-param";

export type DoHAction = "detect" | "alert" | "block";

export interface DoHMonitorConfig {
  action: DoHAction;
  maxStoredRequests: number;
}

export interface DoHRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  method: string;
  detectionMethod: DoHDetectionMethod;
  initiator?: string;
  blocked: boolean;
}

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
  generatedCSPPolicy?: GeneratedCSPByDomain;
  aiPrompts?: CapturedAIPrompt[];
  aiMonitorConfig?: AIMonitorConfig;
  nrdConfig?: NRDConfig;
  /** ネットワーク監視設定 */
  networkMonitorConfig?: NetworkMonitorConfig;
  doHRequests?: DoHRequestRecord[];
  doHMonitorConfig?: DoHMonitorConfig;
  dataRetentionConfig?: DataRetentionConfig;
  detectionConfig?: DetectionConfig;
  blockingConfig?: BlockingConfig;
  notificationConfig?: NotificationConfig;
  alertCooldown?: AlertCooldownData;
  policyConfig?: PolicyConfig;
}

/**
 * Enterprise Managed Storage Configuration
 * Configured via chrome.storage.managed (MDM/Chrome Enterprise Policy)
 */
export interface EnterpriseSSOConfig {
  provider?: "oidc" | "saml";
  required?: boolean;
  clientId?: string;
  authority?: string;
  scope?: string;
  entityId?: string;
  entryPoint?: string;
  issuer?: string;
}

export interface EnterprisePolicyConfig {
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedAIProviders?: string[];
  blockedAIProviders?: string[];
}

export interface EnterpriseReportingConfig {
  endpoint?: string;
  apiKey?: string;
  enabled?: boolean;
  batchSize?: number;
  flushIntervalSeconds?: number;
}

export interface EnterpriseManagedConfig {
  sso?: EnterpriseSSOConfig;
  settings?: {
    locked?: boolean;
    enableNRD?: boolean;
    enableTyposquat?: boolean;
    enableAI?: boolean;
    enablePrivacy?: boolean;
    enableTos?: boolean;
    enableLogin?: boolean;
    enableExtension?: boolean;
    enableBlocking?: boolean;
    enableNotifications?: boolean;
  };
  reporting?: EnterpriseReportingConfig;
  policy?: EnterprisePolicyConfig;
}

export interface EnterpriseStatus {
  isManaged: boolean;
  ssoRequired: boolean;
  settingsLocked: boolean;
  config: EnterpriseManagedConfig | null;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  GeneratedCSPByDomain,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
};
