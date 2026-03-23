import type { Logger } from "@pleno-audit/extension-runtime";
import type { AlertManager, PolicyManager } from "@pleno-audit/alerts";

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
