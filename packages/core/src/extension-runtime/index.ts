// Errors
export { PlenoAuditError, RetryableError, StorageError, ConfigError, errorMessage } from "./errors.js";

// Storage
export type { StorageData, SecurityAlert } from "./storage-types.js";
export {
  queueStorageOperation,
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearAllStorage,
} from "./storage.js";

// Browser Adapter
export {
  createBrowserAdapter,
  browserAdapter,
  getBrowserAPI,
  isFirefox,
  isChrome,
  isExtensionContext,
  hasSessionStorage,
  hasManagedStorage,
  hasIdentityAPI,
  isManifestV3,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
} from "./browser-adapter.js";

// Re-export types from storage-types
export type {
  DetectedService,
  CSPReport,
  GeneratedCSPByDomain,
  AIMonitorConfig,
  ExtensionRequestRecord,
  NetworkRequestRecord,
  InitiatorType,
  DetectionConfig,
  NotificationConfig,
  AlertCooldownData,
} from "./storage-types.js";
export {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./storage-types.js";

// Messaging (content script → background)
export {
  isRuntimeAvailable,
  sendRuntimeMessage,
  fireMessage,
} from "./messaging.js";

// Logger
export {
  createLogger,
  setDebuggerSink,
  hasDebuggerSink,
  type Logger,
  type LogLevel,
  type LogEntry,
  type LogEventPayload,
} from "./logger.js";

// Cooldown Manager
export {
  createCooldownManager,
  createInMemoryCooldownStorage,
  createPersistentCooldownStorage,
  type CooldownStorage,
  type CooldownManager,
  type CooldownManagerConfig,
} from "./cooldown-manager.js";

// Re-export types from @libztbs/types for backward compatibility
export type {
  DoHRequestRecord,
  DoHDetectionMethod,
  EnterpriseManagedConfig,
  EnterpriseStatus,
  EnterpriseSSOConfig,
  EnterprisePolicyConfig,
  EnterpriseReportingConfig,
} from "../types/index.js";

// Operation Guard
export { OperationGuard } from "./operation-guard.js";

// Event Queue
export {
  createEventQueue,
  type EventQueue,
  type EventQueueConfig,
  type EventQueueDeps,
  type RuntimeEvent,
} from "./event-queue.js";
