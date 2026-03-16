import {
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  getStorage,
  setStorage,
  createLogger,
  type BlockingConfig,
  type ConnectionMode,
  type DataRetentionConfig,
  type DetectionConfig,
  type NotificationConfig,
} from "@pleno-audit/extension-runtime";
import type { BackgroundServiceState } from "./state";
import { ensureApiClient, ensureSyncManager, setConnectionConfigInternal } from "./client";
import { getOrInitParquetStore } from "./events";

const logger = createLogger("background-config");

export async function getDetectionConfig(): Promise<DetectionConfig> {
  const storage = await chrome.storage.local.get(["detectionConfig"]) as { detectionConfig?: DetectionConfig };
  return storage.detectionConfig || DEFAULT_DETECTION_CONFIG;
}

export async function setDetectionConfig(
  newConfig: Partial<DetectionConfig>
): Promise<{ success: boolean }> {
  try {
    const current = await getDetectionConfig();
    const updated = { ...current, ...newConfig };
    await chrome.storage.local.set({ detectionConfig: updated });
    return { success: true };
  } catch (error) {
    logger.error("Error setting detection config:", error);
    return { success: false };
  }
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  const storage = await chrome.storage.local.get(["notificationConfig"]) as { notificationConfig?: NotificationConfig };
  return storage.notificationConfig || DEFAULT_NOTIFICATION_CONFIG;
}

export async function setNotificationConfig(
  newConfig: Partial<NotificationConfig>
): Promise<{ success: boolean }> {
  try {
    const current = await getNotificationConfig();
    const updated = { ...current, ...newConfig };
    await chrome.storage.local.set({ notificationConfig: updated });
    return { success: true };
  } catch (error) {
    logger.error("Error setting notification config:", error);
    return { success: false };
  }
}

export async function getDataRetentionConfig(): Promise<DataRetentionConfig> {
  const storage = await getStorage();
  return storage.dataRetentionConfig || DEFAULT_DATA_RETENTION_CONFIG;
}

export async function setDataRetentionConfig(
  state: BackgroundServiceState,
  newConfig: DataRetentionConfig
): Promise<{ success: boolean }> {
  try {
    await setStorage({ dataRetentionConfig: newConfig });
    return { success: true };
  } catch (error) {
    state.logger?.error("Error setting data retention config:", error);
    return { success: false };
  }
}

export async function cleanupOldData(state: BackgroundServiceState): Promise<{ deleted: number }> {
  try {
    const config = await getDataRetentionConfig();
    if (!config.autoCleanupEnabled || config.retentionDays === 0) {
      return { deleted: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();
    const cutoffMs = cutoffDate.getTime();

    const client = await ensureApiClient(state);
    const deleted = await client.deleteOldReports(cutoffTimestamp);

    const store = await getOrInitParquetStore(state);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
    await store.deleteOldReports(cutoffDateStr);

    const storage = await getStorage();
    const aiPrompts = storage.aiPrompts || [];
    const filteredPrompts = aiPrompts.filter((p) => p.timestamp >= cutoffMs);
    if (filteredPrompts.length < aiPrompts.length) {
      await setStorage({ aiPrompts: filteredPrompts });
    }

    await setStorage({
      dataRetentionConfig: {
        ...config,
        lastCleanupTimestamp: Date.now(),
      },
    });

    state.logger?.info(`Data cleanup completed. Deleted ${deleted} CSP reports.`);
    return { deleted };
  } catch (error) {
    state.logger?.error("Error during data cleanup:", error);
    return { deleted: 0 };
  }
}

export async function getBlockingConfig(): Promise<BlockingConfig> {
  const storage = await getStorage();
  return storage.blockingConfig || DEFAULT_BLOCKING_CONFIG;
}

export async function setBlockingConfig(
  state: BackgroundServiceState,
  newConfig: BlockingConfig
): Promise<{ success: boolean }> {
  try {
    await setStorage({ blockingConfig: newConfig });
    return { success: true };
  } catch (error) {
    state.logger?.error("Error setting blocking config:", error);
    return { success: false };
  }
}

export async function getConnectionConfig(
  state: BackgroundServiceState
): Promise<{ mode: ConnectionMode; endpoint: string | null }> {
  const client = await ensureApiClient(state);
  return {
    mode: client.getMode(),
    endpoint: client.getEndpoint(),
  };
}

export async function setConnectionConfig(
  state: BackgroundServiceState,
  mode: ConnectionMode,
  endpoint?: string
): Promise<{ success: boolean }> {
  return setConnectionConfigInternal(state, mode, endpoint);
}

export async function getSyncConfig(
  state: BackgroundServiceState
): Promise<{ enabled: boolean; endpoint: string | null }> {
  const manager = await ensureSyncManager(state);
  return {
    enabled: manager.isEnabled(),
    endpoint: manager.getRemoteEndpoint(),
  };
}

export async function setSyncConfig(
  state: BackgroundServiceState,
  enabled: boolean,
  endpoint?: string
): Promise<{ success: boolean }> {
  try {
    const manager = await ensureSyncManager(state);
    await manager.setEnabled(enabled, endpoint);
    return { success: true };
  } catch (error) {
    state.logger?.error("Error setting sync config:", error);
    return { success: false };
  }
}

export async function triggerSync(
  state: BackgroundServiceState
): Promise<{ success: boolean; sent: number; received: number }> {
  try {
    const manager = await ensureSyncManager(state);
    const result = await manager.sync();
    return { success: true, ...result };
  } catch (error) {
    state.logger?.error("Error triggering sync:", error);
    return { success: false, sent: 0, received: 0 };
  }
}
