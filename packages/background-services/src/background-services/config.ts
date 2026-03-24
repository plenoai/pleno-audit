import {
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  getStorage,
  setStorage,
  createLogger,
  type BlockingConfig,
  type DetectionConfig,
  type NotificationConfig,
} from "@libztbs/extension-runtime";
import type { BackgroundServiceState } from "./state.js";

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
