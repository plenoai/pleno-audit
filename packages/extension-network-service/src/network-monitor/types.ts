/**
 * Network Monitor - Type Definitions
 *
 * ネットワーク監視に関する型定義
 */

import type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
  DashboardStats,
  SuspiciousPattern,
} from "@pleno-audit/extension-runtime";

// Re-export for convenience
export type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
};

/**
 * 拡張機能情報
 */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons?: { size: number; url: string }[];
}

/**
 * Network Monitor 内部状態
 */
export interface NetworkMonitorState {
  config: NetworkMonitorConfig;
  configCacheKey: string;
  ownExtensionId: string;
  knownExtensions: Map<string, ExtensionInfo>;
  callbacks: Array<(request: NetworkRequestRecord) => void>;
  listenerRegistered: boolean;
  managementListenersRegistered: boolean;
  dnrRulesRegistered: boolean;
  lastMatchedRulesCheck: number;
  lastDNRCallTime: number;
  dnrCallCount: number;
  dnrQuotaWindowStart: number;
  dnrRuleToExtensionMap: Map<number, string>;
  excludedDomains: Set<string>;
  excludedExtensions: Set<string>;
  /** webRequestで検出済みのリクエストを追跡 (extensionId:tabId → 直近タイムスタンプ) */
  recentWebRequestHits: Map<string, number>;
}

/**
 * Network Monitor インターフェース
 */
export interface NetworkMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: NetworkRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
  checkDNRMatches(): Promise<NetworkRequestRecord[]>;
  generateStats(records: NetworkRequestRecord[]): DashboardStats;
  detectSuspiciousPatterns(records: NetworkRequestRecord[]): SuspiciousPattern[];
}
