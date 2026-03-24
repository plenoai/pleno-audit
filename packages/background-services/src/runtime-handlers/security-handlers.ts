import type { CSPViolation } from "@libztbs/csp";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createSecurityAsyncHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["PAGE_ANALYZED", {
      execute: async (message) => {
        await deps.handlePageAnalysis(message.payload);
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["CSP_VIOLATION", {
      execute: (message, sender) => deps.handleCSPViolation(message.data as Omit<CSPViolation, "type">, sender),
      fallback: () => ({ success: false }),
    }],
["NETWORK_INSPECTION_REQUEST", {
      execute: (message, sender) => deps.handleNetworkInspection(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DATA_EXFILTRATION_DETECTED", {
      execute: (message, sender) => deps.handleDataExfiltration(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CREDENTIAL_THEFT_DETECTED", {
      execute: (message, sender) => deps.handleCredentialTheft(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SUPPLY_CHAIN_RISK_DETECTED", {
      execute: (message, sender) => deps.handleSupplyChainRisk(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["TRACKING_BEACON_DETECTED", {
      execute: (message, sender) => deps.handleTrackingBeacon(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CLIPBOARD_HIJACK_DETECTED", {
      execute: (message, sender) => deps.handleClipboardHijack(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["COOKIE_ACCESS_DETECTED", {
      execute: (message, sender) => deps.handleCookieAccess(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["XSS_DETECTED", {
      execute: (message, sender) => deps.handleXSSDetected(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DOM_SCRAPING_DETECTED", {
      execute: (message, sender) => deps.handleDOMScraping(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SUSPICIOUS_DOWNLOAD_DETECTED", {
      execute: (message, sender) => deps.handleSuspiciousDownload(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["WEBSOCKET_CONNECTION_DETECTED", {
      execute: (message, sender) => deps.handleWebSocketConnection(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["WORKER_CREATED", {
      execute: (message, sender) => deps.handleWorkerCreated(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SHARED_WORKER_CREATED", {
      execute: (message, sender) => deps.handleSharedWorkerCreated(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SERVICE_WORKER_REGISTERED", {
      execute: (message, sender) => deps.handleServiceWorkerRegistered(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DYNAMIC_CODE_EXECUTION_DETECTED", {
      execute: (message, sender) => deps.handleDynamicCodeExecution(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["FULLSCREEN_PHISHING_DETECTED", {
      execute: (message, sender) => deps.handleFullscreenPhishing(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CLIPBOARD_READ_DETECTED", {
      execute: (message, sender) => deps.handleClipboardRead(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["GEOLOCATION_ACCESSED", {
      execute: (message, sender) => deps.handleGeolocationAccessed(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CANVAS_FINGERPRINT_DETECTED", {
      execute: (message, sender) => deps.handleCanvasFingerprint(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["WEBGL_FINGERPRINT_DETECTED", {
      execute: (message, sender) => deps.handleWebGLFingerprint(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["AUDIO_FINGERPRINT_DETECTED", {
      execute: (message, sender) => deps.handleAudioFingerprint(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["BROADCAST_CHANNEL_DETECTED", {
      execute: (message, sender) => deps.handleBroadcastChannel(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["WEBRTC_CONNECTION_DETECTED", {
      execute: (message, sender) => deps.handleWebRTCConnection(message.data, sender),
      fallback: () => ({ success: false }),
    }],
  ];
}
