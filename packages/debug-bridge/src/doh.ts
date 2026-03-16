import { DEFAULT_DOH_CONFIG } from "./constants.js";
import type { DebugHandlerResult } from "./types.js";

export async function getDoHConfig(): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("doHMonitorConfig");
    return {
      success: true,
      data: storage.doHMonitorConfig || DEFAULT_DOH_CONFIG,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get DoH config",
    };
  }
}

export async function setDoHConfig(params: {
  action?: string;
  maxStoredRequests?: number;
}): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("doHMonitorConfig");
    const currentConfig = storage.doHMonitorConfig || DEFAULT_DOH_CONFIG;
    const newConfig = { ...currentConfig, ...params };
    await chrome.storage.local.set({ doHMonitorConfig: newConfig });

    chrome.runtime
      .sendMessage({
        type: "SET_DOH_MONITOR_CONFIG",
        data: params,
      })
      .catch((err) => {
        console.warn("[doh] Failed to notify SET_DOH_MONITOR_CONFIG:", err);
      });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set DoH config",
    };
  }
}

export async function getDoHRequests(params?: {
  limit?: number;
  offset?: number;
}): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("doHRequests") as Record<string, unknown>;
    const allRequests = (storage.doHRequests as Array<{ timestamp: number }>) || [];
    const total = allRequests.length;

    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    const sorted = [...allRequests].sort(
      (a: { timestamp: number }, b: { timestamp: number }) => b.timestamp - a.timestamp
    );
    const requests = sorted.slice(offset, offset + limit);

    return {
      success: true,
      data: { requests, total },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get DoH requests",
    };
  }
}
