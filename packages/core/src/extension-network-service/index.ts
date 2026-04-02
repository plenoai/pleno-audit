import { createExtensionNetworkState } from "./state.js";
import type { ExtensionNetworkService, ExtensionNetworkServiceDeps } from "./types.js";
import { getNetworkRequests, getExtensionRequests } from "./requests.js";
import {
  initExtensionMonitor,
  stopExtensionMonitor,
  checkDNRMatchesHandler,
  getKnownExtensions,
} from "./monitor.js";
import {
  analyzeExtensionRisks,
  getAllExtensionRisks,
  getExtensionRiskAnalysis,
} from "./risk-analysis.js";
import { getExtensionStats } from "./stats.js";

export type { ExtensionStats } from "./helpers.js";
export type { ExtensionNetworkService, ExtensionNetworkServiceDeps } from "./types.js";

// Network Monitor public API
export {
  createNetworkMonitor,
  registerNetworkMonitorListener,
  clearGlobalCallbacks,
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
} from "./network-monitor/index.js";
export type { NetworkMonitor, ExtensionInfo } from "./network-monitor/types.js";

export function createExtensionNetworkService(
  deps: ExtensionNetworkServiceDeps
): ExtensionNetworkService {
  const context = {
    deps,
    state: createExtensionNetworkState(),
  };

  return {
    initExtensionMonitor: () => initExtensionMonitor(context),
    stopExtensionMonitor: () => stopExtensionMonitor(context),
    checkDNRMatchesHandler: () => checkDNRMatchesHandler(context),
    getNetworkRequests: (options) => getNetworkRequests(context, options),
    getExtensionRequests: (options) => getExtensionRequests(context, options),
    getKnownExtensions: () => getKnownExtensions(context),
    getExtensionStats: () => getExtensionStats(context),
    analyzeExtensionRisks: () => analyzeExtensionRisks(context),
    getExtensionRiskAnalysis: (extensionId) => getExtensionRiskAnalysis(context, extensionId),
    getAllExtensionRisks: () => getAllExtensionRisks(context),
  };
}
