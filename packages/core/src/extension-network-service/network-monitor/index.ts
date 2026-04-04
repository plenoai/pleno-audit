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

import {
  createLogger,
} from "../../extension-runtime/index.js";
import {
  globalExtensionStatsCache,
  detectAllSuspiciousPatterns,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
  startExtensionLifecycleMonitor,
  stopExtensionLifecycleMonitor,
  onExtensionLifecycle,
} from "../../extension-analyzers/index.js";

// Internal modules
import { state, excludedExtensions, clearGlobalCallbacks } from "./state.js";
import { CAPTURE_ALL_REQUESTS } from "./constants.js";
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
  ownExtensionId: string
): import("./types.js").NetworkMonitor {
  state.ownExtensionId = ownExtensionId;

  let unsubscribeLifecycle: (() => void) | undefined;

  return {
    async start() {
      if (!state.listenerRegistered) {
        registerNetworkMonitorListener();
      }

      await refreshExtensionList();
      logger.info(
        `Network monitor started: capturing ${CAPTURE_ALL_REQUESTS ? "all" : "extension"} requests`
      );

      let mappingRestored = false;
      if (!state.dnrRulesRegistered && state.dnrRuleToExtensionMap.size === 0) {
        const needsReconciliation = await restoreDNRMapping();
        mappingRestored =
          state.dnrRuleToExtensionMap.size > 0 && !needsReconciliation;
      }

      if (!state.managementListenersRegistered) {
        startExtensionLifecycleMonitor(ownExtensionId);
        unsubscribeLifecycle = onExtensionLifecycle((event) => {
          if (excludedExtensions.has(event.extensionId)) return;

          if (event.type === "installed" || event.type === "enabled") {
            refreshExtensionList().catch((error) => {
              logger.debug(`Failed to refresh extension list on ${event.type}`, error);
            });
            if (event.type === "installed") {
              addDNRRuleForExtension(event.extensionId).catch((error) => {
                logger.debug(`Failed to add DNR rule for ${event.extensionId}`, error);
              });
            }
          } else if (event.type === "uninstalled" || event.type === "disabled") {
            refreshExtensionList().catch((error) => {
              logger.debug(`Failed to refresh extension list on ${event.type}`, error);
            });
            if (event.type === "uninstalled") {
              removeDNRRuleForExtension(event.extensionId).catch((error) => {
                logger.debug(`Failed to remove DNR rule for ${event.extensionId}`, error);
              });
            }
          }
        });
        state.managementListenersRegistered = true;
      }

      if (!mappingRestored) {
        const otherExtensionIds = Array.from(getKnownExtensions().keys()).filter(
          (extensionId) =>
            extensionId !== ownExtensionId &&
            !excludedExtensions.has(extensionId)
        );
        await registerDNRRulesForExtensions(otherExtensionIds);
      }
    },

    async stop() {
      if (state.managementListenersRegistered) {
        unsubscribeLifecycle?.();
        unsubscribeLifecycle = undefined;
        stopExtensionLifecycleMonitor();
        state.managementListenersRegistered = false;
      }
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
