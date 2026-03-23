/**
 * Network Monitor - State Management
 *
 * グローバル状態の管理とキャッシュ
 */

import type { NetworkMonitorConfig } from "@libztbs/extension-runtime";
import { DEFAULT_NETWORK_MONITOR_CONFIG } from "@libztbs/extension-runtime";
import type { NetworkMonitorState, ExtensionInfo } from "./types.js";

/**
 * 設定からキャッシュキーを生成
 *
 * 配列をソートしてから結合することで、順序非依存のキーを生成
 */
export function createConfigCacheKey(config: NetworkMonitorConfig): string {
  const domains = [...config.excludedDomains].sort().join("\u0000");
  const extensions = [...config.excludedExtensions].sort().join("\u0000");
  return `${domains}::${extensions}`;
}

/**
 * グローバル状態（Service Worker再起動時に再初期化される）
 */
export const state: NetworkMonitorState = {
  config: DEFAULT_NETWORK_MONITOR_CONFIG,
  configCacheKey: createConfigCacheKey(DEFAULT_NETWORK_MONITOR_CONFIG),
  ownExtensionId: "",
  knownExtensions: new Map<string, ExtensionInfo>(),
  callbacks: [],
  listenerRegistered: false,
  managementListenersRegistered: false,
  dnrRulesRegistered: false,
  lastMatchedRulesCheck: 0,
  lastDNRCallTime: 0,
  dnrCallCount: 0,
  dnrQuotaWindowStart: 0,
  dnrRuleToExtensionMap: new Map<number, string>(),
  excludedDomains: new Set<string>(),
  excludedExtensions: new Set<string>(),
  recentWebRequestHits: new Map<string, number>(),
};

/**
 * 設定キャッシュを更新
 */
export function updateConfigCaches(config: NetworkMonitorConfig): void {
  state.configCacheKey = createConfigCacheKey(config);
  state.excludedDomains = new Set(config.excludedDomains);
  state.excludedExtensions = new Set(config.excludedExtensions);
}

/**
 * 設定キャッシュが最新かを確認し、必要なら更新
 */
export function ensureConfigCachesCurrent(): void {
  if (state.configCacheKey !== createConfigCacheKey(state.config)) {
    updateConfigCaches(state.config);
  }
}

/**
 * 設定を適用
 */
export function applyConfig(config: NetworkMonitorConfig): void {
  state.config = config;
  updateConfigCaches(config);
}

/**
 * グローバルコールバックをクリア
 */
export function clearGlobalCallbacks(): void {
  state.callbacks = [];
}
