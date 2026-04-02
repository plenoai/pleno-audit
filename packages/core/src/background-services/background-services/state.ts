import type { Logger } from "../../extension-runtime/index.js";
import type { AlertManager, PolicyManager } from "../../alerts/index.js";

export interface BackgroundServiceState {
  alertManager: AlertManager | null;
  policyManager: PolicyManager | null;
  logger: Logger;
  storageQueue: Promise<void>;
}

export function createBackgroundServiceState(logger: Logger): BackgroundServiceState {
  return {
    alertManager: null,
    policyManager: null,
    logger,
    storageQueue: Promise.resolve(),
  };
}
