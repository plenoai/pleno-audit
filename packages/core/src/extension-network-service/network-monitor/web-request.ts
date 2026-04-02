/**
 * Network Monitor - Web Request Handler
 *
 * webRequest API を使用したネットワークリクエストの監視
 * 純粋なリクエスト分類ロジックは request-classifier.ts に分離済み
 */

import { createLogger } from "../../extension-runtime/index.js";
import type { NetworkRequestRecord } from "../../extension-runtime/index.js";
import { state, excludedExtensions, excludedDomains } from "./state.js";
import {
  CAPTURE_ALL_REQUESTS,
  EXCLUDE_OWN_EXTENSION,
} from "./constants.js";
import {
  classifyWebRequest,
  type RequestClassificationContext,
} from "./request-classifier.js";

const logger = createLogger("network-monitor");

// Re-export pure functions for external consumers
export {
  classifyInitiator,
  extractExtensionId,
  extractDomain,
} from "./request-classifier.js";

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
 * 現在のグローバル状態からRequestClassificationContextを構築
 */
function buildClassificationContext(): RequestClassificationContext {
  return {
    ownExtensionId: state.ownExtensionId,
    excludeOwnExtension: EXCLUDE_OWN_EXTENSION,
    excludedExtensions,
    excludedDomains,
    captureAllRequests: CAPTURE_ALL_REQUESTS,
    resolveExtensionName: (extensionId) =>
      state.knownExtensions.get(extensionId)?.name,
  };
}

/**
 * webRequestリスナーのハンドラー
 * 全ネットワークリクエストを処理
 */
export function handleWebRequest(
  details: chrome.webRequest.OnBeforeRequestDetails,
): chrome.webRequest.BlockingResponse | undefined {
  const result = classifyWebRequest(
    details,
    buildClassificationContext(),
    Date.now(),
  );

  if (result.action === "skip") return;

  const record: NetworkRequestRecord = {
    id: crypto.randomUUID(),
    ...result.record,
  };

  if (record.extensionId) {
    state.recentWebRequestHits.set(
      `${record.extensionId}:${details.tabId}`,
      record.timestamp,
    );
  }

  logger.debug("Network request detected:", {
    initiatorType: record.initiatorType,
    domain: record.domain,
    resourceType: record.resourceType,
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
    chrome.webRequest.onBeforeRequest.addListener(handleWebRequest, {
      urls: ["<all_urls>"],
    });
    state.listenerRegistered = true;
    logger.info(
      "webRequest.onBeforeRequest listener registered for all requests",
    );
  } catch (error) {
    logger.error("Failed to register webRequest listener:", error);
  }
}
