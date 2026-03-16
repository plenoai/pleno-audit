import { DEFAULT_NETWORK_CONFIG } from "./constants.js";
import type { NetworkMonitorConfig } from "@pleno-audit/extension-runtime";
import type { DebugBridgeDeps, DebugHandlerResult } from "./types.js";

type NetworkConfigUpdates = {
  enabled?: boolean;
  captureAllRequests?: boolean;
  excludeOwnExtension?: boolean;
};

async function getNetworkConfigFromStorage(): Promise<NetworkMonitorConfig> {
  const storage = await chrome.storage.local.get("networkMonitorConfig") as { networkMonitorConfig?: NetworkMonitorConfig };
  return storage.networkMonitorConfig || DEFAULT_NETWORK_CONFIG;
}

export async function getNetworkConfig(deps?: DebugBridgeDeps): Promise<DebugHandlerResult> {
  try {
    if (deps?.getNetworkMonitorConfig) {
      const config = await deps.getNetworkMonitorConfig();
      return { success: true, data: config };
    }

    const config = await getNetworkConfigFromStorage();
    return {
      success: true,
      data: config,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get network monitor config",
    };
  }
}

export async function setNetworkConfig(
  params: NetworkConfigUpdates,
  deps?: DebugBridgeDeps
): Promise<DebugHandlerResult> {
  try {
    if (deps?.getNetworkMonitorConfig && deps?.setNetworkMonitorConfig) {
      const currentConfig = await deps.getNetworkMonitorConfig();
      const newConfig: NetworkMonitorConfig = {
        ...currentConfig,
        ...params,
      };
      const result = await deps.setNetworkMonitorConfig(newConfig);

      if (!result.success) {
        return { success: false, error: "Failed to set network monitor config" };
      }

      const appliedConfig = await deps.getNetworkMonitorConfig();
      return { success: true, data: appliedConfig };
    }

    const currentConfig = await getNetworkConfigFromStorage();
    const newConfig: NetworkMonitorConfig = {
      ...currentConfig,
      ...params,
    };
    await chrome.storage.local.set({ networkMonitorConfig: newConfig });
    return { success: true, data: newConfig };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set network monitor config",
    };
  }
}
