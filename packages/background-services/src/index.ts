// Background services facade
export {
  createBackgroundServices,
  type PageAnalysis,
} from "./background-services.js";

// Runtime handlers
export {
  createRuntimeMessageHandlers,
  runAsyncMessageHandler,
  type RuntimeMessage,
  type RuntimeHandlerDependencies,
} from "./runtime-handlers/index.js";

// Computation handlers (popup offload)
export { createComputationHandlers } from "./runtime-handlers/computation-handlers.js";

// Alarm handlers
export { createAlarmHandlers } from "./services/alarm-handlers.js";

// Connection Tracker
export {
  createConnectionTracker,
  type ConnectionTracker,
  type ConnectionRecord,
  type ConnectionTrackerDeps,
} from "./services/connection-tracker.js";

// Individual services
export { createAIPromptMonitorService } from "./services/ai-prompt-monitor-service.js";
export { createCSPReportingService } from "./services/csp-reporting-service.js";
export { createDomainRiskService } from "./services/domain-risk-service.js";
export { createDebugBridgeHandler } from "./services/debug-bridge-handler.js";
export {
  createNetworkSecurityInspector,
  type NetworkInspectionRequest,
} from "./services/network-security-inspector.js";
export {
  createSecurityEventHandlers,
  type ClipboardHijackData,
  type DOMScrapingData,
  type DataExfiltrationData,
  type CredentialTheftData,
  type SupplyChainRiskData,
  type SuspiciousDownloadData,
  type TrackingBeaconData,
  type WebSocketConnectionData,
  type XSSDetectedData,
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
} from "./services/security-event-handlers.js";
