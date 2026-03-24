/**
 * DNRルール管理 - 純粋関数
 *
 * Chrome API型に依存しないDNRルール操作。
 * chrome.declarativeNetRequest への型キャストは呼び出し側が担当する。
 *
 * 検出戦略:
 * modifyHeaders アクションで無害なレスポンスヘッダーを追加し、
 * getMatchedRules() でマッチを取得する。
 * allow アクションは getMatchedRules() にレポートされないため使用不可。
 */

import { DNR_RULE_ID_BASE, DNR_RULE_ID_MAX } from "./constants.js";

/**
 * DNRルール仕様（Chrome API型非依存）
 */
export interface DNRRuleSpec {
  id: number;
  priority: number;
  action: {
    type: "modifyHeaders";
    responseHeaders: Array<{
      header: string;
      operation: "append";
      value: string;
    }>;
  };
  condition: {
    initiatorDomains: string[];
    resourceTypes: string[];
  };
}

/**
 * 指定されたルールIDがモニター用の範囲内かを判定
 */
export function isMonitorRuleId(ruleId: number): boolean {
  return ruleId >= DNR_RULE_ID_BASE && ruleId < DNR_RULE_ID_MAX;
}

/**
 * Chrome API型に依存しないDNRルール仕様を構築
 *
 * modifyHeaders で無害なヘッダーを追加することで
 * getMatchedRules() による検出を可能にする。
 */
export function buildDNRRuleSpec(
  extensionId: string,
  ruleId: number,
  resourceTypes: string[],
): DNRRuleSpec {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {
          header: "x-pleno-observed",
          operation: "append",
          value: "1",
        },
      ],
    },
    condition: {
      initiatorDomains: [extensionId],
      resourceTypes,
    },
  };
}

/**
 * 拡張機能IDに対応するルールIDをマップから検索
 */
export function findRuleIdByExtensionId(
  ruleMap: ReadonlyMap<number, string>,
  extensionId: string,
): number | null {
  for (const [ruleId, mappedExtensionId] of ruleMap.entries()) {
    if (mappedExtensionId === extensionId) return ruleId;
  }
  return null;
}

/**
 * 未使用の最小ルールIDを返す
 */
export function nextAvailableRuleId(
  ruleMap: ReadonlyMap<number, string>,
): number | null {
  const usedRuleIds = new Set(ruleMap.keys());
  for (let ruleId = DNR_RULE_ID_BASE; ruleId < DNR_RULE_ID_MAX; ruleId++) {
    if (!usedRuleIds.has(ruleId)) return ruleId;
  }
  return null;
}
