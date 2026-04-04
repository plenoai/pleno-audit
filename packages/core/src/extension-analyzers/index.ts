/**
 * @fileoverview Extension Analyzers Package
 *
 * ブラウザ拡張機能のセキュリティ分析モジュール群。
 * - 通信統計分析
 * - 不審パターン検出
 * - 拡張機能リスク分析
 * - DoHトラフィック検出
 * - Cookie監視
 */

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
  generateRiskFlags,
  analyzeExtensionRisk,
  analyzeInstalledExtension,
  type PermissionRiskCategory,
  type PermissionRisk,
  type PermissionRiskLevel,
  getPermissionRiskLevel,
  type ExtensionRiskAnalysis,
  type NetworkRisk,
  type RiskFlag,
} from "./extension-risk-analyzer.js";

// DoH Monitor
export {
  createDoHMonitor,
  registerDoHMonitorListener,
  clearDoHCallbacks,
  detectDoHRequest,
  MAX_STORED_DOH_REQUESTS,
  DOH_URL_PATTERNS,
  type DoHMonitor,
} from "./doh-monitor.js";

// Cookie Monitor
export {
  startCookieMonitor,
  onCookieChange,
  queryExistingCookies,
  type CookieChangeCallback,
} from "./cookie-monitor.js";

// Extension Lifecycle Monitor
export {
  startExtensionLifecycleMonitor,
  stopExtensionLifecycleMonitor,
  onExtensionLifecycle,
  type ExtensionLifecycleEventType,
  type ExtensionLifecycleEvent,
  type ExtensionLifecycleCallback,
} from "./extension-lifecycle-monitor.js";
