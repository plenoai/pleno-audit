/**
 * Extension Storage Schema
 *
 * 純粋な型定義は @libztbs/types に移動済み。
 * このファイルはStorageData（各パッケージの設定を集約）のみを定義。
 */
import type { DetectedService } from "@libztbs/types";
import type {
  DetectionConfig,
  NotificationConfig,
  AlertCooldownData,
} from "@libztbs/types";
import type { AIMonitorConfig } from "@libztbs/ai-detector";
import type { NRDConfig } from "@libztbs/nrd";
import type { CSPReport, GeneratedCSPByDomain } from "@libztbs/csp";
import type { PolicyConfig, SecurityAlert } from "@libztbs/alerts";

// Re-export from @libztbs/types for backward compatibility
export type {
  InitiatorType,
  NetworkRequestRecord,
  ExtensionRequestRecord,
  DoHDetectionMethod,
  DoHRequestRecord,
  DetectionConfig,
  NotificationConfig,
  AlertCooldownData,
  EnterpriseSSOConfig,
  EnterprisePolicyConfig,
  EnterpriseReportingConfig,
  EnterpriseManagedConfig,
  EnterpriseStatus,
} from "@libztbs/types";

export {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "@libztbs/types";

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

export type {
  DetectedService,
  CSPReport,
  GeneratedCSPByDomain,
  AIMonitorConfig,
  NRDConfig,
  SecurityAlert,
};
