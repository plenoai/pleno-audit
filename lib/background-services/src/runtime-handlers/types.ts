import type { DetectedService } from "@libztbs/types";
import type { AIMonitorConfig, CapturedAIPrompt } from "@libztbs/ai-detector";
import type { NRDConfig } from "@libztbs/nrd";
import type { TyposquatConfig } from "@libztbs/typosquat";
import type {
  CSPConfig,
  CSPGenerationOptions,
  CSPViolation,
} from "@libztbs/csp";
import type {
  BlockingConfig,
  DataRetentionConfig,
  DetectionConfig,
  DoHMonitorConfig,
  EnterpriseStatus,
  NetworkMonitorConfig,
  NotificationConfig,
} from "@libztbs/extension-runtime";

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
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  aiMonitorConfig: AIMonitorConfig;
  nrdConfig: NRDConfig;
  typosquatConfig: TyposquatConfig;
  networkMonitorConfig: NetworkMonitorConfig;
  dataRetentionConfig: DataRetentionConfig;
  blockingConfig: BlockingConfig;
  notificationConfig: NotificationConfig;
  doHMonitorConfig: DoHMonitorConfig;
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
  handleCookieAccess: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
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
  getCSPConfig: () => Promise<CSPConfig>;
  setCSPConfig: (config: Partial<CSPConfig>) => Promise<{ success: boolean }>;
  clearCSPData: () => { success: boolean };
  clearAllData: () => Promise<{ success: boolean }>;

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
  getNetworkMonitorConfig: () => Promise<NetworkMonitorConfig>;
  setNetworkMonitorConfig: (config: NetworkMonitorConfig) => Promise<{ success: boolean }>;
  getAllExtensionRisks: () => Promise<unknown[]>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<unknown>;
  analyzeExtensionRisks: () => Promise<void>;

  getDataRetentionConfig: () => Promise<DataRetentionConfig>;
  setDataRetentionConfig: (config: DataRetentionConfig) => Promise<{ success: boolean }>;
  cleanupOldData: () => Promise<{ deleted: number }>;

  getBlockingConfig: () => Promise<BlockingConfig>;
  setBlockingConfig: (config: BlockingConfig) => Promise<{ success: boolean }>;

  getNotificationConfig: () => Promise<NotificationConfig>;
  setNotificationConfig: (
    config: Partial<NotificationConfig>,
  ) => Promise<{ success: boolean }>;

  getDoHMonitorConfig: () => Promise<DoHMonitorConfig>;
  setDoHMonitorConfig: (
    config: Partial<DoHMonitorConfig>,
  ) => Promise<{ success: boolean }>;

  getServiceConnections: () => Promise<Record<string, string[]>>;
  getExtensionConnections: () => Promise<Record<string, string[]>>;

}

