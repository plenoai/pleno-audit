/**
 * Network Monitor - State Management
 *
 * グローバル状態の管理
 */

import type { NetworkMonitorState, ExtensionInfo } from "./types.js";
import {
  EXCLUDED_DOMAINS,
  EXCLUDED_EXTENSIONS,
} from "./constants.js";

/**
 * グローバル状態（Service Worker再起動時に再初期化される）
 */
export const state: NetworkMonitorState = {
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
  recentWebRequestHits: new Map<string, number>(),
};

/** 除外ドメインのセット（定数から生成） */
export const excludedDomains: Set<string> = new Set(EXCLUDED_DOMAINS);

/** 除外拡張機能のセット（定数から生成） */
export const excludedExtensions: Set<string> = new Set(EXCLUDED_EXTENSIONS);

/**
 * グローバルコールバックをクリア
 */
export function clearGlobalCallbacks(): void {
  state.callbacks = [];
}
