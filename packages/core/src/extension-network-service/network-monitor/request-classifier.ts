/**
 * Request Classifier - Pure request classification logic
 *
 * webRequest の詳細情報からレコード構築の判定・実行を行う純粋関数群。
 * 副作用（状態読み書き、コールバック発火）を一切持たない。
 */

import type {
  InitiatorType,
  NetworkRequestRecord,
} from "../../extension-runtime/index.js";

/**
 * initiatorからタイプを判定
 */
export function classifyInitiator(
  initiator: string | undefined,
): InitiatorType {
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
 * webRequestの詳細情報からNetworkRequestRecordを構築するための入力
 */
export interface WebRequestDetails {
  url: string;
  method: string;
  type: string;
  initiator?: string | null;
  tabId: number;
  frameId: number;
}

/**
 * 分類判定に必要なコンテキスト（呼び出し元が状態から構築して渡す）
 */
export interface RequestClassificationContext {
  ownExtensionId: string;
  excludeOwnExtension: boolean;
  excludedExtensions: ReadonlySet<string>;
  excludedDomains: ReadonlySet<string>;
  captureAllRequests: boolean;
  resolveExtensionName: (extensionId: string) => string | undefined;
}

export type ClassifyResult =
  | { action: "skip" }
  | { action: "record"; record: Omit<NetworkRequestRecord, "id"> };

const SKIP: ClassifyResult = { action: "skip" } as const;

/**
 * webRequestの詳細からレコード構築を判定・実行する純粋関数
 *
 * 1. initiatorを分類
 * 2. captureAllRequests でなく extension でもなければ skip
 * 3. extension の場合、自拡張・除外拡張をチェック
 * 4. ドメイン除外をチェック
 * 5. レコードを構築して返す（id は呼び出し元で付与）
 */
export function classifyWebRequest(
  details: WebRequestDetails,
  context: RequestClassificationContext,
  now: number,
): ClassifyResult {
  const initiator = details.initiator ?? undefined;
  const initiatorType = classifyInitiator(initiator);

  if (!context.captureAllRequests && initiatorType !== "extension") {
    return SKIP;
  }

  let extensionId: string | undefined;
  let extensionName: string | undefined;

  if (initiatorType === "extension" && initiator) {
    extensionId = extractExtensionId(initiator) ?? undefined;

    if (
      context.excludeOwnExtension &&
      extensionId &&
      extensionId === context.ownExtensionId
    ) {
      return SKIP;
    }

    if (extensionId && context.excludedExtensions.has(extensionId)) {
      return SKIP;
    }

    extensionName = extensionId
      ? context.resolveExtensionName(extensionId)
      : undefined;
  }

  const domain = extractDomain(details.url);
  if (context.excludedDomains.has(domain)) {
    return SKIP;
  }

  return {
    action: "record",
    record: {
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
    },
  };
}
