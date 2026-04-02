import type { AlertManager } from "../alerts/index.js";
import type {
  CooldownManager,
  DetectionConfig,
  NetworkRequestRecord,
} from "../extension-runtime/index.js";
import type { ExtensionRiskAnalysis } from "../extension-analyzers/index.js";
import type { NetworkMonitor } from "./network-monitor/types.js";
import type { ExtensionStats, NetworkRequestQueryOptions } from "./helpers.js";

export interface ExtensionNetworkServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<{
    alertCooldown?: Record<string, number>;
    detectionConfig?: DetectionConfig;
  }>;
  setStorage: (data: {
    alertCooldown?: Record<string, number>;
  }) => Promise<void>;
  getAlertManager: () => AlertManager;
  getRuntimeId: () => string;
  /** 全ネットワークリクエストの通知コールバック（通信先集約等に使用） */
  onNetworkRequest?: (record: NetworkRequestRecord) => void;
}

export interface ExtensionNetworkService {
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
  /** インメモリのネットワークリクエストバッファ */
  requestBuffer: NetworkRequestRecord[];
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
