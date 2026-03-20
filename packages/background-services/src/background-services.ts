import { queryExistingCookies, type Logger } from "@pleno-audit/extension-runtime";
import { createBackgroundServiceContext } from "./background-services/context";
import {
  ensureApiClient,
  ensureSyncManager,
  initializeApiClientWithMigration,
  initializeSyncManagerWithAutoStart,
} from "./background-services/client";
import { addEvent } from "./background-services/events";
import {
  checkAIServicePolicy,
  checkDataTransferPolicy,
  checkDomainPolicy,
  getAlertManager,
  getPolicyManager,
  registerNotificationClickHandler,
} from "./background-services/alerts";
import {
  initStorage,
  saveStorage,
  queueStorageOperation,
  updateService,
  addCookieToService,
} from "./background-services/storage";
import {
  getDetectionConfig,
  setDetectionConfig,
  getNotificationConfig,
  setNotificationConfig,
  getDataRetentionConfig,
  setDataRetentionConfig,
  cleanupOldData,
  getBlockingConfig,
  setBlockingConfig,
  getConnectionConfig,
  setConnectionConfig,
  getSyncConfig,
  setSyncConfig,
  triggerSync,
} from "./background-services/config";
import { createPageAnalysisHandler } from "./background-services/analysis";
import { extractDomainFromUrl } from "./background-services/utils";

export type { NewEvent, PageAnalysis } from "./background-services/types";

export function createBackgroundServices(serviceLogger: Logger) {
  const { state, bind } = createBackgroundServiceContext(serviceLogger);

  const api = {
    ensureApiClient: bind(ensureApiClient),
    initializeApiClientWithMigration: (
      checkMigrationNeeded: Parameters<typeof initializeApiClientWithMigration>[1],
      migrateToDatabase: Parameters<typeof initializeApiClientWithMigration>[2]
    ) => initializeApiClientWithMigration(state, checkMigrationNeeded, migrateToDatabase),
    clearReportsIfInitialized: async () => {
      if (!state.apiClient) {
        return;
      }
      await state.apiClient.clearReports();
    },
  };

  const sync = {
    ensureSyncManager: bind(ensureSyncManager),
    initializeSyncManagerWithAutoStart: () => initializeSyncManagerWithAutoStart(state),
    getSyncConfig: bind(getSyncConfig),
    setSyncConfig: bind(setSyncConfig),
    triggerSync: bind(triggerSync),
  };

  const events = {
    addEvent: bind(addEvent),
  };

  const alerts = {
    getAlertManager: bind(getAlertManager),
    getPolicyManager: bind(getPolicyManager),
    checkDomainPolicy: bind(checkDomainPolicy),
    checkAIServicePolicy: bind(checkAIServicePolicy),
    checkDataTransferPolicy: bind(checkDataTransferPolicy),
    registerNotificationClickHandler,
  };

  const storage = {
    queueStorageOperation: bind(queueStorageOperation),
    initStorage,
    saveStorage,
    updateService: (domain: string, update: Parameters<typeof updateService>[2]) =>
      updateService(state, domain, update, (newDomain) =>
        alerts.checkDomainPolicy(newDomain)
      ),
    addCookieToService: bind(addCookieToService),
  };

  const analysis = {
    handlePageAnalysis: createPageAnalysisHandler({
      logger: state.logger,
      getAlertManager: alerts.getAlertManager,
      initStorage: storage.initStorage,
      updateService: storage.updateService,
      addEvent: events.addEvent,
      addCookieToService: storage.addCookieToService,
      queryExistingCookies,
    }),
  };

  const config = {
    getDetectionConfig,
    setDetectionConfig,
    getNotificationConfig,
    setNotificationConfig,
    getDataRetentionConfig,
    setDataRetentionConfig: bind(setDataRetentionConfig),
    cleanupOldData: bind(cleanupOldData),
    getBlockingConfig,
    setBlockingConfig: bind(setBlockingConfig),
    getConnectionConfig: bind(getConnectionConfig),
    setConnectionConfig: bind(setConnectionConfig),
  };

  const utils = {
    extractDomainFromUrl,
  };

  return {
    api,
    sync,
    events,
    alerts,
    storage,
    analysis,
    config,
    utils,
  };
}
