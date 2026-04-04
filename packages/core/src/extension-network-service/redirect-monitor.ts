/**
 * Redirect Chain Monitor
 *
 * webNavigation API を使用したリダイレクトチェーンの監視。
 * HTTP 3xx サーバーリダイレクトおよびクライアントサイドリダイレクトを検出し、
 * 短時間に異なるドメインへ遷移するチェーンをアラートとして発火する。
 *
 * connectionTracker と同レイヤで動作し、サービスの付加情報として保存する。
 */

import type { LoggerLike } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface RedirectEntry {
  url: string;
  domain: string;
  timestamp: number;
  transitionType: string;
  /** server_redirect / client_redirect / unknown */
  redirectType: "server_redirect" | "client_redirect" | "unknown";
}

export interface RedirectChain {
  tabId: number;
  entries: RedirectEntry[];
  startedAt: number;
  /** 外部ドメインへのリダイレクトが含まれるか */
  hasExternalRedirect: boolean;
}

export interface RedirectAlertInfo {
  sourceDomain: string;
  sourceUrl: string;
  destinationDomain: string;
  destinationUrl: string;
  chain: string[];
  chainLength: number;
  redirectType: "server_redirect" | "client_redirect" | "unknown";
}

export interface RedirectMonitorDeps {
  logger: LoggerLike;
  /** リダイレクトチェーン検出時のコールバック */
  onRedirectChainDetected?: (info: RedirectAlertInfo) => void;
  /** サービスの付加情報として保存 */
  onServiceRedirectUpdate?: (domain: string, redirectInfo: {
    redirectedTo: string;
    redirectType: string;
    detectedAt: number;
  }) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** リダイレクトチェーンのタイムウィンドウ (ms) — この時間内の遷移をチェーンとみなす */
const REDIRECT_CHAIN_WINDOW_MS = 5_000;

/** チェーンの最大追跡数 */
const MAX_CHAIN_LENGTH = 20;

/** タブごとのチェーン追跡マップの最大サイズ */
const MAX_TRACKED_TABS = 200;

// ============================================================================
// Helpers
// ============================================================================

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isInternalUrl(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("moz-extension://")
  );
}

// ============================================================================
// Redirect Monitor
// ============================================================================

export interface RedirectMonitor {
  start(): void;
  stop(): void;
  /** 特定タブの現在のリダイレクトチェーンを取得（デバッグ用） */
  getChain(tabId: number): RedirectChain | undefined;
}

export function createRedirectMonitor(deps: RedirectMonitorDeps): RedirectMonitor {
  const chains = new Map<number, RedirectChain>();
  let listening = false;

  function evictOldest(): void {
    if (chains.size <= MAX_TRACKED_TABS) return;
    // 最も古いエントリを削除
    let oldestTab = -1;
    let oldestTime = Infinity;
    for (const [tabId, chain] of chains) {
      if (chain.startedAt < oldestTime) {
        oldestTime = chain.startedAt;
        oldestTab = tabId;
      }
    }
    if (oldestTab !== -1) chains.delete(oldestTab);
  }

  function handleCommitted(
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ): void {
    // メインフレームのみ追跡
    if (details.frameId !== 0) return;
    if (isInternalUrl(details.url)) return;

    const { tabId, url, transitionType, transitionQualifiers } = details;
    const now = Date.now();
    const domain = extractDomain(url);
    if (!domain) return;

    const isServerRedirect = transitionQualifiers.includes("server_redirect");
    const isClientRedirect = transitionQualifiers.includes("client_redirect");
    const redirectType: RedirectEntry["redirectType"] = isServerRedirect
      ? "server_redirect"
      : isClientRedirect
        ? "client_redirect"
        : "unknown";

    const entry: RedirectEntry = {
      url,
      domain,
      timestamp: now,
      transitionType,
      redirectType,
    };

    const existingChain = chains.get(tabId);

    if (existingChain) {
      const lastEntry = existingChain.entries[existingChain.entries.length - 1];
      const withinWindow = now - lastEntry.timestamp < REDIRECT_CHAIN_WINDOW_MS;

      if (withinWindow && (isServerRedirect || isClientRedirect)) {
        // チェーンを延伸
        if (existingChain.entries.length < MAX_CHAIN_LENGTH) {
          existingChain.entries.push(entry);
        }

        // 外部リダイレクトを検出
        if (lastEntry.domain !== domain) {
          existingChain.hasExternalRedirect = true;
          emitRedirectDetected(existingChain, entry, lastEntry);
        }
        return;
      }
    }

    // 新しいチェーンを開始（リダイレクト修飾子がある場合のみ）
    if (isServerRedirect || isClientRedirect) {
      evictOldest();
      chains.set(tabId, {
        tabId,
        entries: [entry],
        startedAt: now,
        hasExternalRedirect: false,
      });
    } else {
      // 通常のナビゲーション — チェーンをリセット
      chains.delete(tabId);
    }
  }

  function emitRedirectDetected(
    chain: RedirectChain,
    current: RedirectEntry,
    previous: RedirectEntry,
  ): void {
    const info: RedirectAlertInfo = {
      sourceDomain: chain.entries[0].domain,
      sourceUrl: chain.entries[0].url,
      destinationDomain: current.domain,
      destinationUrl: current.url,
      chain: chain.entries.map((e) => e.domain),
      chainLength: chain.entries.length,
      redirectType: current.redirectType,
    };

    deps.onRedirectChainDetected?.(info);

    // サービスの付加情報として保存
    deps.onServiceRedirectUpdate?.(previous.domain, {
      redirectedTo: current.domain,
      redirectType: current.redirectType,
      detectedAt: current.timestamp,
    });
  }

  function handleTabRemoved(tabId: number): void {
    chains.delete(tabId);
  }

  return {
    start() {
      if (listening) return;
      chrome.webNavigation.onCommitted.addListener(handleCommitted);
      chrome.tabs.onRemoved.addListener(handleTabRemoved);
      listening = true;
      deps.logger.info("Redirect chain monitor started");
    },

    stop() {
      if (!listening) return;
      chrome.webNavigation.onCommitted.removeListener(handleCommitted);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
      chains.clear();
      listening = false;
    },

    getChain(tabId: number) {
      return chains.get(tabId);
    },
  };
}
