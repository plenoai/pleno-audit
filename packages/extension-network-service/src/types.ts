import type { AlertManager } from "@pleno-audit/alerts";
import type {
  CooldownManager,
  DetectionConfig,
  ExtensionRiskAnalysis,
  NetworkMonitorConfig,
  NetworkRequestRecord,
} from "@pleno-audit/extension-runtime";
import type { NetworkMonitor } from "./network-monitor/types.js";
import type { ExtensionStats, NetworkRequestQueryOptions } from "./helpers.js";

export interface ExtensionNetworkServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<{
    alertCooldown?: Record<string, number>;
    networkMonitorConfig?: NetworkMonitorConfig;
    detectionConfig?: DetectionConfig;
  }>;
  setStorage: (data: {
    alertCooldown?: Record<string, number>;
    networkMonitorConfig?: NetworkMonitorConfig;
  }) => Promise<void>;
  addEvent: (event: {
    type: "extension_request";
    domain: string;
    timestamp: number;
    details: {
      extensionId: string;
      extensionName: string;
      url: string;
      method: string;
      resourceType: string;
      initiatorType: NetworkRequestRecord["initiatorType"];
    };
  }) => Promise<unknown>;
  getAlertManager: () => AlertManager;
  getRuntimeId: () => string;
}

export interface ExtensionNetworkService {
  getNetworkMonitorConfig: () => Promise<NetworkMonitorConfig>;
  setNetworkMonitorConfig: (config: NetworkMonitorConfig) => Promise<{ success: boolean }>;
  initExtensionMonitor: () => Promise<void>;
  stopExtensionMonitor: () => Promise<void>;
  checkDNRMatchesHandler: () => Promise<void>;
  getNetworkRequests: (
    options?: NetworkRequestQueryOptions
  ) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getExtensionRequests: (
    options?: { limit?: number; offset?: number }
  ) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getKnownExtensions: () => Record<
    string,
    { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }
  >;
  getExtensionStats: () => Promise<ExtensionStats>;
  analyzeExtensionRisks: () => Promise<void>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<ExtensionRiskAnalysis | null>;
  getAllExtensionRisks: () => Promise<ExtensionRiskAnalysis[]>;
}

export interface ExtensionNetworkState {
  extensionMonitor: NetworkMonitor | null;
  cooldownManager: CooldownManager | null;
}

export interface LoggerLike {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ExtensionNetworkContext {
  deps: ExtensionNetworkServiceDeps;
  state: ExtensionNetworkState;
}
