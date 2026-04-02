import type { Logger } from "../extension-runtime/index.js";
import { queryExistingCookies } from "../extension-analyzers/index.js";
import { createBackgroundServiceContext } from "./background-services/context.js";
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
} from "./background-services/config.js";
import { createPageAnalysisHandler } from "./background-services/analysis.js";
import { extractDomainFromUrl } from "./background-services/utils.js";

export type { PageAnalysis } from "./background-services/types.js";

export function createBackgroundServices(serviceLogger: Logger) {
  const { state, bind } = createBackgroundServiceContext(serviceLogger);

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
      initStorage: storage.initStorage,
      updateService: storage.updateService,
      addCookieToService: storage.addCookieToService,
      queryExistingCookies,
    }),
  };

  const config = {
    getDetectionConfig,
    setDetectionConfig,
    getNotificationConfig,
    setNotificationConfig,
  };

  const utils = {
    extractDomainFromUrl,
  };

  return {
    alerts,
    storage,
    analysis,
    config,
    utils,
  };
}
