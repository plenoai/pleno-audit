// Errors
export { PlenoAuditError, RetryableError, StorageError, ConfigError, errorMessage } from "./errors.js";

// Storage
export type { StorageData } from "./storage-types.js";
export {
  queueStorageOperation,
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearCSPReports,
  clearAIPrompts,
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
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
  ExtensionRequestRecord,
  NetworkMonitorConfig,
  NetworkRequestRecord,
  InitiatorType,
  DataRetentionConfig,
  DetectionConfig,
  BlockingConfig,
  NotificationConfig,
  AlertCooldownData,
} from "./storage-types.js";
export {
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_NETWORK_MONITOR_CONFIG,
} from "./storage-types.js";

// Network Monitor (primary)
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
  generateRiskFlags,
  analyzeExtensionRisk,
  analyzeInstalledExtension,
  type PermissionRiskCategory,
  type PermissionRisk,
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

// SSO Manager
export {
  getSSOManager,
  createSSOManager,
  type SSOProvider,
  type OIDCConfig,
  type SAMLConfig,
  type SSOConfig,
  type SSOSession,
  type SSOStatus,
} from "./sso-manager.js";

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
  DOH_URL_PATTERNS,
  type DoHMonitor,
} from "./doh-monitor.js";

export type {
  DoHAction,
  DoHMonitorConfig,
  DoHRequestRecord,
  DoHDetectionMethod,
} from "./storage-types.js";

// Enterprise Manager
export {
  getEnterpriseManager,
  createEnterpriseManager,
  EnterpriseManager,
} from "./enterprise-manager.js";

export type {
  EnterpriseManagedConfig,
  EnterpriseStatus,
  EnterpriseSSOConfig,
  EnterprisePolicyConfig,
  EnterpriseReportingConfig,
} from "./storage-types.js";
