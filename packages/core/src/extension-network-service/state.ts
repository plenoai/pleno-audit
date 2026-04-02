import type { ExtensionNetworkState } from "./types.js";

export function createExtensionNetworkState(): ExtensionNetworkState {
  return {
    extensionMonitor: null,
    cooldownManager: null,
    requestBuffer: [],
  };
}
