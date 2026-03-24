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
    ["SEND_BEACON_DETECTED", {
      execute: (message, sender) => deps.handleSendBeacon(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["MEDIA_CAPTURE_DETECTED", {
      execute: (message, sender) => deps.handleMediaCapture(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["NOTIFICATION_PHISHING_DETECTED", {
      execute: (message, sender) => deps.handleNotificationPhishing(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CREDENTIAL_API_DETECTED", {
      execute: (message, sender) => deps.handleCredentialAPI(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DEVICE_SENSOR_ACCESSED", {
      execute: (message, sender) => deps.handleDeviceSensor(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DEVICE_ENUMERATION_DETECTED", {
      execute: (message, sender) => deps.handleDeviceEnumeration(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["STORAGE_EXFILTRATION_DETECTED", {
      execute: (message, sender) => deps.handleStorageExfiltration(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["PROTOTYPE_POLLUTION_DETECTED", {
      execute: (message, sender) => deps.handlePrototypePollution(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DNS_PREFETCH_LEAK_DETECTED", {
      execute: (message, sender) => deps.handleDNSPrefetchLeak(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["FORM_HIJACK_DETECTED", {
      execute: (message, sender) => deps.handleFormHijack(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CSS_KEYLOGGING_DETECTED", {
      execute: (message, sender) => deps.handleCSSKeylogging(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["PERFORMANCE_OBSERVER_DETECTED", {
      execute: (message, sender) => deps.handlePerformanceObserver(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["POSTMESSAGE_EXFIL_DETECTED", {
      execute: (message, sender) => deps.handlePostMessageExfil(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DOM_CLOBBERING_DETECTED", {
      execute: (message, sender) => deps.handleDOMClobbering(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CACHE_API_ABUSE_DETECTED", {
      execute: (message, sender) => deps.handleCacheAPIAbuse(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["FETCH_EXFILTRATION_DETECTED", {
      execute: (message, sender) => deps.handleFetchExfiltration(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["WASM_EXECUTION_DETECTED", {
      execute: (message, sender) => deps.handleWASMExecution(message.data, sender),
      fallback: () => ({ success: false }),
    }],
  ];
}
