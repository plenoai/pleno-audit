import type { DetectedService } from "@libztbs/types";
import type { CapturedAIPrompt } from "@libztbs/ai-detector";
import { DEFAULT_AI_MONITOR_CONFIG } from "@libztbs/ai-detector";
import { DEFAULT_NRD_CONFIG } from "@libztbs/nrd";
import { DEFAULT_TYPOSQUAT_CONFIG } from "@libztbs/typosquat";
import type { CSPViolation } from "@libztbs/csp";
import {
  startCookieMonitor,
  onCookieChange,
  getStorage,
  setStorage,
  clearAllStorage,
  createLogger,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createDoHMonitor,
  registerDoHMonitorListener,
  OperationGuard,
  type DoHMonitor,
  type DoHRequestRecord,
} from "@libztbs/extension-runtime";
import { getSSOManager, getEnterpriseManager } from "@libztbs/extension-enterprise";

const logger = createLogger("background");
import {
  createAlarmHandlers as createAlarmHandlersModule,
  createAIPromptMonitorService,
  createCSPReportingService,
  createBackgroundServices,
  type PageAnalysis,
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeMessage,
  type RuntimeHandlerDependencies,
  createConnectionTracker,
  createDebugBridgeHandler,
  createDomainRiskService,
  createNetworkSecurityInspector,
  createSecurityEventHandlers,
  type ClipboardHijackData,
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
} from "@libztbs/background-services";
import {
  createExtensionNetworkService,
  registerNetworkMonitorListener,
  type ExtensionStats,
} from "@libztbs/extension-network-service";


const backgroundServices = createBackgroundServices(logger);
const {
  alerts: backgroundAlerts,
  storage: backgroundStorage,
  analysis: backgroundAnalysis,
  config: backgroundConfig,
  utils: backgroundUtils,
} = backgroundServices;

let doHMonitor: DoHMonitor | null = null;

backgroundAlerts.registerNotificationClickHandler();

// ============================================================================
// Service Connection Tracking (通信先集約)
// ============================================================================

const connectionTracker = createConnectionTracker({
  logger,
  getConnections: async () => {
    const storage = await chrome.storage.local.get(["serviceConnections", "extensionConnections"]);
    return {
      serviceConnections: (storage.serviceConnections as Record<string, string[]>) || {},
      extensionConnections: (storage.extensionConnections as Record<string, string[]>) || {},
    };
  },
  setConnections: async (data) => {
    await chrome.storage.local.set(data);
  },
});

const extensionNetworkService = createExtensionNetworkService({
  logger,
  getStorage,
  setStorage,
  getAlertManager: backgroundAlerts.getAlertManager,
  getRuntimeId: () => chrome.runtime.id,
  onNetworkRequest: connectionTracker.track,
});

// ============================================================================
// Extension Network Monitor
// ============================================================================

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
  getAlertManager: backgroundAlerts.getAlertManager,
  extractDomainFromUrl: backgroundUtils.extractDomainFromUrl,
  checkDataTransferPolicy: backgroundAlerts.checkDataTransferPolicy,
  updateService: backgroundStorage.updateService,
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
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  queueStorageOperation: backgroundStorage.queueStorageOperation,
  updateService: backgroundStorage.updateService,
  checkAIServicePolicy: backgroundAlerts.checkAIServicePolicy,
  getAlertManager: backgroundAlerts.getAlertManager,
});

const domainRiskService = createDomainRiskService({
  logger,
  getStorage,
  setStorage: async (data) => setStorage(data),
  updateService: backgroundStorage.updateService,
  getAlertManager: backgroundAlerts.getAlertManager,
});

const clearAllDataGuard = new OperationGuard<{ success: boolean }>();

async function clearAllData(): Promise<{ success: boolean }> {
  return clearAllDataGuard.run(async () => {
    let monitorStopped = false;
    try {
      logger.info("Clearing all data...");

      // 1. Stop event producers
      await extensionNetworkService.stopExtensionMonitor();
      monitorStopped = true;

      // 2. Clear chrome.storage.local and reset to defaults (preserve theme)
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

const handleDebugBridgeForward = createDebugBridgeHandler();

function initializeDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  void import("@libztbs/debug-bridge").then(({ initDebugBridge }) => {
    initDebugBridge({
      getNetworkRequests,
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

async function reinjectContentScripts(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ status: "complete" });
  } catch {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) continue;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-scripts/content.js", "content-scripts/security-bridge.js", "content-scripts/csp.js"],
    }).catch(() => {
      // Tab may be restricted (e.g. chrome web store) — ignore
    });
  }
  logger.debug("Content scripts re-injected into existing tabs");
}

function initializeBackgroundServices(): void {
  initializeDebugBridge();

  void reinjectContentScripts();
  void initializeEnterpriseManagedFlow().catch((error) => logger.error("Enterprise manager init failed:", error));
  void initExtensionMonitor()
    .then(() => logger.debug("Extension monitor initialization completed"))
    .catch((error) => logger.error("Extension monitor init failed:", error));
}

function registerRecurringAlarms(): void {
  // DNR API rate limit対応: 36秒間隔（Chrome制限: 10分間に最大20回、30秒以上の間隔）
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  // Extension risk analysis (runs every 5 minutes)
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
}

function createRuntimeHandlerDependencies(): RuntimeHandlerDependencies {
  return {
    logger,
    fallbacks: {
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
      nrdConfig: DEFAULT_NRD_CONFIG,
      typosquatConfig: DEFAULT_TYPOSQUAT_CONFIG,
      notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
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
    handleSendBeacon: (data, sender) => securityEventHandlers.handleSendBeacon(data as Record<string, unknown>, sender),
    handleMediaCapture: (data, sender) => securityEventHandlers.handleMediaCapture(data as Record<string, unknown>, sender),
    handleNotificationPhishing: (data, sender) => securityEventHandlers.handleNotificationPhishing(data as Record<string, unknown>, sender),
    handleCredentialAPI: (data, sender) => securityEventHandlers.handleCredentialAPI(data as Record<string, unknown>, sender),
    handleDeviceSensor: (data, sender) => securityEventHandlers.handleDeviceSensor(data as Record<string, unknown>, sender),
    handleDeviceEnumeration: (data, sender) => securityEventHandlers.handleDeviceEnumeration(data as Record<string, unknown>, sender),
    handleStorageExfiltration: (data, sender) => securityEventHandlers.handleStorageExfiltration(data as Record<string, unknown>, sender),
    handlePrototypePollution: (data, sender) => securityEventHandlers.handlePrototypePollution(data as Record<string, unknown>, sender),
    handleDNSPrefetchLeak: (data, sender) => securityEventHandlers.handleDNSPrefetchLeak(data as Record<string, unknown>, sender),
    handleFormHijack: (data, sender) => securityEventHandlers.handleFormHijack(data as Record<string, unknown>, sender),
    handleCSSKeylogging: (data, sender) => securityEventHandlers.handleCSSKeylogging(data as Record<string, unknown>, sender),
    handleDOMClobbering: (data, sender) => securityEventHandlers.handleDOMClobbering(data as Record<string, unknown>, sender),
    handleFetchExfiltration: (data, sender) => securityEventHandlers.handleFetchExfiltration(data as Record<string, unknown>, sender),
    handleWASMExecution: (data, sender) => securityEventHandlers.handleWASMExecution(data as Record<string, unknown>, sender),
    handleExecCommandClipboard: (data, sender) => securityEventHandlers.handleExecCommandClipboard(data as Record<string, unknown>, sender),
    handleClipboardEventSniffing: (data, sender) => securityEventHandlers.handleClipboardEventSniffing(data as Record<string, unknown>, sender),
    handleDragEventSniffing: (data, sender) => securityEventHandlers.handleDragEventSniffing(data as Record<string, unknown>, sender),
    handleSelectionSniffing: (data, sender) => securityEventHandlers.handleSelectionSniffing(data as Record<string, unknown>, sender),
    getAlerts: (options) => backgroundAlerts.getAlertManager().getAlerts(options),
    getCSPReports: cspReportingService.getCSPReports,
    generateCSPPolicy: cspReportingService.generateCSPPolicy,
    generateCSPPolicyByDomain: cspReportingService.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: cspReportingService.saveGeneratedCSPPolicy,
    clearCSPData: cspReportingService.clearCSPData,
    clearAllData,
    getSSOManager,
    getEnterpriseManager,
    getDetectionConfig: backgroundConfig.getDetectionConfig,
    setDetectionConfig: backgroundConfig.setDetectionConfig,
    handleAIPromptCaptured: (payload) => aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
    getAIMonitorConfig: aiPromptMonitorService.getAIMonitorConfig,
    setAIMonitorConfig: aiPromptMonitorService.setAIMonitorConfig,
    handleNRDCheck: domainRiskService.handleNRDCheck,
    getNRDConfig: domainRiskService.getNRDConfig,
    setNRDConfig: domainRiskService.setNRDConfig,
    handleTyposquatCheck: domainRiskService.handleTyposquatCheck,
    getTyposquatConfig: domainRiskService.getTyposquatConfig,
    setTyposquatConfig: domainRiskService.setTyposquatConfig,
    getNetworkRequests,
    getExtensionRequests,
    getExtensionStats,
    getAllExtensionRisks,
    getExtensionRiskAnalysis,
    analyzeExtensionRisks,
    getServiceConnections: connectionTracker.getServiceConnections,
    getExtensionConnections: connectionTracker.getExtensionConnections,
    getNotificationConfig: backgroundConfig.getNotificationConfig,
    setNotificationConfig: backgroundConfig.setNotificationConfig,
  };
}

export default defineBackground(() => {
  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerNetworkMonitorListener();
  registerDoHMonitorListener();

  // アイコンクリックでダッシュボードを開く（popup削除に伴い action.onClicked を使用）
  chrome.action.onClicked.addListener(() => {
    const dashboardUrl = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url: dashboardUrl, active: true });
  });

  initializeBackgroundServices();
  registerRecurringAlarms();

  const runtimeHandlers = createRuntimeMessageHandlersModule(
    createRuntimeHandlerDependencies(),
  );

  // ============================================================================
  // Alarm Handlers
  // ============================================================================

  const alarmHandlers = createAlarmHandlersModule({
    logger,
    checkDNRMatchesHandler,
    analyzeExtensionRisks,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    // アラーム処理のたびに通信先バッファをフラッシュ（MV3 SW停止前に確実に永続化）
    connectionTracker.flush();

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
  doHMonitor = createDoHMonitor();
  doHMonitor.start().catch((err) => logger.error("Failed to start DoH monitor:", err));

  doHMonitor.onRequest(async (record: DoHRequestRecord) => {
    try {
      logger.debug("DoH request detected:", record.domain);
    } catch (error) {
      logger.error("Failed to handle DoH request:", error);
    }
  });

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    backgroundStorage
      .addCookieToService(domain, cookie)
      .catch((err) => logger.debug("Add cookie to service failed:", err));
  });
});
