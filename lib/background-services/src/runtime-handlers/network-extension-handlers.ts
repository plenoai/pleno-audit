import type { NetworkMonitorConfig } from "@libztbs/extension-runtime";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createNetworkAndExtensionHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_NETWORK_REQUESTS", {
      execute: (message) => deps.getNetworkRequests(message.data as {
        limit?: number;
        offset?: number;
        since?: number;
        initiatorType?: "extension" | "page" | "browser" | "unknown";
      }),
      fallback: () => ({ requests: [], total: 0 }),
    }],
    ["GET_EXTENSION_REQUESTS", {
      execute: (message) => deps.getExtensionRequests(message.data as { limit?: number; offset?: number }),
      fallback: () => ({ requests: [], total: 0 }),
    }],
    ["GET_EXTENSION_STATS", {
      execute: () => deps.getExtensionStats(),
      fallback: () => ({ byExtension: {}, byDomain: {}, total: 0 }),
    }],
    ["GET_NETWORK_MONITOR_CONFIG", {
      execute: () => deps.getNetworkMonitorConfig(),
      fallback: () => deps.fallbacks.networkMonitorConfig,
    }],
    ["SET_NETWORK_MONITOR_CONFIG", {
      execute: (message) => deps.setNetworkMonitorConfig(message.data as NetworkMonitorConfig),
      fallback: () => ({ success: false }),
    }],
    ["GET_ALL_EXTENSION_RISKS", {
      execute: () => deps.getAllExtensionRisks(),
      fallback: () => [],
    }],
    ["GET_EXTENSION_RISK_ANALYSIS", {
      execute: (message) => deps.getExtensionRiskAnalysis((message.data as { extensionId: string }).extensionId),
      fallback: () => null,
    }],
    ["TRIGGER_EXTENSION_RISK_ANALYSIS", {
      execute: async () => {
        await deps.analyzeExtensionRisks();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
  ];
}
