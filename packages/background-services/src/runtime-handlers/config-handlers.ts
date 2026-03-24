import type {
  DetectionConfig,
  DoHMonitorConfig,
  NotificationConfig,
} from "@libztbs/extension-runtime";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createConfigurationHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_DETECTION_CONFIG", {
      execute: () => deps.getDetectionConfig(),
      fallback: () => deps.fallbacks.detectionConfig,
    }],
    ["SET_DETECTION_CONFIG", {
      execute: (message) => deps.setDetectionConfig(message.data as Partial<DetectionConfig>),
      fallback: () => ({ success: false }),
    }],
    ["GET_NOTIFICATION_CONFIG", {
      execute: () => deps.getNotificationConfig(),
      fallback: () => deps.fallbacks.notificationConfig,
    }],
    ["SET_NOTIFICATION_CONFIG", {
      execute: (message) => deps.setNotificationConfig(message.data as Partial<NotificationConfig>),
      fallback: () => ({ success: false }),
    }],
    ["GET_DOH_MONITOR_CONFIG", {
      execute: () => deps.getDoHMonitorConfig(),
      fallback: () => deps.fallbacks.doHMonitorConfig,
    }],
    ["SET_DOH_MONITOR_CONFIG", {
      execute: (message) => deps.setDoHMonitorConfig(message.data as Partial<DoHMonitorConfig>),
      fallback: () => ({ success: false }),
    }],
  ];
}
