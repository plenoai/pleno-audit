import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createLogger,
  type DetectionConfig,
  type NotificationConfig,
} from "../../extension-runtime/index.js";

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

export async function getDisabledAlertCategories(): Promise<string[]> {
  const storage = await chrome.storage.local.get(["disabledAlertCategories"]) as { disabledAlertCategories?: string[] };
  return storage.disabledAlertCategories || [];
}

export async function setDisabledAlertCategories(
  categories: string[]
): Promise<{ success: boolean }> {
  try {
    await chrome.storage.local.set({ disabledAlertCategories: categories });
    return { success: true };
  } catch (error) {
    logger.error("Error setting disabled alert categories:", error);
    return { success: false };
  }
}
