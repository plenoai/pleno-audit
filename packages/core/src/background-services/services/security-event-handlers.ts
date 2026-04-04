import type { AlertManager } from "../../alerts/index.js";

interface LoggerLike {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export interface DataExfiltrationData {
  source?: string;
  timestamp: number | string;
  pageUrl: string;
  targetUrl?: string;
  url?: string;
  targetDomain: string;
  method: string;
  bodySize: number;
  initiator: string;
  sensitiveDataTypes?: string[];
}

export interface CredentialTheftData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  formAction: string;
  targetDomain: string;
  method: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
}

export interface SupplyChainRiskData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  url: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
}

export interface TrackingBeaconData {
  source?: string;
  timestamp: number | string;
  pageUrl: string;
  url: string;
  targetDomain: string;
  bodySize: number;
  initiator: string;
}

export interface ClipboardHijackData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  text: string;
  cryptoType: string;
  fullLength: number;
}

export interface XSSDetectedData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  type: string;
  payloadPreview: string;
}

export interface DOMScrapingData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  selector: string;
  callCount: number;
}

export interface WebSocketConnectionData {
  source?: string;
  timestamp?: number;
  pageUrl?: string;
  url?: string;
  hostname?: string;
  protocol?: string;
  isExternal?: boolean;
}

export interface SuspiciousDownloadData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  type: string;
  filename: string;
  extension: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface WorkerCreatedData {
  source?: string;
  url?: string;
  isBlobUrl?: boolean;
  type?: string;
  timestamp?: number;
  pageUrl?: string;
}

export interface SharedWorkerCreatedData {
  source?: string;
  url?: string;
  isBlobUrl?: boolean;
  name?: string;
  timestamp?: number;
  pageUrl?: string;
}

export interface ServiceWorkerRegisteredData {
  source?: string;
  url?: string;
  scope?: string;
  type?: string;
  timestamp?: number;
  pageUrl?: string;
}

export interface DynamicCodeExecutionData {
  method?: string;
  codeLength?: number;
  codeSample?: string;
  argCount?: number;
  timestamp?: number;
  pageUrl?: string;
}

export interface FullscreenPhishingData {
  element?: string;
  elementId?: string | null;
  className?: string | null;
  timestamp?: number;
  pageUrl?: string;
}

export interface ClipboardReadData {
  timestamp?: number;
  pageUrl?: string;
}

export interface GeolocationAccessedData {
  method?: string;
  highAccuracy?: boolean;
  timestamp?: number;
  pageUrl?: string;
}

export interface CanvasFingerprintData {
  source?: string;
  callCount?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  timestamp?: number;
  pageUrl?: string;
}

export interface WebGLFingerprintData {
  source?: string;
  parameter?: number;
  timestamp?: number;
  pageUrl?: string;
}

export interface AudioFingerprintData {
  source?: string;
  contextCount?: number;
  sampleRate?: number;
  timestamp?: number;
  pageUrl?: string;
}

export interface OpenRedirectData {
  source?: string;
  timestamp: number | string;
  pageUrl: string;
  redirectUrl: string;
  parameterName: string;
  isExternal: boolean;
}

interface SecurityEventHandlerDependencies {
  getAlertManager: () => AlertManager;
  extractDomainFromUrl: (url: string) => string;
  checkDataTransferPolicy: (params: {
    destination: string;
    sizeKB: number;
  }) => Promise<void>;
  updateService?: (domain: string, update: { sensitiveDataDetected?: string[] }) => Promise<void>;
  logger: LoggerLike;
}

function resolvePageDomain(
  sender: chrome.runtime.MessageSender,
  pageUrl: string,
  extractDomainFromUrl: (url: string) => string,
): string {
  return extractDomainFromUrl(sender.tab?.url || pageUrl);
}

function resolvePageUrl(
  sender: chrome.runtime.MessageSender,
  pageUrl: string,
): string {
  return sender.tab?.url || pageUrl;
}

function sourceLabel(source?: string): string {
  return source || "unknown";
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] || "unknown";
  return basename.slice(0, 128);
}

export function createSecurityEventHandlers(
  deps: SecurityEventHandlerDependencies,
) {
  return {
    async handleDataExfiltration(
      data: DataExfiltrationData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertDataExfiltration({
        sourceDomain: pageDomain,
        targetDomain: data.targetDomain,
        url: data.targetUrl ?? data.url ?? data.targetDomain,
        bodySize: data.bodySize,
        method: data.method,
        initiator: data.initiator,
        sensitiveDataTypes: data.sensitiveDataTypes,
      }, pageUrl);

      if (data.sensitiveDataTypes?.length && deps.updateService) {
        deps.updateService(pageDomain, {
          sensitiveDataDetected: data.sensitiveDataTypes,
        }).catch(() => {});
      }

      deps.logger.warn({
        event: "SECURITY_DATA_EXFILTRATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          from: pageDomain,
          to: data.targetDomain,
          sizeKB: Math.round(data.bodySize / 1024),
          method: data.method,
          sensitiveDataTypes: data.sensitiveDataTypes,
        },
      });

      deps.checkDataTransferPolicy({
        destination: data.targetDomain,
        sizeKB: Math.round(data.bodySize / 1024),
      }).catch(() => {
        // Ignore policy check errors
      });

      return { success: true };
    },

    async handleCredentialTheft(
      data: CredentialTheftData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      if (data.risks.length > 0) {
        await deps.getAlertManager().alertCredentialTheft({
          sourceDomain: pageDomain,
          targetDomain: data.targetDomain,
          formAction: data.formAction,
          isSecure: data.isSecure,
          isCrossOrigin: data.isCrossOrigin,
          fieldType: data.fieldType,
          risks: data.risks,
        }, pageUrl);

        deps.logger.warn({
          event: "SECURITY_CREDENTIAL_THEFT_RISK_DETECTED",
          data: {
            source: sourceLabel(data.source),
            from: pageDomain,
            to: data.targetDomain,
            fieldType: data.fieldType,
            risks: data.risks,
          },
        });
      }

      return { success: true };
    },

    async handleSupplyChainRisk(
      data: SupplyChainRiskData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const resourceDomain = deps.extractDomainFromUrl(data.url);
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertSupplyChainRisk({
        pageDomain,
        resourceUrl: data.url,
        resourceDomain,
        resourceType: data.resourceType,
        hasIntegrity: data.hasIntegrity,
        hasCrossorigin: data.hasCrossorigin,
        isCDN: data.isCDN,
        risks: data.risks,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_SUPPLY_CHAIN_RISK_DETECTED",
        data: {
          source: sourceLabel(data.source),
          page: pageDomain,
          resource: resourceDomain,
          resourceType: data.resourceType,
          risks: data.risks,
        },
      });

      return { success: true };
    },

    async handleTrackingBeacon(
      data: TrackingBeaconData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertTrackingBeacon({
        sourceDomain: pageDomain,
        targetDomain: data.targetDomain,
        url: data.url,
        bodySize: data.bodySize,
        initiator: data.initiator,
      }, pageUrl);

      deps.logger.debug({
        event: "SECURITY_TRACKING_BEACON_DETECTED",
        data: {
          source: sourceLabel(data.source),
          from: pageDomain,
          to: data.targetDomain,
        },
      });

      return { success: true };
    },

    async handleClipboardHijack(
      data: ClipboardHijackData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertClipboardHijack({
        domain: pageDomain,
        cryptoType: data.cryptoType,
        textPreview: data.text,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CLIPBOARD_HIJACK_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          cryptoType: data.cryptoType,
        },
      });

      return { success: true };
    },

    async handleXSSDetected(
      data: XSSDetectedData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertXSSInjection({
        domain: pageDomain,
        injectionType: data.type,
        payloadPreview: data.payloadPreview,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_XSS_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          type: data.type,
        },
      });

      return { success: true };
    },

    async handleDOMScraping(
      data: DOMScrapingData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertDOMScraping({
        domain: pageDomain,
        selector: data.selector,
        callCount: data.callCount,
      }, pageUrl);

      deps.logger.debug({
        event: "SECURITY_DOM_SCRAPING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          callCount: data.callCount,
        },
      });

      return { success: true };
    },

    async handleSuspiciousDownload(
      data: SuspiciousDownloadData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertSuspiciousDownload({
        domain: pageDomain,
        downloadType: data.type,
        filename: data.filename,
        extension: data.extension,
        size: data.size,
        mimeType: data.mimeType,
        downloadUrl: data.url,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_SUSPICIOUS_DOWNLOAD_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          type: data.type,
          filename: sanitizeFilename(data.filename),
        },
      });

      return { success: true };
    },

    async handleWebSocketConnection(
      data: WebSocketConnectionData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl ?? "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl ?? "");

      await deps.getAlertManager().alertWebSocketConnection({
        domain: pageDomain,
        hostname: data.hostname ?? "",
        wsUrl: data.url,
        protocol: data.protocol,
        isExternal: data.isExternal ?? false,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_WEBSOCKET_CONNECTION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          hostname: data.hostname,
          isExternal: data.isExternal,
        },
      });

      return { success: true };
    },

    async handleWorkerCreated(
      data: WorkerCreatedData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);

      deps.logger.debug({
        event: "SECURITY_WORKER_CREATED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
          isBlobUrl: data.isBlobUrl,
        },
      });

      return { success: true };
    },

    async handleSharedWorkerCreated(
      data: SharedWorkerCreatedData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);

      deps.logger.debug({
        event: "SECURITY_SHARED_WORKER_CREATED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
          isBlobUrl: data.isBlobUrl,
        },
      });

      return { success: true };
    },

    async handleServiceWorkerRegistered(
      data: ServiceWorkerRegisteredData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);

      deps.logger.debug({
        event: "SECURITY_SERVICE_WORKER_REGISTERED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
          scope: data.scope,
        },
      });

      return { success: true };
    },

    async handleDynamicCodeExecution(
      data: DynamicCodeExecutionData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDynamicCodeExecution({
        domain: pageDomain,
        method: data.method ?? "unknown",
        codeLength: data.codeLength ?? 0,
        codePreview: data.codeSample ? data.codeSample.slice(0, 200) : undefined,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DYNAMIC_CODE_EXECUTION_DETECTED",
        data: {
          domain: pageDomain,
          method: data.method,
          codeLength: data.codeLength,
        },
      });

      return { success: true };
    },

    async handleFullscreenPhishing(
      data: FullscreenPhishingData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertFullscreenPhishing({
        domain: pageDomain,
        element: data.element ?? "unknown",
        elementId: data.elementId ?? undefined,
        className: data.className ?? undefined,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_FULLSCREEN_PHISHING_DETECTED",
        data: {
          domain: pageDomain,
          element: data.element,
        },
      });

      return { success: true };
    },

    async handleClipboardRead(
      data: ClipboardReadData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertClipboardRead({
        domain: pageDomain,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CLIPBOARD_READ_DETECTED",
        data: {
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleGeolocationAccessed(
      data: GeolocationAccessedData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertGeolocationAccess({
        domain: pageDomain,
        method: data.method ?? "getCurrentPosition",
        highAccuracy: data.highAccuracy ?? false,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_GEOLOCATION_ACCESSED",
        data: {
          domain: pageDomain,
          method: data.method,
          highAccuracy: data.highAccuracy,
        },
      });

      return { success: true };
    },

    async handleCanvasFingerprint(
      data: CanvasFingerprintData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      const callCount = data.callCount ?? 0;
      if (callCount < 1) {
        return { success: true };
      }

      await deps.getAlertManager().alertCanvasFingerprint({
        domain: pageDomain,
        callCount,
        canvasWidth: data.canvasWidth ?? 0,
        canvasHeight: data.canvasHeight ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CANVAS_FINGERPRINT_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          callCount: data.callCount,
        },
      });

      return { success: true };
    },

    async handleWebGLFingerprint(
      data: WebGLFingerprintData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertWebGLFingerprint({
        domain: pageDomain,
        parameter: data.parameter ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_WEBGL_FINGERPRINT_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          parameter: data.parameter,
        },
      });

      return { success: true };
    },

    async handleAudioFingerprint(
      data: AudioFingerprintData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertAudioFingerprint({
        domain: pageDomain,
        contextCount: data.contextCount ?? 0,
        sampleRate: data.sampleRate,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_AUDIO_FINGERPRINT_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          contextCount: data.contextCount,
        },
      });

      return { success: true };
    },

    async handleBroadcastChannel(
      data: { channelName?: string; blocked?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertBroadcastChannel({
        domain: pageDomain,
        channelName: data.channelName ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_BROADCAST_CHANNEL_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          channelName: data.channelName,
        },
      });

      return { success: true };
    },

    async handleWebRTCConnection(
      data: { ts?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertWebRTCConnection({
        domain: pageDomain,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_WEBRTC_CONNECTION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleSendBeacon(
      data: { url?: string; dataSize?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertSendBeacon({
        domain: pageDomain,
        url: data.url ?? "",
        dataSize: data.dataSize ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_SEND_BEACON_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
          dataSize: data.dataSize,
        },
      });

      return { success: true };
    },

    async handleMediaCapture(
      data: { method?: string; audio?: boolean; video?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertMediaCapture({
        domain: pageDomain,
        method: data.method ?? "getUserMedia",
        audio: data.audio ?? false,
        video: data.video ?? false,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_MEDIA_CAPTURE_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          method: data.method,
        },
      });

      return { success: true };
    },

    async handleNotificationPhishing(
      data: { title?: string; body?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertNotificationPhishing({
        domain: pageDomain,
        title: data.title ?? "",
        body: data.body,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_NOTIFICATION_PHISHING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          title: data.title,
        },
      });

      return { success: true };
    },

    async handleCredentialAPI(
      data: { method?: string; hasPassword?: boolean; hasFederated?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertCredentialAPI({
        domain: pageDomain,
        method: data.method ?? "get",
        hasPassword: data.hasPassword,
        hasFederated: data.hasFederated,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CREDENTIAL_API_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          method: data.method,
        },
      });

      return { success: true };
    },

    async handleDeviceSensor(
      data: { sensorType?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDeviceSensor({
        domain: pageDomain,
        sensorType: data.sensorType ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DEVICE_SENSOR_ACCESSED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          sensorType: data.sensorType,
        },
      });

      return { success: true };
    },

    async handleDeviceEnumeration(
      data: { timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDeviceEnumeration({
        domain: pageDomain,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DEVICE_ENUMERATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleStorageExfiltration(
      data: { storageType?: string; accessCount?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertStorageExfiltration({
        domain: pageDomain,
        storageType: data.storageType ?? "localStorage",
        accessCount: data.accessCount ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_STORAGE_EXFILTRATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          storageType: data.storageType,
          accessCount: data.accessCount,
        },
      });

      return { success: true };
    },

    async handlePrototypePollution(
      data: { target?: string; property?: string; method?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertPrototypePollution({
        domain: pageDomain,
        target: data.target ?? "Object.prototype",
        property: data.property ?? "unknown",
        method: data.method ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_PROTOTYPE_POLLUTION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          target: data.target,
          property: data.property,
          method: data.method,
        },
      });

      return { success: true };
    },

    async handleDNSPrefetchLeak(
      data: { rel?: string; href?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDNSPrefetchLeak({
        domain: pageDomain,
        rel: data.rel ?? "dns-prefetch",
        href: data.href ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DNS_PREFETCH_LEAK_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          rel: data.rel,
          href: data.href,
        },
      });

      return { success: true };
    },

    async handleFormHijack(
      data: { originalAction?: string; newAction?: string; targetDomain?: string; isCrossOrigin?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertFormHijack({
        domain: pageDomain,
        originalAction: data.originalAction ?? "",
        newAction: data.newAction ?? "",
        targetDomain: data.targetDomain ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_FORM_HIJACK_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          originalAction: data.originalAction,
          newAction: data.newAction,
          targetDomain: data.targetDomain,
        },
      });

      return { success: true };
    },

    async handleCSSKeylogging(
      data: { sampleRule?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertCSSKeylogging({
        domain: pageDomain,
        sampleRule: data.sampleRule ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CSS_KEYLOGGING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          sampleRule: data.sampleRule,
        },
      });

      return { success: true };
    },

    async handlePerformanceObserver(
      data: { entryType?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertPerformanceObserver({
        domain: pageDomain,
        entryType: data.entryType ?? "resource",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_PERFORMANCE_OBSERVER_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          entryType: data.entryType,
        },
      });

      return { success: true };
    },

    async handlePostMessageExfil(
      data: { targetOrigin?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertPostMessageExfil({
        domain: pageDomain,
        targetOrigin: data.targetOrigin ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_POSTMESSAGE_EXFIL_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          targetOrigin: data.targetOrigin,
        },
      });

      return { success: true };
    },

    async handleDOMClobbering(
      data: { attributeName?: string; attributeValue?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDOMClobbering({
        domain: pageDomain,
        attributeName: data.attributeName ?? "id",
        attributeValue: data.attributeValue ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DOM_CLOBBERING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          attributeName: data.attributeName,
          attributeValue: data.attributeValue,
        },
      });

      return { success: true };
    },

    async handleCacheAPIAbuse(
      data: { operation?: string; cacheName?: string; url?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertCacheAPIAbuse({
        domain: pageDomain,
        operation: data.operation ?? "open",
        cacheName: data.cacheName ?? "",
        url: data.url,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CACHE_API_ABUSE_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          operation: data.operation,
          cacheName: data.cacheName,
          url: data.url,
        },
      });

      return { success: true };
    },

    async handleFetchExfiltration(
      data: { url?: string; mode?: string; reason?: string; bodySize?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertFetchExfiltration({
        domain: pageDomain,
        url: data.url ?? "",
        mode: data.mode ?? "cors",
        reason: data.reason ?? "cross_origin_no_cors",
        bodySize: data.bodySize,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_FETCH_EXFILTRATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
          mode: data.mode,
          reason: data.reason,
          bodySize: data.bodySize,
        },
      });

      return { success: true };
    },

    async handleWASMExecution(
      data: { method?: string; byteLength?: number | null; isBinary?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertWASMExecution({
        domain: pageDomain,
        method: data.method ?? "instantiate",
        byteLength: data.byteLength ?? null,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_WASM_EXECUTION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          method: data.method,
          byteLength: data.byteLength,
        },
      });

      return { success: true };
    },

    async handleIntersectionObserver(
      data: { observedCount?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertIntersectionObserver({
        domain: pageDomain,
        observedCount: data.observedCount ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_INTERSECTION_OBSERVER_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          observedCount: data.observedCount,
        },
      });

      return { success: true };
    },

    async handleIndexedDBAbuse(
      data: { dbName?: string; version?: number | null; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertIndexedDBAbuse({
        domain: pageDomain,
        dbName: data.dbName ?? "",
        version: data.version ?? null,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_INDEXEDDB_ABUSE_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          dbName: data.dbName,
          version: data.version,
        },
      });

      return { success: true };
    },

    async handleHistoryManipulation(
      data: { method?: string; url?: string | null; hasState?: boolean; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertHistoryManipulation({
        domain: pageDomain,
        method: data.method ?? "pushState",
        url: data.url ?? null,
        hasState: data.hasState ?? false,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_HISTORY_MANIPULATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          method: data.method,
          url: data.url,
          hasState: data.hasState,
        },
      });

      return { success: true };
    },

    async handleMessageChannel(
      data: { timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertMessageChannel({
        domain: pageDomain,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_MESSAGE_CHANNEL_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleResizeObserver(
      data: { timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertResizeObserver({
        domain: pageDomain,
      }, pageUrl);

      deps.logger.debug({
        event: "SECURITY_RESIZE_OBSERVER_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleExecCommandClipboard(
      data: { command?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertExecCommandClipboard({
        domain: pageDomain,
        command: data.command ?? "copy",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_EXECCOMMAND_CLIPBOARD_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          command: data.command,
        },
      });

      return { success: true };
    },

    async handleEventSourceChannel(
      data: { url?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertEventSourceChannel({
        domain: pageDomain,
        url: data.url ?? "",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_EVENTSOURCE_CHANNEL_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          url: data.url,
        },
      });

      return { success: true };
    },

    async handleFontFingerprint(
      data: { callCount?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertFontFingerprint({
        domain: pageDomain,
        callCount: data.callCount ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_FONT_FINGERPRINT_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          callCount: data.callCount,
        },
      });

      return { success: true };
    },

    async handleIdleCallbackTiming(
      data: { callCount?: number; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertIdleCallbackTiming({
        domain: pageDomain,
        callCount: data.callCount ?? 0,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_IDLE_CALLBACK_TIMING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          callCount: data.callCount,
        },
      });

      return { success: true };
    },

    async handleClipboardEventSniffing(
      data: { eventType?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertClipboardEventSniffing({
        domain: pageDomain,
        eventType: data.eventType ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_CLIPBOARD_EVENT_SNIFFING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          eventType: data.eventType,
        },
      });

      return { success: true };
    },

    async handleDragEventSniffing(
      data: { eventType?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertDragEventSniffing({
        domain: pageDomain,
        eventType: data.eventType ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_DRAG_EVENT_SNIFFING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          eventType: data.eventType,
        },
      });

      return { success: true };
    },

    async handleSelectionSniffing(
      data: { eventType?: string; timestamp?: number; pageUrl?: string; source?: string },
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl || "", deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl || "");

      await deps.getAlertManager().alertSelectionSniffing({
        domain: pageDomain,
        eventType: data.eventType ?? "unknown",
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_SELECTION_SNIFFING_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
          eventType: data.eventType,
        },
      });

      return { success: true };
    },

    async handleOpenRedirect(
      data: OpenRedirectData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const pageUrl = resolvePageUrl(sender, data.pageUrl);

      await deps.getAlertManager().alertOpenRedirect({
        domain: pageDomain,
        redirectUrl: data.redirectUrl,
        parameterName: data.parameterName,
        isExternal: data.isExternal,
      }, pageUrl);

      deps.logger.warn({
        event: "SECURITY_OPEN_REDIRECT_DETECTED",
        data: {
          source: sourceLabel(data.source),
          from: pageDomain,
          redirectUrl: data.redirectUrl,
          parameterName: data.parameterName,
          isExternal: data.isExternal,
        },
      });

      return { success: true };
    },
  };
}
