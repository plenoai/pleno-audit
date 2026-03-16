import type { DebugHandlerResult } from "./types.js";

export async function getServices(): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("services");
    return { success: true, data: storage.services || {} };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load services" };
  }
}

export async function getService(params: { domain: string }): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("services") as Record<string, Record<string, unknown>>;
    const services = storage.services || {};
    return { success: true, data: services[params.domain] || null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load service" };
  }
}

export async function clearServices(): Promise<DebugHandlerResult> {
  try {
    await chrome.storage.local.remove("services");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to clear services" };
  }
}
