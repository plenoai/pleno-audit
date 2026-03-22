import type { Logger } from "@pleno-audit/extension-runtime";
import type { ApiClient, SyncManager } from "@pleno-audit/extension-enterprise";
import type { AlertManager, PolicyManager } from "@pleno-audit/alerts";

export interface BackgroundServiceState {
  apiClient: ApiClient | null;
  syncManager: SyncManager | null;
  alertManager: AlertManager | null;
  policyManager: PolicyManager | null;
  logger: Logger;
  storageQueue: Promise<void>;
}

export function createBackgroundServiceState(logger: Logger): BackgroundServiceState {
  return {
    apiClient: null,
    syncManager: null,
    alertManager: null,
    policyManager: null,
    logger,
    storageQueue: Promise.resolve(),
  };
}
