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

// API Client
export {
  ApiClient,
  getApiClient,
  updateApiClientConfig,
  ensureOffscreenDocument,
  markOffscreenReady,
  type ConnectionMode,
  type ApiClientConfig,
  type QueryOptions,
  type PaginatedResult,
} from "./api-client.js";

// Sync Manager
export { SyncManager, getSyncManager } from "./sync-manager.js";

// Migration
export { checkMigrationNeeded, migrateToDatabase } from "./migration.js";

// Cookie Monitor
export {
  startCookieMonitor,
  onCookieChange,
  queryExistingCookies,
  type CookieChangeCallback,
} from "./cookie-monitor.js";

// Message Handler
export { createMessageRouter, fireAndForget } from "./message-handler.js";

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

// Network Monitor
export {
  createNetworkMonitor,
  registerNetworkMonitorListener,
  clearGlobalCallbacks,
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
  type NetworkMonitor,
  type ExtensionInfo,
  // Backward compatibility aliases
  createExtensionMonitor,
  registerExtensionMonitorListener,
  DEFAULT_EXTENSION_MONITOR_CONFIG,
  type ExtensionMonitor as ExtensionMonitorType,
} from "./network-monitor.js";

// Extension Stats Analyzer
export {
  generateExtensionStats,
  generateDailyTimeSeries,
  generateWeeklyTimeSeries,
  generateDashboardStats,
  ExtensionStatsCache,
  globalExtensionStatsCache,
  type ExtensionStats,
  type TimeSeriesData,
  type DashboardStats,
} from "./extension-stats-analyzer.js";

// Suspicious Pattern Detector
export {
  detectAllSuspiciousPatterns,
  detectBulkRequests,
  detectLateNightActivity,
  detectEncodedParameters,
  detectDomainDiversity,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
  type SuspiciousPattern,
  type SuspiciousPatternConfig,
} from "./suspicious-pattern-detector.js";

// Extension Risk Analyzer
export {
  DANGEROUS_PERMISSIONS,
  analyzePermissions,
  analyzeNetworkActivity,
  calculateRiskScore,
  scoreToRiskLevel,
  getPermissionRiskLevel,
  generateRiskFlags,
  analyzeExtensionRisk,
  analyzeInstalledExtension,
  type PermissionRiskCategory,
  type PermissionRisk,
  type PermissionRiskLevel,
  type ExtensionRiskAnalysis,
  type NetworkRisk,
  type RiskFlag,
} from "./extension-risk-analyzer.js";

// Blocking Engine
export {
  createBlockingEngine,
  type BlockTarget,
  type BlockDecision,
  type BlockEvent,
  type BlockingEngine,
} from "./blocking-engine.js";

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

// DoH Monitor
export {
  createDoHMonitor,
  registerDoHMonitorListener,
  clearDoHCallbacks,
  detectDoHRequest,
  DEFAULT_DOH_MONITOR_CONFIG,
  MAX_STORED_DOH_REQUESTS,
  DOH_URL_PATTERNS,
  type DoHMonitor,
  type DoHAction,
  type DoHMonitorConfig,
  type DoHRequestRecord,
  type DoHDetectionMethod,
} from "./doh-monitor.js";

// Enterprise Manager
export {
  getEnterpriseManager,
  createEnterpriseManager,
  EnterpriseManager,
} from "./enterprise-manager.js";

// Re-export types from @libztbs/types for backward compatibility
export type {
  DoHRequestRecord,
  DoHDetectionMethod,
  EnterpriseManagedConfig,
  EnterpriseStatus,
  EnterpriseSSOConfig,
  EnterprisePolicyConfig,
  EnterpriseReportingConfig,
} from "@libztbs/types";

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
