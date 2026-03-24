/**
 * 型安全なストレージアクセス層
 */
import type {
  StorageData,
  CSPConfig,
  DetectedService,
  AIMonitorConfig,
  DetectionConfig,
  BlockingConfig,
} from "./storage-types.js";
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./storage-types.js";
import type { NRDConfig } from "@libztbs/nrd";
import { DEFAULT_NRD_CONFIG } from "@libztbs/nrd";
import { DEFAULT_CSP_CONFIG } from "@libztbs/csp";
import { DEFAULT_AI_MONITOR_CONFIG } from "@libztbs/ai-detector";
import { DEFAULT_DOH_MONITOR_CONFIG } from "./doh-monitor.js";
import { getBrowserAPI } from "./browser-adapter.js";

const STORAGE_KEYS = [
  "services",
  "policyConfig",
  "alerts",
  "cspConfig",
  "generatedCSPPolicy",
  "aiMonitorConfig",
  "nrdConfig",
  "networkMonitorConfig",
  "doHMonitorConfig",
  "detectionConfig",
  "blockingConfig",
  "notificationConfig",
  "alertCooldown",
] as const;
type StorageKey = (typeof STORAGE_KEYS)[number];

let storageQueue: Promise<void> = Promise.resolve();

export function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storageQueue = storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

export async function getStorage(): Promise<StorageData> {
  const api = getBrowserAPI();
  const result = await api.storage.local.get(STORAGE_KEYS as unknown as string[]);
  return {
    services: (result.services as Record<string, DetectedService>) || {},
    policyConfig: result.policyConfig as StorageData["policyConfig"],
    alerts: (result.alerts as StorageData["alerts"]) || [],
    cspConfig: (result.cspConfig as CSPConfig) || DEFAULT_CSP_CONFIG,
    aiMonitorConfig:
      (result.aiMonitorConfig as AIMonitorConfig) || DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: (result.nrdConfig as NRDConfig) || DEFAULT_NRD_CONFIG,
    networkMonitorConfig:
      (result.networkMonitorConfig as StorageData["networkMonitorConfig"]) ||
      DEFAULT_NETWORK_MONITOR_CONFIG,
    doHMonitorConfig:
      (result.doHMonitorConfig as StorageData["doHMonitorConfig"]) ||
      DEFAULT_DOH_MONITOR_CONFIG,
    detectionConfig:
      (result.detectionConfig as DetectionConfig) || DEFAULT_DETECTION_CONFIG,
    blockingConfig:
      (result.blockingConfig as BlockingConfig) || DEFAULT_BLOCKING_CONFIG,
    notificationConfig:
      (result.notificationConfig as StorageData["notificationConfig"]) ||
      DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: (result.alertCooldown as StorageData["alertCooldown"]) || {},
  };
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  const api = getBrowserAPI();
  await api.storage.local.set(data);
}

export async function getStorageKey<K extends StorageKey>(
  key: K
): Promise<StorageData[K]> {
  const api = getBrowserAPI();
  const result = await api.storage.local.get([key]);
  const defaults: StorageData = {
    services: {},
    alerts: [],
    cspConfig: DEFAULT_CSP_CONFIG,
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    networkMonitorConfig: DEFAULT_NETWORK_MONITOR_CONFIG,
    doHMonitorConfig: DEFAULT_DOH_MONITOR_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    blockingConfig: DEFAULT_BLOCKING_CONFIG,
    notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: {},
  };
  return (result[key] as StorageData[K]) ?? defaults[key];
}

export async function getServiceCount(): Promise<number> {
  const services = await getStorageKey("services");
  return Object.keys(services).length;
}

/**
 * 全ストレージをクリアし、設定をデフォルトに戻す
 * @param options.preserveTheme - trueの場合テーマ設定を維持
 */
export async function clearAllStorage(options?: { preserveTheme?: boolean }): Promise<void> {
  const api = getBrowserAPI();

  // テーマ設定を保存（オプション）
  let savedTheme: string | undefined;
  if (options?.preserveTheme) {
    const result = await api.storage.local.get(["themeMode"]);
    savedTheme = result.themeMode as string | undefined;
  }

  // 全ストレージをクリア
  await api.storage.local.clear();

  // デフォルト設定を復元
  const defaultSettings: Partial<StorageData> = {
    services: {},
    alerts: [],
    cspConfig: DEFAULT_CSP_CONFIG,
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    networkMonitorConfig: DEFAULT_NETWORK_MONITOR_CONFIG,
    doHMonitorConfig: DEFAULT_DOH_MONITOR_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    blockingConfig: DEFAULT_BLOCKING_CONFIG,
    notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: {},
  };

  await api.storage.local.set(defaultSettings);

  // テーマ設定を復元（オプション）
  if (options?.preserveTheme && savedTheme) {
    await api.storage.local.set({ themeMode: savedTheme });
  }
}
