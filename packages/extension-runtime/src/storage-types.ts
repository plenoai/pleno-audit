/**
 * Extension Storage Schema
 */
import type { DetectedService } from "@libztbs/types";
import type { AIMonitorConfig } from "@libztbs/ai-detector";
import type { NRDConfig } from "@libztbs/nrd";
import type { CSPReport, GeneratedCSPByDomain } from "@libztbs/csp";
import type { PolicyConfig, SecurityAlert } from "@libztbs/alerts";

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

export interface DetectionConfig {
  enableNRD: boolean;
  enableTyposquat: boolean;
  enableAI: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enableNRD: false,
  enableTyposquat: true,
  enableAI: true,
};


/**
 * 通知設定（デフォルト無効）
 */
export interface NotificationConfig {
  enabled: boolean; // 通知全体の有効/無効
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: false, // デフォルト無効
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

export interface DoHRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  method: string;
  detectionMethod: DoHDetectionMethod;
  initiator?: string;
}

export interface StorageData {
  /** Posture: ドメインごとのセキュリティ態勢 */
  services: Record<string, DetectedService>;
  /** Policy: セキュリティポリシー定義 */
  policyConfig?: PolicyConfig;
  /** Alert: セキュリティアラート履歴（永続化） */
  alerts?: SecurityAlert[];

  generatedCSPPolicy?: GeneratedCSPByDomain;
  aiMonitorConfig?: AIMonitorConfig;
  nrdConfig?: NRDConfig;
  detectionConfig?: DetectionConfig;
  notificationConfig?: NotificationConfig;
  alertCooldown?: AlertCooldownData;
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
  CSPReport,
  GeneratedCSPByDomain,
  AIMonitorConfig,
  NRDConfig,
  SecurityAlert,
};
