import type { DetectedService } from "../../types/index.js";
import type { AIMonitorConfig, CapturedAIPrompt, DLPServerConfig, ModelStatus } from "../../ai-detector/index.js";
import type { NRDConfig } from "../../nrd/index.js";
import type { TyposquatConfig } from "../../typosquat/index.js";
import type {
  CSPGenerationOptions,
  CSPViolation,
} from "../../csp/index.js";
import type {
  DetectionConfig,
  EnterpriseStatus,
  NotificationConfig,
} from "../../extension-runtime/index.js";
import type { SecurityAlert, AlertStatus } from "../../alerts/index.js";

export type RuntimeMessage = {
  type?: string;
  data?: unknown;
  payload?: unknown;
  debugType?: string;
  debugData?: unknown;
};

export type RuntimeMessageHandler = (
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;

export interface AsyncMessageHandlerConfig {
  execute: (
    message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown;
  fallback: () => unknown;
}

export interface RuntimeMessageHandlers {
  direct: Map<string, RuntimeMessageHandler>;
  async: Map<string, AsyncMessageHandlerConfig>;
}

export type AsyncHandlerEntry = [string, AsyncMessageHandlerConfig];

export interface LoggerLike {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface RuntimeHandlerFallbacks {
  detectionConfig: DetectionConfig;
  aiMonitorConfig: AIMonitorConfig;
  nrdConfig: NRDConfig;
  typosquatConfig: TyposquatConfig;
  notificationConfig: NotificationConfig;
}

export interface RuntimeHandlerDependencies {
  logger: LoggerLike;
  fallbacks: RuntimeHandlerFallbacks;

  handleDebugBridgeForward: (
    type: string,
    data: unknown,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  getKnownExtensions: () => Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }>;

  handlePageAnalysis: (payload: unknown) => Promise<void>;
  handleCSPViolation: (
    data: Omit<CSPViolation, "type">,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
handleNetworkInspection: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDataExfiltration: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCredentialTheft: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSupplyChainRisk: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleTrackingBeacon: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleClipboardHijack: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleXSSDetected: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDOMScraping: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSuspiciousDownload: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleWebSocketConnection: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleWorkerCreated: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSharedWorkerCreated: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleServiceWorkerRegistered: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDynamicCodeExecution: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleFullscreenPhishing: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleClipboardRead: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleGeolocationAccessed: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCanvasFingerprint: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleWebGLFingerprint: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleAudioFingerprint: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleBroadcastChannel: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleWebRTCConnection: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSendBeacon: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleMediaCapture: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleNotificationPhishing: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCredentialAPI: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDeviceSensor: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDeviceEnumeration: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleStorageExfiltration: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handlePrototypePollution: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDNSPrefetchLeak: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleFormHijack: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCSSKeylogging: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDOMClobbering: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleFetchExfiltration: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleWASMExecution: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleExecCommandClipboard: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleClipboardEventSniffing: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDragEventSniffing: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSelectionSniffing: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleOpenRedirect: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;

  getAlerts: (options?: { limit?: number; status?: AlertStatus[] }) => Promise<SecurityAlert[]>;

  getServices: () => Promise<DetectedService[]>;

  getCSPReports: (options?: {
    type?: "csp-violation" | "network-request";
    limit?: number;
    offset?: number;
    since?: string;
    until?: string;
  }) => unknown;
  generateCSPPolicy: (options?: Partial<CSPGenerationOptions>) => unknown;
  generateCSPPolicyByDomain: (options?: Partial<CSPGenerationOptions>) => unknown;
  saveGeneratedCSPPolicy: (result: unknown) => Promise<void>;
  clearCSPData: () => { success: boolean };
  clearAllData: () => Promise<{ success: boolean }>;
  importData: (data: { services: Record<string, unknown>[]; serviceConnections?: Record<string, string[]>; extensionConnections?: Record<string, string[]> }) => Promise<{ success: boolean; counts: { services: number; serviceConnections: number; extensionConnections: number } }>;

  getSSOManager: () => Promise<{
    getStatus: () => Promise<unknown>;
    disableSSO: () => Promise<void>;
    startOIDCAuth: () => Promise<unknown>;
    startSAMLAuth: () => Promise<unknown>;
  }>;
  getEnterpriseManager: () => Promise<{
    getStatus: () => EnterpriseStatus;
    getEffectiveDetectionConfig: (config: DetectionConfig) => DetectionConfig;
  }>;

  getDetectionConfig: () => Promise<DetectionConfig>;
  setDetectionConfig: (config: Partial<DetectionConfig>) => Promise<{ success: boolean }>;

  getDisabledAlertCategories: () => Promise<string[]>;
  setDisabledAlertCategories: (categories: string[]) => Promise<{ success: boolean }>;

  handleAIPromptCaptured: (data: CapturedAIPrompt) => Promise<{ success: boolean }>;
  getAIMonitorConfig: () => Promise<AIMonitorConfig>;
  setAIMonitorConfig: (config: Partial<AIMonitorConfig>) => Promise<{ success: boolean }>;

  handleNRDCheck: (domain: string) => Promise<unknown>;
  getNRDConfig: () => Promise<NRDConfig>;
  setNRDConfig: (config: NRDConfig) => Promise<{ success: boolean }>;

  handleTyposquatCheck: (domain: string) => Promise<unknown>;
  getTyposquatConfig: () => Promise<TyposquatConfig>;
  setTyposquatConfig: (config: TyposquatConfig) => Promise<{ success: boolean }>;

  getNetworkRequests: (options?: {
    limit?: number;
    offset?: number;
    since?: number;
    initiatorType?: "extension" | "page" | "browser" | "unknown";
  }) => Promise<unknown>;
  getExtensionRequests: (options?: { limit?: number; offset?: number }) => Promise<unknown>;
  getExtensionStats: () => Promise<unknown>;
  getAllExtensionRisks: () => Promise<unknown[]>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<unknown>;
  analyzeExtensionRisks: () => Promise<void>;

  getNotificationConfig: () => Promise<NotificationConfig>;
  setNotificationConfig: (
    config: Partial<NotificationConfig>,
  ) => Promise<{ success: boolean }>;

  getDLPServerConfig: () => Promise<DLPServerConfig>;
  setDLPServerConfig: (config: Partial<DLPServerConfig>) => Promise<{ success: boolean }>;

  downloadDLPModel: () => Promise<{ success: boolean }>;
  getDLPModelStatus: () => Promise<ModelStatus>;
  deleteDLPModel: () => Promise<{ success: boolean }>;

  getServiceConnections: () => Promise<Record<string, string[]>>;
  getExtensionConnections: () => Promise<Record<string, string[]>>;

}

