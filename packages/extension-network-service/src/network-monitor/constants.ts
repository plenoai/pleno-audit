/**
 * Network Monitor - Constants
 *
 * DNR関連定数とその意図を明確にするコメント
 */

/**
 * 拡張機能IDのパターン（32文字の小文字英字）
 */
export const EXTENSION_ID_PATTERN = /^[a-z]{32}$/;

// ============================================================================
// declarativeNetRequest (DNR) 関連定数
// ============================================================================

/**
 * DNRルールID範囲の開始値
 *
 * 他のDNRルール（例: 広告ブロッカー）と競合しないよう、
 * 10000から始まる専用範囲を使用
 */
export const DNR_RULE_ID_BASE = 10000;

/**
 * DNRルールID範囲の最大値（排他的上限）
 *
 * 100個のルールスロットを確保（10000〜10099）。DNR_RULE_ID_MAX は排他的上限。
 * これにより最大100個の拡張機能を同時監視可能
 */
export const DNR_RULE_ID_MAX = 10100;

/**
 * DNRルールの容量（監視可能な拡張機能の最大数）
 */
export const DNR_RULE_CAPACITY = DNR_RULE_ID_MAX - DNR_RULE_ID_BASE;

// ============================================================================
// DNR API レート制限対策
// ============================================================================

/**
 * DNR API呼び出しのクォータ間隔（10分）
 *
 * Chrome の declarativeNetRequest.getMatchedRules() には
 * 10分間に20回という呼び出し制限がある
 */
export const DNR_QUOTA_INTERVAL_MS = 10 * 60 * 1000;

/**
 * クォータ間隔内の最大呼び出し回数
 *
 * Chromeの制限20回に対して安全マージンを取り18回に設定
 */
export const DNR_MAX_CALLS_PER_INTERVAL = 18;

/**
 * DNR API呼び出しの最小間隔（35秒）
 *
 * レート制限に引っかからないよう、連続呼び出しを防止
 * 10分 / 18回 ≈ 33秒 に安全マージンを追加
 */
export const DNR_MIN_INTERVAL_MS = 35 * 1000;

/**
 * DNRリソースタイプを解決
 *
 * Chrome 111以降でResourceTypeが利用可能
 * 利用不可能な場合はフォールバック値を使用
 * 非拡張機能コンテキスト（テスト等）ではフォールバック値を返す
 */
export function resolveDNRResourceTypes(): chrome.declarativeNetRequest.ResourceType[] {
  // 非拡張機能コンテキスト（テスト環境など）ではchromeグローバルが存在しない
  if (typeof chrome === "undefined" || !chrome.declarativeNetRequest) {
    return [
      "xmlhttprequest",
      "other",
      "script",
      "sub_frame",
      "image",
    ] as chrome.declarativeNetRequest.ResourceType[];
  }

  const resourceType = chrome.declarativeNetRequest.ResourceType;
  if (!resourceType) {
    return [
      "xmlhttprequest",
      "other",
      "script",
      "sub_frame",
      "image",
    ] as chrome.declarativeNetRequest.ResourceType[];
  }

  return [
    resourceType.XMLHTTPREQUEST,
    resourceType.OTHER,
    resourceType.SCRIPT,
    resourceType.SUB_FRAME,
    resourceType.IMAGE,
  ];
}

/**
 * 監視対象のDNRリソースタイプ
 */
export const DNR_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] =
  resolveDNRResourceTypes();
