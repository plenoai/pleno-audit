/**
 * @fileoverview Alert System Package
 *
 * Real-time security alerting system for immediate response.
 * Wiz-style alerts for NRD, typosquat, and data leaks.
 */

// Types
export type {
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  SecurityAlert,
  AlertDetails,
  NRDAlertDetails,
  TyposquatAlertDetails,
  DataLeakAlertDetails,
  DataExfiltrationAlertDetails,
  CredentialTheftAlertDetails,
  SupplyChainAlertDetails,
  CSPAlertDetails,
  AISensitiveAlertDetails,
  ShadowAIAlertDetails,
  ExtensionAlertDetails,
  LoginAlertDetails,
  PolicyAlertDetails,

  PolicyViolationAlertDetails,
  DynamicCodeExecutionAlertDetails,
  FullscreenPhishingAlertDetails,
  ClipboardReadAlertDetails,
  GeolocationAccessAlertDetails,
  WebSocketConnectionAlertDetails,
  WebRTCConnectionAlertDetails,
  BroadcastChannelAlertDetails,
  SendBeaconAlertDetails,
  MediaCaptureAlertDetails,
  NotificationPhishingAlertDetails,
  CredentialAPIAlertDetails,
  DeviceSensorAlertDetails,
  DeviceEnumerationAlertDetails,
  StorageExfiltrationAlertDetails,
  OpenRedirectAlertDetails,
  AlertAction,
  AlertRule,
  AlertCondition,
  AlertConfig,
} from "./types.js";

export { DEFAULT_ALERT_CONFIG, DEFAULT_ALERT_RULES } from "./types.js";

// Alert Manager
export {
  createAlertManager,
  createInMemoryAlertStore,
  createPersistentAlertStore,
  type AlertManager,
  type AlertStore,
  type AlertListener,
  type PersistentAlertStoreOptions,
} from "./alert-manager.js";

// Policy Types
export type {
  PolicyAction,
  PolicyMatchType,
  DomainPolicyRule,
  ToolPolicyRule,
  AIPolicyRule,
  DataTransferPolicyRule,
  PolicyConfig,
  PolicyViolation,
} from "./policy-types.js";

export {
  DEFAULT_POLICY_CONFIG,
  POLICY_TEMPLATES,
  SOCIAL_MEDIA_DOMAINS,
  PRODUCTIVITY_DOMAINS,
  COMMUNICATION_DOMAINS,
} from "./policy-types.js";

// Policy Manager
export {
  createPolicyManager,
  type PolicyManager,
  type PolicyCheckResult,
} from "./policy-manager.js";

// Security Posture
export {
  calculateSecurityPosture,
  type PostureInput,
  type PosturePenalty,
  type PostureStatus,
  type SecurityPosture,
} from "./security-posture.js";

// Scoring Utilities
export {
  scoreToRiskLevel5,
  scoreToExtensionRiskLevel,
  getStatusBadge,
  RISK_SCORE_THRESHOLDS,
  type RiskLevel5,
  type ExtensionRiskLevel,
  type StatusBadge,
  type StatusBadgeVariant,
} from "./scoring-utils.js";
