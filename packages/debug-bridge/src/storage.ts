import type { DebugHandlerResult } from "./types.js";

export async function getStorageKeys(): Promise<DebugHandlerResult> {
  const storage = await chrome.storage.local.get(null);
  return { success: true, data: Object.keys(storage) };
}

export async function getStorageValue(params: { key: string }): Promise<DebugHandlerResult> {
  const storage = await chrome.storage.local.get(params.key);
  return { success: true, data: storage[params.key] };
}

export function isValidStorageKey(key: string): boolean {
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  return typeof key === "string" && key.length > 0 && !dangerousKeys.includes(key);
}

export async function setStorageValue(params: {
  key: string;
  value: unknown;
}): Promise<DebugHandlerResult> {
  if (!isValidStorageKey(params.key)) {
    return { success: false, error: "Invalid storage key" };
  }
  const data: Record<string, unknown> = Object.create(null);
  data[params.key] = params.value;
  await chrome.storage.local.set(data);
  return { success: true };
}

export async function clearStorage(): Promise<DebugHandlerResult> {
  await chrome.storage.local.clear();
  return { success: true };
}
