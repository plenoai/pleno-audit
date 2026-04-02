/**
 * Extension Storage Schema
 *
 * 純粋な型定義は @libztbs/types に移動済み。
 * このファイルはStorageData（各パッケージの設定を集約）のみを定義。
 */
import type { DetectedService } from "../types/index.js";
import type {
  DetectionConfig,
  NotificationConfig,
  AlertCooldownData,
} from "../types/index.js";
import type { AIMonitorConfig } from "../ai-detector/index.js";
import type { NRDConfig } from "../nrd/index.js";
import type { CSPReport, GeneratedCSPByDomain } from "../csp/index.js";
import type { PolicyConfig, SecurityAlert } from "../alerts/index.js";

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
} from "../types/index.js";

export {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "../types/index.js";

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
