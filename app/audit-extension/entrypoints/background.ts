import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
} from "@pleno-audit/detectors";
import type { CSPViolation } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import {
  startCookieMonitor,
  onCookieChange,
  checkMigrationNeeded,
  migrateToDatabase,
  getSSOManager,
  ensureOffscreenDocument,
  markOffscreenReady,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  registerNetworkMonitorListener,
  createLogger,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createDoHMonitor,
  registerDoHMonitorListener,
  DEFAULT_DOH_MONITOR_CONFIG,
  getEnterpriseManager,
  type NetworkMonitorConfig,
  type DoHMonitor,
  type DoHMonitorConfig,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
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
  type ExtensionStats,
} from "@pleno-audit/extension-network-service";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

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
  getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
  addEvent: (event) => backgroundEvents.addEvent(event as NewEvent),
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
  addEvent: (event) => backgroundEvents.addEvent(event as NewEvent),
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
  ensureApiClient: backgroundApi.ensureApiClient,
  initStorage: backgroundStorage.initStorage,
  saveStorage: async (data) => backgroundStorage.saveStorage(data),
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  devReportEndpoint: DEV_REPORT_ENDPOINT,
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  clearAIPrompts,
  queueStorageOperation: backgroundStorage.queueStorageOperation,
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  updateService: backgroundStorage.updateService,
  checkAIServicePolicy: backgroundAlerts.checkAIServicePolicy,
  getAlertManager: backgroundAlerts.getAlertManager,
});

const domainRiskService = createDomainRiskService({
  logger,
  getStorage,
  setStorage: async (data) => setStorage(data),
  updateService: backgroundStorage.updateService,
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
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
      let indexedDbCleared = true;

      // 1. Stop event producers before DB teardown to avoid closing-race transactions.
      await extensionNetworkService.stopExtensionMonitor();
      monitorStopped = true;
      await backgroundEvents.closeParquetStore();

      // 2. Clear in-memory queue first.
      cspReportingService.clearReportQueue();

      // 3. Clear API client reports.
      await backgroundApi.clearReportsIfInitialized();

      // 4. Clear all IndexedDB databases via offscreen document.
      try {
        await ensureOffscreenDocument();
        await chrome.runtime.sendMessage({
          type: "CLEAR_ALL_INDEXEDDB",
          id: crypto.randomUUID(),
        });
      } catch (error) {
        indexedDbCleared = false;
        logger.error({
          event: "CLEAR_ALL_DATA_INDEXEDDB_CLEAR_FAILED",
          error,
        });
        // Continue even if IndexedDB clear fails.
      }

      // 5. Clear chrome.storage.local and reset to defaults (preserve theme).
      await clearAllStorage({ preserveTheme: true });

      if (indexedDbCleared) {
        logger.info("All data cleared successfully");
      } else {
        logger.warn({
          event: "CLEAR_ALL_DATA_PARTIAL_SUCCESS",
          data: {
            indexedDbCleared,
          },
        });
      }
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
  getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
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

async function initializeEventStore(): Promise<void> {
  await backgroundEvents.getOrInitParquetStore();
  logger.debug("EventStore initialized");
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

async function migrateLegacyEventsIfNeeded(): Promise<void> {
  const needsMigration = await checkEventsMigrationNeeded();
  if (!needsMigration) {
    return;
  }

  const store = await backgroundEvents.getOrInitParquetStore();
  const result = await migrateEventsToIndexedDB(store);
  logger.debug(`Event migration: ${result.success ? "success" : "failed"}`, result);
}

function initializeBackgroundServices(): void {
  initializeDebugBridge();

  void initializeEventStore().catch((error) => logger.error("EventStore init failed:", error));
  void backgroundApi.initializeApiClientWithMigration(checkMigrationNeeded, migrateToDatabase)
    .catch((error) => logger.debug("API client init failed:", error));
  void backgroundSync.initializeSyncManagerWithAutoStart().catch((error) =>
    logger.debug("Sync manager init failed:", error)
  );
  void initializeEnterpriseManagedFlow().catch((error) => logger.error("Enterprise manager init failed:", error));
  void initializeCSPReporter().catch((error) => logger.error("CSP reporter init failed:", error));
  void migrateLegacyEventsIfNeeded().catch((error) => logger.error("Event migration error:", error));
  void initExtensionMonitor()
    .then(() => logger.debug("Extension monitor initialization completed"))
    .catch((error) => logger.error("Extension monitor init failed:", error));
}

function registerRecurringAlarms(): void {
  // ServiceWorker keep-alive用のalarm（30秒ごとにwake-up）
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
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
    markOffscreenReady,
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
    getCSPReports: cspReportingService.getCSPReports,
    generateCSPPolicy: cspReportingService.generateCSPPolicy,
    generateCSPPolicyByDomain: cspReportingService.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: cspReportingService.saveGeneratedCSPPolicy,
    getCSPConfig: cspReportingService.getCSPConfig,
    setCSPConfig: cspReportingService.setCSPConfig,
    clearCSPData: cspReportingService.clearCSPData,
    clearAllData,
    getStats: async () => {
      const client = await backgroundApi.ensureApiClient();
      return client.getStats();
    },
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
    getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
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
  };
}

export default defineBackground(() => {
  const MAX_INCOMING_BATCH = 100;
  const PROCESS_CHUNK_SIZE = 20;

  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerNetworkMonitorListener();
  registerDoHMonitorListener();

  initializeBackgroundServices();
  registerRecurringAlarms();

  const alarmHandlers = createAlarmHandlersModule({
    logger,
    flushReportQueue: () => cspReportingService.flushReportQueue(),
    checkDNRMatchesHandler,
    analyzeExtensionRisks,
    cleanupOldData: backgroundConfig.cleanupOldData,
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      return;
    }
    const handler = alarmHandlers.get(alarm.name);
    if (handler) {
      handler();
    }
  });

  const runtimeHandlers = createRuntimeMessageHandlersModule(
    createRuntimeHandlerDependencies(),
  );
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

    if (type === "BATCH_RUNTIME_EVENTS") {
      const incomingEvents = Array.isArray((message.data as { events?: unknown[] } | undefined)?.events)
        ? ((message.data as { events: RuntimeMessage[] }).events)
        : [];
      const dropped = Math.max(0, incomingEvents.length - MAX_INCOMING_BATCH);
      const events = dropped > 0
        ? incomingEvents.slice(0, MAX_INCOMING_BATCH)
        : incomingEvents;

      if (events.length === 0) {
        sendResponse({ success: true, processed: 0, failed: 0, dropped });
        return false;
      }

      void (async () => {
        let processed = 0;
        let failed = 0;
        let chunkCount = 0;

        for (const batched of events) {
          chunkCount++;
          const eventType = typeof batched?.type === "string" ? batched.type : "";
          if (!eventType) {
            failed++;
            continue;
          }

          const asyncHandler = runtimeHandlers.async.get(eventType);
          if (!asyncHandler) {
            failed++;
            continue;
          }

          try {
            await asyncHandler.execute(batched, sender);
            processed++;
          } catch (error) {
            failed++;
            logger.debug("Batched event failed", {
              type: eventType,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          if (chunkCount >= PROCESS_CHUNK_SIZE) {
            chunkCount = 0;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        if (dropped > 0) {
          logger.warn("Dropped excessive batched runtime events", {
            incoming: incomingEvents.length,
            processedTarget: events.length,
            dropped,
            senderTabId: sender.tab?.id,
            senderUrl: sender.tab?.url,
          });
        }

        sendResponse({ success: true, processed, failed, dropped });
      })();

      return true;
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
    backgroundEvents.addEvent({
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
