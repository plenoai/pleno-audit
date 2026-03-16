/**
 * Network Monitor - Web Request Handler
 *
 * webRequest API を使用したネットワークリクエストの監視
 */

import type {
  NetworkRequestRecord,
  InitiatorType,
} from "../storage-types.js";
import { createLogger } from "../logger.js";
import { state, ensureConfigCachesCurrent } from "./state.js";

const logger = createLogger("network-monitor");

/**
 * initiatorからタイプを判定
 */
export function classifyInitiator(initiator: string | undefined): InitiatorType {
  if (!initiator) return "browser";
  if (initiator.startsWith("chrome-extension://")) return "extension";
  if (initiator.startsWith("http://") || initiator.startsWith("https://")) {
    return "page";
  }
  return "unknown";
}

/**
 * 拡張機能IDを抽出
 */
export function extractExtensionId(initiator: string): string | null {
  const match = initiator.match(/^chrome-extension:\/\/([a-z]{32})/);
  return match?.[1] ?? null;
}

/**
 * ドメインを抽出
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * レコードをコールバックに通知
 */
export function emitRecord(record: NetworkRequestRecord): void {
  for (const callback of state.callbacks) {
    try {
      callback(record);
    } catch (error) {
      logger.error("Callback error:", error);
    }
  }
}

/**
 * webRequestリスナーのハンドラー
 * 全ネットワークリクエストを処理
 */
export function handleWebRequest(details: chrome.webRequest.OnBeforeRequestDetails): chrome.webRequest.BlockingResponse | undefined {
  ensureConfigCachesCurrent();

  if (!state.config.enabled) return;

  const initiatorType = classifyInitiator(details.initiator);
  if (!state.config.captureAllRequests && initiatorType !== "extension") {
    return;
  }

  let extensionId: string | undefined;
  let extensionName: string | undefined;

  if (initiatorType === "extension" && details.initiator) {
    extensionId = extractExtensionId(details.initiator) ?? undefined;

    if (
      state.config.excludeOwnExtension &&
      extensionId &&
      extensionId === state.ownExtensionId
    ) {
      return;
    }

    if (extensionId && state.excludedExtensions.has(extensionId)) {
      return;
    }

    extensionName = extensionId
      ? state.knownExtensions.get(extensionId)?.name
      : undefined;
  }

  const domain = extractDomain(details.url);
  if (state.excludedDomains.has(domain)) return;

  const now = Date.now();
  const record: NetworkRequestRecord = {
    id: crypto.randomUUID(),
    timestamp: now,
    url: details.url,
    method: details.method,
    domain,
    resourceType: details.type,
    initiator: details.initiator || null,
    initiatorType,
    extensionId,
    extensionName,
    tabId: details.tabId,
    frameId: details.frameId,
    detectedBy: "webRequest",
  };

  if (extensionId) {
    state.recentWebRequestHits.set(`${extensionId}:${details.tabId}`, now);
  }

  logger.debug("Network request detected:", {
    initiatorType,
    domain,
    resourceType: details.type,
  });

  emitRecord(record);
}

/**
 * webRequestリスナーを同期的に登録
 */
export function registerNetworkMonitorListener(): void {
  if (state.listenerRegistered) {
    logger.debug("Network monitor listener already registered");
    return;
  }

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      handleWebRequest,
      { urls: ["<all_urls>"] }
    );
    state.listenerRegistered = true;
    logger.info("webRequest.onBeforeRequest listener registered for all requests");
  } catch (error) {
    logger.error("Failed to register webRequest listener:", error);
  }
}
