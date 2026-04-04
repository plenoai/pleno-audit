/**
 * 型安全なストレージアクセス層
 */
import type {
  StorageData,
  DetectedService,
  AIMonitorConfig,
  DetectionConfig,
  DLPServerConfig,
} from "./storage-types.js";
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./storage-types.js";
import type { NRDConfig } from "../nrd/index.js";
import { DEFAULT_NRD_CONFIG } from "../nrd/index.js";
import { DEFAULT_AI_MONITOR_CONFIG, DEFAULT_DLP_SERVER_CONFIG } from "../ai-detector/index.js";
import { getBrowserAPI } from "./browser-adapter.js";

const STORAGE_KEYS = [
  "services",
  "policyConfig",
  "alerts",
  "generatedCSPPolicy",
  "aiMonitorConfig",
  "dlpServerConfig",
  "nrdConfig",
  "detectionConfig",
  "notificationConfig",
  "alertCooldown",
  "disabledAlertCategories",
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
    aiMonitorConfig:
      (result.aiMonitorConfig as AIMonitorConfig) || DEFAULT_AI_MONITOR_CONFIG,
    dlpServerConfig:
      (result.dlpServerConfig as DLPServerConfig) || DEFAULT_DLP_SERVER_CONFIG,
    nrdConfig: (result.nrdConfig as NRDConfig) || DEFAULT_NRD_CONFIG,
    detectionConfig:
      (result.detectionConfig as DetectionConfig) || DEFAULT_DETECTION_CONFIG,
    notificationConfig:
      (result.notificationConfig as StorageData["notificationConfig"]) ||
      DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: (result.alertCooldown as StorageData["alertCooldown"]) || {},
    disabledAlertCategories: (result.disabledAlertCategories as string[]) || [],
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
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    dlpServerConfig: DEFAULT_DLP_SERVER_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: {},
    disabledAlertCategories: [],
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
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    dlpServerConfig: DEFAULT_DLP_SERVER_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
    alertCooldown: {},
    disabledAlertCategories: [],
  };

  await api.storage.local.set(defaultSettings);

  // テーマ設定を復元（オプション）
  if (options?.preserveTheme && savedTheme) {
    await api.storage.local.set({ themeMode: savedTheme });
  }
}
