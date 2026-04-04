import type {
  DetectionConfig,
  NotificationConfig,
} from "../../extension-runtime/index.js";
import type { DLPAnonymizeConfig } from "../../ai-detector/index.js";
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
    ["GET_DLP_ANONYMIZE_CONFIG", {
      execute: () => deps.getDLPAnonymizeConfig(),
      fallback: () => null,
    }],
    ["SET_DLP_ANONYMIZE_CONFIG", {
      execute: (message) => deps.setDLPAnonymizeConfig(message.data as Partial<DLPAnonymizeConfig>),
      fallback: () => ({ success: false }),
    }],
    ["TEST_DLP_CONNECTION", {
      execute: () => deps.testDLPConnection(),
      fallback: () => ({ connected: false }),
    }],
  ];
}
