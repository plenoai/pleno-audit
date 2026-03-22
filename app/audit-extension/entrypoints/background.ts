import type { DetectedService } from "@pleno-audit/casb-types";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import { DEFAULT_AI_MONITOR_CONFIG } from "@pleno-audit/ai-detector";
import { DEFAULT_NRD_CONFIG } from "@pleno-audit/nrd";
import { DEFAULT_TYPOSQUAT_CONFIG } from "@pleno-audit/typosquat";
import type { CSPViolation } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import { EventStore } from "@pleno-audit/storage";
import {
  startCookieMonitor,
  onCookieChange,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  createLogger,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createDoHMonitor,
  registerDoHMonitorListener,
  DEFAULT_DOH_MONITOR_CONFIG,
  type NetworkMonitorConfig,
  type DoHMonitor,
  type DoHMonitorConfig,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";
import { getSSOManager, getEnterpriseManager } from "@pleno-audit/extension-enterprise";

const logger = createLogger("background");
import {
  createAlarmHandlers as createAlarmHandlersModule,
  createAIPromptMonitorService,
  createCSPReportingService,
  createBackgroundServices,
  type NewEvent,
  type PageAnalysis,
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeMessage,
  type RuntimeHandlerDependencies,
  createDebugBridgeHandler,
  createDomainRiskService,
  createNetworkSecurityInspector,
  createSecurityEventHandlers,
  type ClipboardHijackData,
  type CookieAccessData,
  type DOMScrapingData,
  type DataExfiltrationData,
  type NetworkInspectionRequest,
  type CredentialTheftData,
  type SupplyChainRiskData,
  type SuspiciousDownloadData,
  type TrackingBeaconData,
  type XSSDetectedData,
  type WebSocketConnectionData,
  type WorkerCreatedData,
  type SharedWorkerCreatedData,
  type ServiceWorkerRegisteredData,
  type DynamicCodeExecutionData,
  type FullscreenPhishingData,
  type ClipboardReadData,
  type GeolocationAccessedData,
  type CanvasFingerprintData,
  type WebGLFingerprintData,
  type AudioFingerprintData,
} from "@pleno-audit/background-services";
import {
  createExtensionNetworkService,
  registerNetworkMonitorListener,
  type ExtensionStats,
} from "@pleno-audit/extension-network-service";
import { createConsumer, type QueueAdapter, type QueueItem } from "@pleno-audit/event-queue";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

const eventStore = new EventStore();

const backgroundServices = createBackgroundServices(logger);
const {
  api: backgroundApi,
  sync: backgroundSync,
  events: backgroundEvents,
  alerts: backgroundAlerts,
  storage: backgroundStorage,
  analysis: backgroundAnalysis,
  config: backgroundConfig,
  utils: backgroundUtils,
} = backgroundServices;

let doHMonitor: DoHMonitor | null = null;

/** addEvent + EventStore永続化を一元化 */
async function persistEvent(event: NewEvent) {
  const eventLog = await backgroundEvents.addEvent(event);
  await eventStore.add(eventLog);
  return eventLog;
}

backgroundAlerts.registerNotificationClickHandler();

// ============================================================================
// DoH Monitor Config
// ============================================================================

async function getDoHMonitorConfig(): Promise<DoHMonitorConfig> {
  const storage = await getStorage();
  return storage.doHMonitorConfig || DEFAULT_DOH_MONITOR_CONFIG;
}

async function setDoHMonitorConfig(config: Partial<DoHMonitorConfig>): Promise<{ success: boolean }> {
  const storage = await getStorage();
  storage.doHMonitorConfig = { ...DEFAULT_DOH_MONITOR_CONFIG, ...storage.doHMonitorConfig, ...config };
  await setStorage(storage);

  if (doHMonitor) {
    await doHMonitor.updateConfig(storage.doHMonitorConfig);
  }

  return { success: true };
}

async function getDoHRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
  const storage = await getStorage();
  const allRequests = storage.doHRequests || [];
  const total = allRequests.length;

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
  const requests = sorted.slice(offset, offset + limit);

  return { requests, total };
}

const extensionNetworkService = createExtensionNetworkService({
  logger,
  getStorage,
  setStorage,
  addEvent: (event) => persistEvent(event as NewEvent),
  getAlertManager: backgroundAlerts.getAlertManager,
  getRuntimeId: () => chrome.runtime.id,
});

// ============================================================================
// Extension Network Monitor
// ============================================================================

async function getNetworkMonitorConfig(): Promise<NetworkMonitorConfig> {
  return extensionNetworkService.getNetworkMonitorConfig();
}

async function setNetworkMonitorConfig(newConfig: NetworkMonitorConfig): Promise<{ success: boolean }> {
  return extensionNetworkService.setNetworkMonitorConfig(newConfig);
}

async function initExtensionMonitor() {
  await extensionNetworkService.initExtensionMonitor();
}

/**
 * DNRマッチルールを定期チェック
 * Chrome DNR APIのレート制限（10分間に最大20回）に対応するため、
 * 36秒間隔の別アラームで実行する
 *
 * 注意: checkDNRMatches()内でglobalCallbacksが呼ばれ、
 * onRequestコールバック経由でバッファ追加とイベント追加が自動的に行われる
 */
async function checkDNRMatchesHandler() {
  await extensionNetworkService.checkDNRMatchesHandler();
}
async function analyzeExtensionRisks(): Promise<void> {
  await extensionNetworkService.analyzeExtensionRisks();
}

async function getExtensionRiskAnalysis(extensionId: string) {
  return extensionNetworkService.getExtensionRiskAnalysis(extensionId);
}

async function getAllExtensionRisks() {
  return extensionNetworkService.getAllExtensionRisks();
}

async function getNetworkRequests(options?: {
  limit?: number;
  offset?: number;
  since?: number;
  initiatorType?: "extension" | "page" | "browser" | "unknown";
}) {
  return extensionNetworkService.getNetworkRequests(options);
}

async function getExtensionRequests(options?: { limit?: number; offset?: number }) {
  return extensionNetworkService.getExtensionRequests(options);
}

function getKnownExtensions() {
  return extensionNetworkService.getKnownExtensions();
}

async function getExtensionStats(): Promise<ExtensionStats> {
  return extensionNetworkService.getExtensionStats();
}

const securityEventHandlers = createSecurityEventHandlers({
  addEvent: (event) => persistEvent(event as NewEvent),
  getAlertManager: backgroundAlerts.getAlertManager,
  extractDomainFromUrl: backgroundUtils.extractDomainFromUrl,
  checkDataTransferPolicy: backgroundAlerts.checkDataTransferPolicy,
  logger,
});

const networkSecurityInspector = createNetworkSecurityInspector({
  handleDataExfiltration: (data, sender) =>
    securityEventHandlers.handleDataExfiltration(data, sender),
  handleTrackingBeacon: (data, sender) =>
    securityEventHandlers.handleTrackingBeacon(data, sender),
  logger,
});

const cspReportingService = createCSPReportingService({
  logger,
  initStorage: backgroundStorage.initStorage,
  saveStorage: async (data) => backgroundStorage.saveStorage(data),
  addEvent: async (event) => persistEvent(event as NewEvent),
  getCSPEvents: async (options) => {
    return eventStore.query({
      type: options?.type,
      limit: options?.limit,
      offset: options?.offset,
      since: options?.since,
      until: options?.until,
    });
  },
  clearCSPEvents: async () => {
    // Clear only CSP-related events by querying and deleting
    const violations = await eventStore.queryAll({ type: ["csp_violation", "network_request"] });
    for (const event of violations) {
      await eventStore.delete(event.id);
    }
  },
  devReportEndpoint: DEV_REPORT_ENDPOINT,
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  clearAIPrompts,
  queueStorageOperation: backgroundStorage.queueStorageOperation,
  addEvent: async (event) => persistEvent(event as NewEvent),
  updateService: backgroundStorage.updateService,
  checkAIServicePolicy: backgroundAlerts.checkAIServicePolicy,
  getAlertManager: backgroundAlerts.getAlertManager,
});

const domainRiskService = createDomainRiskService({
  logger,
  getStorage,
  setStorage: async (data) => setStorage(data),
  updateService: backgroundStorage.updateService,
  addEvent: async (event) => persistEvent(event as NewEvent),
  getAlertManager: backgroundAlerts.getAlertManager,
});

class OperationGuard<T> {
  private pending: Promise<T> | null = null;

  async run(operation: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;

    this.pending = operation();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
}

const clearAllDataGuard = new OperationGuard<{ success: boolean }>();

async function clearAllData(): Promise<{ success: boolean }> {
  return clearAllDataGuard.run(async () => {
    let monitorStopped = false;
    try {
      logger.info("Clearing all data...");

      // 1. Stop event producers
      await extensionNetworkService.stopExtensionMonitor();
      monitorStopped = true;

      // 2. Clear in-memory queue
      cspReportingService.clearReportQueue();

      // 3. Clear chrome.storage.local and reset to defaults (preserve theme)
      await clearAllStorage({ preserveTheme: true });

      logger.info("All data cleared successfully");
      return { success: true };
    } catch (error) {
      logger.error("Error clearing all data:", error);
      return { success: false };
    } finally {
      if (monitorStopped) {
        await initExtensionMonitor().catch((error) => {
          logger.error("Extension monitor re-init failed after clear:", error);
        });
      }
    }
  });
}

// Main world hooks are enabled for detection, while heavy processing is shifted to async handlers.

const handleDebugBridgeForward = createDebugBridgeHandler({
  getDoHMonitorConfig,
  setDoHMonitorConfig,
  getDoHRequests,
});

function initializeDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  void import("@pleno-audit/debug-bridge").then(({ initDebugBridge }) => {
    initDebugBridge({
      getNetworkRequests,
      getNetworkMonitorConfig,
      setNetworkMonitorConfig,
    });
  });
}

async function initializeEnterpriseManagedFlow(): Promise<void> {
  const enterpriseManager = await getEnterpriseManager();
  const status = enterpriseManager.getStatus();

  if (!status.isManaged) {
    return;
  }

  logger.info("Enterprise managed mode detected", {
    ssoRequired: status.ssoRequired,
    settingsLocked: status.settingsLocked,
  });

  if (!status.ssoRequired) {
    return;
  }

  const ssoManager = await getSSOManager();
  const ssoStatus = await ssoManager.getStatus();

  if (ssoStatus.isAuthenticated) {
    return;
  }

  logger.info("SSO required but not authenticated - prompting user");

  await chrome.notifications.create("sso-required", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-128.png"),
    title: "認証が必要です",
    message: "組織のセキュリティポリシーにより、シングルサインオンでの認証が必要です。",
    priority: 2,
    requireInteraction: true,
  });

  const dashboardUrl = chrome.runtime.getURL("dashboard.html#auth");
  await chrome.tabs.create({ url: dashboardUrl, active: true });
}

async function initializeCSPReporter(): Promise<void> {
  await cspReportingService.initializeReporter();
}

function initializeBackgroundServices(): void {
  initializeDebugBridge();

  void initializeEnterpriseManagedFlow().catch((error) => logger.error("Enterprise manager init failed:", error));
  void initializeCSPReporter().catch((error) => logger.error("CSP reporter init failed:", error));
  void initExtensionMonitor()
    .then(() => logger.debug("Extension monitor initialization completed"))
    .catch((error) => logger.error("Extension monitor init failed:", error));
}

const queueQueueAdapter: QueueAdapter = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

function registerRecurringAlarms(): void {
  // Event queue processing（30秒ごとにキューを処理）
  chrome.alarms.create("processEventQueue", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  // DNR API rate limit対応: 36秒間隔（Chrome制限: 10分間に最大20回、30秒以上の間隔）
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  // Extension risk analysis (runs every 5 minutes)
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
  // Data cleanup alarm (runs once per day)
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });
}

function createRuntimeHandlerDependencies(): RuntimeHandlerDependencies {
  return {
    logger,
    fallbacks: {
      cspConfig: DEFAULT_CSP_CONFIG,
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
      nrdConfig: DEFAULT_NRD_CONFIG,
      typosquatConfig: DEFAULT_TYPOSQUAT_CONFIG,
      networkMonitorConfig: DEFAULT_NETWORK_MONITOR_CONFIG,
      dataRetentionConfig: DEFAULT_DATA_RETENTION_CONFIG,
      blockingConfig: DEFAULT_BLOCKING_CONFIG,
      notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
      doHMonitorConfig: DEFAULT_DOH_MONITOR_CONFIG,
    },
    handleDebugBridgeForward,
    getKnownExtensions,
    getServices: async () => {
      const storage = await getStorage();
      return Object.values(storage.services || {}) as DetectedService[];
    },
    handlePageAnalysis: async (payload) =>
      backgroundAnalysis.handlePageAnalysis(payload as PageAnalysis),
    handleCSPViolation: (data, sender) => cspReportingService.handleCSPViolation(data as Omit<CSPViolation, "type">, sender),
handleNetworkInspection: (data, sender) => networkSecurityInspector.handleNetworkInspection(data as NetworkInspectionRequest, sender),
    handleDataExfiltration: (data, sender) => securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
    handleCredentialTheft: (data, sender) => securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
    handleSupplyChainRisk: (data, sender) => securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
    handleTrackingBeacon: (data, sender) => securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
    handleClipboardHijack: (data, sender) => securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
    handleCookieAccess: (data, sender) => securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
    handleXSSDetected: (data, sender) => securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
    handleDOMScraping: (data, sender) => securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
    handleSuspiciousDownload: (data, sender) => securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
    handleWebSocketConnection: (data, sender) => securityEventHandlers.handleWebSocketConnection(data as WebSocketConnectionData, sender),
    handleWorkerCreated: (data, sender) => securityEventHandlers.handleWorkerCreated(data as WorkerCreatedData, sender),
    handleSharedWorkerCreated: (data, sender) => securityEventHandlers.handleSharedWorkerCreated(data as SharedWorkerCreatedData, sender),
    handleServiceWorkerRegistered: (data, sender) => securityEventHandlers.handleServiceWorkerRegistered(data as ServiceWorkerRegisteredData, sender),
    handleDynamicCodeExecution: (data, sender) => securityEventHandlers.handleDynamicCodeExecution(data as DynamicCodeExecutionData, sender),
    handleFullscreenPhishing: (data, sender) => securityEventHandlers.handleFullscreenPhishing(data as FullscreenPhishingData, sender),
    handleClipboardRead: (data, sender) => securityEventHandlers.handleClipboardRead(data as ClipboardReadData, sender),
    handleGeolocationAccessed: (data, sender) => securityEventHandlers.handleGeolocationAccessed(data as GeolocationAccessedData, sender),
    handleCanvasFingerprint: (data, sender) => securityEventHandlers.handleCanvasFingerprint(data as CanvasFingerprintData, sender),
    handleWebGLFingerprint: (data, sender) => securityEventHandlers.handleWebGLFingerprint(data as WebGLFingerprintData, sender),
    handleAudioFingerprint: (data, sender) => securityEventHandlers.handleAudioFingerprint(data as AudioFingerprintData, sender),
    handleBroadcastChannel: (data, sender) => securityEventHandlers.handleBroadcastChannel(data as Record<string, unknown>, sender),
    handleWebRTCConnection: (data, sender) => securityEventHandlers.handleWebRTCConnection(data as Record<string, unknown>, sender),
    getCSPReports: cspReportingService.getCSPReports,
    generateCSPPolicy: cspReportingService.generateCSPPolicy,
    generateCSPPolicyByDomain: cspReportingService.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: cspReportingService.saveGeneratedCSPPolicy,
    getCSPConfig: cspReportingService.getCSPConfig,
    setCSPConfig: cspReportingService.setCSPConfig,
    clearCSPData: cspReportingService.clearCSPData,
    clearAllData,
    getStats: async () => ({ violations: 0, requests: 0, uniqueDomains: 0 }),
    getConnectionConfig: backgroundConfig.getConnectionConfig,
    setConnectionConfig: backgroundConfig.setConnectionConfig,
    getSyncConfig: backgroundSync.getSyncConfig,
    setSyncConfig: backgroundSync.setSyncConfig,
    triggerSync: backgroundSync.triggerSync,
    getSSOManager,
    getEnterpriseManager,
    getDetectionConfig: backgroundConfig.getDetectionConfig,
    setDetectionConfig: backgroundConfig.setDetectionConfig,
    handleAIPromptCaptured: (payload) => aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
    getAIPrompts: aiPromptMonitorService.getAIPrompts,
    getAIPromptsCount: aiPromptMonitorService.getAIPromptsCount,
    getAIMonitorConfig: aiPromptMonitorService.getAIMonitorConfig,
    setAIMonitorConfig: aiPromptMonitorService.setAIMonitorConfig,
    clearAIData: aiPromptMonitorService.clearAIData,
    handleNRDCheck: domainRiskService.handleNRDCheck,
    getNRDConfig: domainRiskService.getNRDConfig,
    setNRDConfig: domainRiskService.setNRDConfig,
    handleTyposquatCheck: domainRiskService.handleTyposquatCheck,
    getTyposquatConfig: domainRiskService.getTyposquatConfig,
    setTyposquatConfig: domainRiskService.setTyposquatConfig,
    getNetworkRequests,
    getExtensionRequests,
    getExtensionStats,
    getNetworkMonitorConfig,
    setNetworkMonitorConfig,
    getAllExtensionRisks,
    getExtensionRiskAnalysis,
    analyzeExtensionRisks,
    getDataRetentionConfig: backgroundConfig.getDataRetentionConfig,
    setDataRetentionConfig: backgroundConfig.setDataRetentionConfig,
    cleanupOldData: backgroundConfig.cleanupOldData,
    getBlockingConfig: backgroundConfig.getBlockingConfig,
    setBlockingConfig: backgroundConfig.setBlockingConfig,
    getNotificationConfig: backgroundConfig.getNotificationConfig,
    setNotificationConfig: backgroundConfig.setNotificationConfig,
    getDoHMonitorConfig,
    setDoHMonitorConfig,
    getDoHRequests,
    getEvents: async (options) => eventStore.query({
      limit: options?.limit,
      offset: options?.offset,
      since: options?.since,
      until: options?.until,
      type: options?.type as import("@pleno-audit/casb-types").EventLogType[],
    }),
    getEventsCount: async (options) => eventStore.count({
      since: options?.since,
      until: options?.until,
      type: options?.type as import("@pleno-audit/casb-types").EventLogType[],
    }),
  };
}

export default defineBackground(() => {
  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerNetworkMonitorListener();
  registerDoHMonitorListener();

  initializeBackgroundServices();
  registerRecurringAlarms();

  // ============================================================================
  // Event Queue Consumer
  // ============================================================================

  const eventQueueConsumer = createConsumer(queueQueueAdapter);

  const runtimeHandlers = createRuntimeMessageHandlersModule(
    createRuntimeHandlerDependencies(),
  );

  async function processEventQueue(): Promise<void> {
    const result = await eventQueueConsumer.process(async (item: QueueItem) => {
      const asyncHandler = runtimeHandlers.async.get(item.type);
      if (!asyncHandler) {
        logger.debug("No handler for queued event", { type: item.type });
        return;
      }

      // Bridge QueueItem → RuntimeMessage + MessageSender
      const message: RuntimeMessage = { type: item.type, ...(item.data as object) };
      const sender: chrome.runtime.MessageSender = {
        tab: { id: item.tabId, url: item.senderUrl } as chrome.tabs.Tab,
      };

      await asyncHandler.execute(message, sender);
    });

    if (result.processed > 0 || result.failed > 0) {
      logger.debug("Event queue processed", result);
    }
  }

  // ============================================================================
  // Alarm Handlers
  // ============================================================================

  const alarmHandlers = createAlarmHandlersModule({
    logger,
    flushReportQueue: () => cspReportingService.flushReportQueue(),
    checkDNRMatchesHandler,
    analyzeExtensionRisks,
    cleanupOldData: backgroundConfig.cleanupOldData,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "processEventQueue") {
      processEventQueue().catch((error) =>
        logger.error("Event queue processing failed:", error),
      );
      return;
    }
    const handler = alarmHandlers.get(alarm.name);
    if (handler) {
      try {
        handler();
      } catch (error) {
        logger.error(`Alarm handler "${alarm.name}" failed:`, error);
      }
    }
  });

  // ============================================================================
  // Tab cleanup: remove orphan queue entries when tabs close
  // ============================================================================

  chrome.tabs.onRemoved.addListener(() => {
    chrome.tabs.query({}, (tabs) => {
      const activeTabIds = tabs.map((t) => t.id).filter((id): id is number => id != null);
      eventQueueConsumer.cleanup(activeTabIds).catch((error) =>
        logger.debug("Queue cleanup failed:", error),
      );
    });
  });

  // ============================================================================
  // Runtime Message Listener (popup/dashboard request-response only)
  // ============================================================================

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage;
    const type = typeof message.type === "string" ? message.type : "";

    if (!type) {
      logger.debug({
        event: "RUNTIME_MESSAGE_TYPE_MISSING",
        data: {
          senderTabId: sender.tab?.id,
          senderUrl: sender.tab?.url,
        },
      });
      return false;
    }

    const directHandler = runtimeHandlers.direct.get(type);
    if (directHandler) {
      return directHandler(message, sender, sendResponse);
    }

    const asyncHandler = runtimeHandlers.async.get(type);
    if (asyncHandler) {
      return runAsyncMessageHandlerModule(logger, asyncHandler, message, sender, sendResponse);
    }

    logger.warn({
      event: "RUNTIME_MESSAGE_TYPE_UNHANDLED",
      data: {
        type,
        senderTabId: sender.tab?.id,
        senderUrl: sender.tab?.url,
      },
    });
    return false;
  });

  // Initialize DoH Monitor
  doHMonitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
  doHMonitor.start().catch((err) => logger.error("Failed to start DoH monitor:", err));

  doHMonitor.onRequest(async (record: DoHRequestRecord) => {
    try {
      const storage = await getStorage();
      if (!storage.doHRequests) {
        storage.doHRequests = [];
      }
      storage.doHRequests.push(record);

      // Keep only recent requests
      const maxRequests = storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
      if (storage.doHRequests.length > maxRequests) {
        storage.doHRequests = storage.doHRequests.slice(-maxRequests);
      }

      await setStorage(storage);
      logger.debug("DoH request stored:", record.domain);

      const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
      if (config.action === "alert" || config.action === "block") {
        await chrome.notifications.create(`doh-${record.id}`, {
          type: "basic",
          iconUrl: "icon-128.png",
          title: "DoH Traffic Detected",
          message: `DNS over HTTPS request to ${record.domain} (${record.detectionMethod})`,
          priority: 0,
        });
      }
    } catch (error) {
      logger.error("Failed to store DoH request:", error);
    }
  });

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    backgroundStorage
      .addCookieToService(domain, cookie)
      .catch((err) => logger.debug("Add cookie to service failed:", err));
    persistEvent({
      type: "cookie_set",
      domain,
      timestamp: cookie.detectedAt,
      details: {
        name: cookie.name,
        isSession: cookie.isSession,
      },
    }).catch((err) => logger.debug("Add cookie event failed:", err));
  });
});
