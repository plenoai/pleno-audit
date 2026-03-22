/**
 * Network Monitor
 *
 * 全ネットワークリクエストを監視・記録するコア機能
 * CSPと並ぶセキュリティposture（態勢）可視化のための基盤
 *
 * 監視方式:
 * 1. webRequest.onBeforeRequest - 全リクエストを検出
 * 2. declarativeNetRequest - Service Workerからのリクエスト補完（Chrome 111+）
 *
 * MV3 Service Worker対応:
 * - webRequest.onBeforeRequestリスナーは同期的にトップレベルで登録する必要がある
 * - Service Workerの再起動時にリスナーが維持されるように設計
 */

import type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
} from "@pleno-audit/extension-runtime";
import {
  createLogger,
  globalExtensionStatsCache,
  detectAllSuspiciousPatterns,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
} from "@pleno-audit/extension-runtime";

// Internal modules
import { state, applyConfig, clearGlobalCallbacks } from "./state.js";
import { EXTENSION_ID_PATTERN } from "./constants.js";
import { registerNetworkMonitorListener } from "./web-request.js";
import {
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
  restoreDNRMapping,
} from "./dnr-manager.js";
import { refreshExtensionList, getKnownExtensions } from "./extension-tracker.js";
import { toExtensionRequestRecords } from "./utils.js";

// Re-exports for public API
export { clearGlobalCallbacks } from "./state.js";
export { registerNetworkMonitorListener } from "./web-request.js";
export {
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
} from "./dnr-manager.js";

// Re-export types
export type { ExtensionInfo, NetworkMonitor } from "./types.js";

const logger = createLogger("network-monitor");

/**
 * Network Monitorを作成
 */
export function createNetworkMonitor(
  config: NetworkMonitorConfig,
  ownExtensionId: string
): import("./types.js").NetworkMonitor {
  applyConfig(config);
  state.ownExtensionId = ownExtensionId;

  function handleInstalled(info: chrome.management.ExtensionInfo): void {
    if (info.type !== "extension") return;
    if (info.id === ownExtensionId) return;
    if (state.excludedExtensions.has(info.id)) return;

    refreshExtensionList().catch((error) => {
      logger.debug("Failed to refresh extension list on install", error);
    });
    addDNRRuleForExtension(info.id).catch((error) => {
      logger.debug(`Failed to add DNR rule for ${info.id}`, error);
    });
  }

  function handleUninstalled(extensionId: string): void {
    refreshExtensionList().catch((error) => {
      logger.debug("Failed to refresh extension list on uninstall", error);
    });
    removeDNRRuleForExtension(extensionId).catch((error) => {
      logger.debug(`Failed to remove DNR rule for ${extensionId}`, error);
    });
  }

  return {
    async start() {
      if (!state.config.enabled) {
        logger.debug("Network monitor disabled by config");
        return;
      }

      if (!state.listenerRegistered) {
        registerNetworkMonitorListener();
      }

      await refreshExtensionList();
      logger.info(
        `Network monitor started: capturing ${state.config.captureAllRequests ? "all" : "extension"} requests`
      );

      let mappingRestored = false;
      if (!state.dnrRulesRegistered && state.dnrRuleToExtensionMap.size === 0) {
        const needsReconciliation = await restoreDNRMapping();
        mappingRestored =
          state.dnrRuleToExtensionMap.size > 0 && !needsReconciliation;
      }

      if (!state.managementListenersRegistered) {
        chrome.management.onInstalled.addListener(handleInstalled);
        chrome.management.onUninstalled.addListener(handleUninstalled);
        state.managementListenersRegistered = true;
      }

      if (!mappingRestored) {
        const otherExtensionIds = Array.from(getKnownExtensions().keys()).filter(
          (extensionId) =>
            extensionId !== ownExtensionId &&
            !state.excludedExtensions.has(extensionId)
        );
        await registerDNRRulesForExtensions(otherExtensionIds);
      }
    },

    async stop() {
      if (state.managementListenersRegistered) {
        chrome.management.onInstalled.removeListener(handleInstalled);
        chrome.management.onUninstalled.removeListener(handleUninstalled);
        state.managementListenersRegistered = false;
      }
      applyConfig({ ...state.config, enabled: false });
      clearGlobalCallbacks();
      await clearDNRRules();
    },

    getKnownExtensions,

    onRequest(callback) {
      state.callbacks.push(callback);
    },

    refreshExtensionList,

    checkDNRMatches: checkMatchedDNRRules,

    generateStats(records) {
      return globalExtensionStatsCache.getStats(toExtensionRequestRecords(records));
    },

    detectSuspiciousPatterns(records) {
      return detectAllSuspiciousPatterns(
        toExtensionRequestRecords(records),
        DEFAULT_SUSPICIOUS_PATTERN_CONFIG
      );
    },
  };
}
