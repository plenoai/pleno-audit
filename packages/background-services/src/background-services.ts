import { queryExistingCookies, type Logger } from "@pleno-audit/extension-runtime";
import { createBackgroundServiceContext } from "./background-services/context.js";
import { addEvent } from "./background-services/events.js";
import {
  checkAIServicePolicy,
  checkDataTransferPolicy,
  checkDomainPolicy,
  getAlertManager,
  getPolicyManager,
  registerNotificationClickHandler,
} from "./background-services/alerts.js";
import {
  initStorage,
  saveStorage,
  queueStorageOperation,
  updateService,
  addCookieToService,
} from "./background-services/storage.js";
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
} from "./background-services/config.js";
import { createPageAnalysisHandler } from "./background-services/analysis.js";
import { extractDomainFromUrl } from "./background-services/utils.js";

export type { NewEvent, PageAnalysis } from "./background-services/types.js";

export function createBackgroundServices(serviceLogger: Logger) {
  const { state, bind } = createBackgroundServiceContext(serviceLogger);

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
  };

  const utils = {
    extractDomainFromUrl,
  };

  return {
    events,
    alerts,
    storage,
    analysis,
    config,
    utils,
  };
}
