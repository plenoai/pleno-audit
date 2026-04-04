import type {
  DetectionConfig,
  NotificationConfig,
} from "../../extension-runtime/index.js";
import type { DLPServerConfig } from "../../ai-detector/index.js";
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
    ["GET_DLP_SERVER_CONFIG", {
      execute: () => deps.getDLPServerConfig(),
      fallback: () => null,
    }],
    ["SET_DLP_SERVER_CONFIG", {
      execute: (message) => deps.setDLPServerConfig(message.data as Partial<DLPServerConfig>),
      fallback: () => ({ success: false }),
    }],
    ["TEST_DLP_CONNECTION", {
      execute: () => deps.testDLPConnection(),
      fallback: () => ({ connected: false }),
    }],
    ["DOWNLOAD_DLP_MODEL", {
      execute: (message) => {
        const data = message.data as { modelUrl: string; wasmUrl: string };
        return deps.downloadDLPModel(data.modelUrl, data.wasmUrl);
      },
      fallback: () => ({ success: false }),
    }],
    ["GET_DLP_MODEL_STATUS", {
      execute: () => deps.getDLPModelStatus(),
      fallback: () => ({ downloaded: false, loading: false, ready: false }),
    }],
    ["DELETE_DLP_MODEL", {
      execute: () => deps.deleteDLPModel(),
      fallback: () => ({ success: false }),
    }],
    ["LOAD_DLP_MODEL", {
      execute: () => deps.loadDLPModel(),
      fallback: () => ({ success: false }),
    }],
    ["GET_DISABLED_ALERT_CATEGORIES", {
      execute: () => deps.getDisabledAlertCategories(),
      fallback: () => [],
    }],
    ["SET_DISABLED_ALERT_CATEGORIES", {
      execute: (message) => deps.setDisabledAlertCategories(message.data as string[]),
      fallback: () => ({ success: false }),
    }],
  ];
}
