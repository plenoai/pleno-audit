/**
 * Network Monitor - DNR Manager
 *
 * declarativeNetRequest API を使用した Service Worker からのリクエスト補完
 * Chrome 111+ で利用可能
 *
 * 純粋なルール管理ロジックは dnr-rules.ts、レート制限は rate-limiter.ts に分離済み
 */

import type { NetworkRequestRecord } from "@libztbs/extension-runtime";
import { createLogger } from "@libztbs/extension-runtime";
import { state, excludedExtensions } from "./state.js";
import { EXCLUDE_OWN_EXTENSION } from "./constants.js";
import {
  EXTENSION_ID_PATTERN,
  DNR_RULE_ID_BASE,
  DNR_RULE_ID_MAX,
  DNR_RESOURCE_TYPES,
  DNR_QUOTA_INTERVAL_MS,
  DNR_MAX_CALLS_PER_INTERVAL,
} from "./constants.js";
import {
  isMonitorRuleId,
  buildDNRRuleSpec,
  findRuleIdByExtensionId,
  nextAvailableRuleId,
  type DNRRuleSpec,
} from "./dnr-rules.js";
import {
  checkDNRRateLimit,
  isAlreadyCoveredByWebRequest,
  pruneRecentHits,
} from "./rate-limiter.js";
import { emitRecord } from "./web-request.js";
import { extractDomain } from "./request-classifier.js";

const logger = createLogger("network-monitor");

// Re-export pure function
export { isMonitorRuleId } from "./dnr-rules.js";

/**
 * DNRRuleSpecをchrome.declarativeNetRequest.Ruleにキャスト
 */
function toChromeRule(spec: DNRRuleSpec): chrome.declarativeNetRequest.Rule {
  return spec as unknown as chrome.declarativeNetRequest.Rule;
}

const DNR_RESOURCE_TYPE_STRINGS = DNR_RESOURCE_TYPES.map(String);

/**
 * DNRルールを登録
 */
export async function registerDNRRulesForExtensions(
  extensionIds: string[],
): Promise<void> {
  if (extensionIds.length === 0) {
    logger.debug({ event: "DNR_RULES_REGISTER_SKIPPED_NO_EXTENSIONS" });
    return;
  }

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    const targetExtensions = extensionIds.slice(
      0,
      DNR_RULE_ID_MAX - DNR_RULE_ID_BASE,
    );
    const nextRuleMap = new Map<number, string>();
    const newRules = targetExtensions.map((extensionId, index) => {
      const ruleId = DNR_RULE_ID_BASE + index;
      nextRuleMap.set(ruleId, extensionId);
      return toChromeRule(
        buildDNRRuleSpec(extensionId, ruleId, DNR_RESOURCE_TYPE_STRINGS),
      );
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: newRules,
    });

    state.dnrRuleToExtensionMap = nextRuleMap;
    state.dnrRulesRegistered = true;
    logger.info({
      event: "DNR_RULES_REGISTERED",
      data: { extensionCount: newRules.length },
    });
  } catch (error) {
    logger.error({ event: "DNR_RULES_REGISTER_FAILED", error });
  }
}

/**
 * tabIdからページURLを取得（ベストエフォート）
 */
async function resolveTabUrl(tabId: number): Promise<string | null> {
  if (tabId < 0) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url ?? null;
  } catch {
    return null;
  }
}

/**
 * DNRマッチルールをチェック
 */
export async function checkMatchedDNRRules(): Promise<NetworkRequestRecord[]> {
  if (!state.dnrRulesRegistered) {
    return [];
  }

  const now = Date.now();
  const rateResult = checkDNRRateLimit(
    {
      dnrQuotaWindowStart: state.dnrQuotaWindowStart,
      dnrCallCount: state.dnrCallCount,
      lastDNRCallTime: state.lastDNRCallTime,
    },
    now,
  );

  state.dnrQuotaWindowStart = rateResult.next.dnrQuotaWindowStart;
  state.dnrCallCount = rateResult.next.dnrCallCount;
  state.lastDNRCallTime = rateResult.next.lastDNRCallTime;

  if (!rateResult.allowed) {
    return [];
  }

  const checkWindow = state.lastMatchedRulesCheck;

  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: checkWindow,
    });

    state.lastMatchedRulesCheck = now;
    const cutoff = Math.max(checkWindow, now - DNR_QUOTA_INTERVAL_MS);
    pruneRecentHits(state.recentWebRequestHits, cutoff);

    const records: NetworkRequestRecord[] = [];
    const tabUrlCache = new Map<number, string | null>();

    for (const info of matchedRules.rulesMatchedInfo) {
      const ruleId = info.rule.ruleId;
      if (!isMonitorRuleId(ruleId)) {
        continue;
      }

      const extensionId = state.dnrRuleToExtensionMap.get(ruleId);
      if (!extensionId) continue;
      if (excludedExtensions.has(extensionId)) continue;

      if (
        isAlreadyCoveredByWebRequest(
          state.recentWebRequestHits,
          extensionId,
          info.tabId,
          checkWindow,
        )
      ) {
        continue;
      }

      const extInfo = state.knownExtensions.get(extensionId);

      let tabUrl: string | null;
      if (tabUrlCache.has(info.tabId)) {
        tabUrl = tabUrlCache.get(info.tabId) ?? null;
      } else {
        tabUrl = await resolveTabUrl(info.tabId);
        tabUrlCache.set(info.tabId, tabUrl);
      }

      const record: NetworkRequestRecord = {
        id: crypto.randomUUID(),
        timestamp: info.timeStamp,
        url: tabUrl ?? `[DNR detected - tabId: ${info.tabId}]`,
        method: "UNKNOWN",
        domain: tabUrl ? extractDomain(tabUrl) : "unknown",
        resourceType: "xmlhttprequest",
        initiator: `chrome-extension://${extensionId}`,
        initiatorType: "extension",
        extensionId,
        extensionName: extInfo?.name,
        tabId: info.tabId,
        frameId: 0,
        detectedBy: "declarativeNetRequest",
      };

      records.push(record);
      emitRecord(record);
    }

    if (records.length > 0) {
      logger.info({
        event: "DNR_SUPPLEMENTAL_REQUESTS_DETECTED",
        data: { requestCount: records.length },
      });
    }

    return records;
  } catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes("quota") || errorMessage.includes("QUOTA")) {
      logger.warn({ event: "DNR_QUOTA_EXCEEDED_ENTER_BACKOFF" });
      state.dnrCallCount = DNR_MAX_CALLS_PER_INTERVAL;
      return [];
    }
    logger.error({ event: "DNR_MATCHED_RULES_CHECK_FAILED", error });
    return [];
  }
}

/**
 * DNRルールをクリア
 */
export async function clearDNRRules(): Promise<void> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    state.dnrRulesRegistered = false;
    state.dnrRuleToExtensionMap.clear();
    logger.debug({ event: "DNR_RULES_CLEARED" });
  } catch (error) {
    logger.error({ event: "DNR_RULES_CLEAR_FAILED", error });
  }
}

/**
 * 単一の拡張機能のDNRルールを追加
 */
export async function addDNRRuleForExtension(
  extensionId: string,
): Promise<void> {
  if (!extensionId || !EXTENSION_ID_PATTERN.test(extensionId)) {
    logger.warn({
      event: "DNR_INVALID_EXTENSION_ID_FORMAT",
      data: { extensionId },
    });
    return;
  }

  try {
    if (
      findRuleIdByExtensionId(state.dnrRuleToExtensionMap, extensionId) !==
      null
    ) {
      return;
    }

    const ruleId = nextAvailableRuleId(state.dnrRuleToExtensionMap);
    if (ruleId === null) {
      logger.warn({
        event: "DNR_RULE_ADD_SKIPPED_NO_AVAILABLE_RULE_ID",
        data: { extensionId },
      });
      return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        toChromeRule(
          buildDNRRuleSpec(extensionId, ruleId, DNR_RESOURCE_TYPE_STRINGS),
        ),
      ],
    });
    state.dnrRuleToExtensionMap.set(ruleId, extensionId);
    logger.info({
      event: "DNR_RULE_ADDED_FOR_EXTENSION",
      data: { extensionId, ruleId },
    });
  } catch (error) {
    logger.error({
      event: "DNR_RULE_ADD_FAILED",
      data: { extensionId },
      error,
    });
  }
}

/**
 * 拡張機能のDNRルールを削除
 */
export async function removeDNRRuleForExtension(
  extensionId: string,
): Promise<void> {
  try {
    const ruleIdToRemove = findRuleIdByExtensionId(
      state.dnrRuleToExtensionMap,
      extensionId,
    );
    if (ruleIdToRemove === null) return;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleIdToRemove],
    });
    state.dnrRuleToExtensionMap.delete(ruleIdToRemove);
    logger.info({
      event: "DNR_RULE_REMOVED_FOR_EXTENSION",
      data: { extensionId, ruleId: ruleIdToRemove },
    });
  } catch (error) {
    logger.error({
      event: "DNR_RULE_REMOVE_FAILED",
      data: { extensionId },
      error,
    });
  }
}

/**
 * DNRマッピングを復元
 */
export async function restoreDNRMapping(): Promise<boolean> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const relevantRules = existingRules.filter((rule) =>
      isMonitorRuleId(rule.id),
    );

    state.dnrRuleToExtensionMap.clear();
    let needsReconciliation = false;
    for (const rule of relevantRules) {
      if (rule.condition?.initiatorDomains?.length === 1) {
        const extensionId = rule.condition.initiatorDomains[0];
        if (!EXTENSION_ID_PATTERN.test(extensionId)) {
          needsReconciliation = true;
          continue;
        }

        if (
          (EXCLUDE_OWN_EXTENSION &&
            extensionId === state.ownExtensionId) ||
          excludedExtensions.has(extensionId)
        ) {
          needsReconciliation = true;
          continue;
        }

        state.dnrRuleToExtensionMap.set(rule.id, extensionId);
        continue;
      }

      needsReconciliation = true;
    }

    state.dnrRulesRegistered = state.dnrRuleToExtensionMap.size > 0;
    logger.info({
      event: "DNR_MAPPING_RESTORED",
      data: { ruleCount: state.dnrRuleToExtensionMap.size },
    });
    return needsReconciliation;
  } catch (error) {
    logger.error({ event: "DNR_MAPPING_RESTORE_FAILED", error });
    return true;
  }
}
