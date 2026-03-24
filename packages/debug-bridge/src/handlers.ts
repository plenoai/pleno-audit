import type { Logger } from "@libztbs/extension-runtime";
import type { DebugBridgeDeps, DebugHandler, DebugHandlerResult } from "./types.js";
import { getSnapshot } from "./snapshot.js";
import { getStorageKeys, getStorageValue, setStorageValue, clearStorage } from "./storage.js";
import { getServices, getService, clearServices } from "./services.js";
import { openTab } from "./tabs.js";

export type DebugHandlerRegistry = Record<string, DebugHandler>;

export function createDebugHandlers(logger: Logger, deps?: DebugBridgeDeps): DebugHandlerRegistry {
  return {
    DEBUG_PING: async () => ({
      success: true,
      data: {
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        devMode: true,
        timestamp: Date.now(),
      },
    }),
    DEBUG_SNAPSHOT: async () => getSnapshot(logger),
    DEBUG_STORAGE_LIST: async () => getStorageKeys(),
    DEBUG_STORAGE_GET: async (data) => getStorageValue(data as { key: string }),
    DEBUG_STORAGE_SET: async (data) => setStorageValue(data as { key: string; value: unknown }),
    DEBUG_STORAGE_CLEAR: async () => clearStorage(),
    DEBUG_SERVICES_LIST: async () => getServices(),
    DEBUG_SERVICES_GET: async (data) => getService(data as { domain: string }),
    DEBUG_SERVICES_CLEAR: async () => clearServices(),
    DEBUG_TAB_OPEN: async (data) => openTab(data as { url: string }),
    DEBUG_NETWORK_REQUESTS_GET: async (data) => {
      const params = data as { limit?: number; initiatorType?: string };
      if (!deps?.getNetworkRequests) {
        return { success: false, error: "getNetworkRequests not available" };
      }
      const result = await deps.getNetworkRequests(params);
      return { success: true, data: { requests: result.requests, total: result.total } };
    },
  };
}

export async function dispatchDebugHandler(
  handlers: DebugHandlerRegistry,
  type: string,
  data: unknown,
  fallback: DebugHandler
): Promise<DebugHandlerResult> {
  const handler = Object.hasOwn(handlers, type) ? handlers[type] : fallback;
  return handler(data);
}
