import type { AlertManager } from "@libztbs/alerts";

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

export interface CookieAccessData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  readCount: number;
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

interface SecurityEventHandlerDependencies {
  getAlertManager: () => AlertManager;
  extractDomainFromUrl: (url: string) => string;
  checkDataTransferPolicy: (params: {
    destination: string;
    sizeKB: number;
  }) => Promise<void>;
  logger: LoggerLike;
}

function resolvePageDomain(
  sender: chrome.runtime.MessageSender,
  pageUrl: string,
  extractDomainFromUrl: (url: string) => string,
): string {
  return extractDomainFromUrl(sender.tab?.url || pageUrl);
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

      await deps.getAlertManager().alertDataExfiltration({
        sourceDomain: pageDomain,
        targetDomain: data.targetDomain,
        bodySize: data.bodySize,
        method: data.method,
        initiator: data.initiator,
      });

      deps.logger.warn({
        event: "SECURITY_DATA_EXFILTRATION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          from: pageDomain,
          to: data.targetDomain,
          sizeKB: Math.round(data.bodySize / 1024),
          method: data.method,
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

      if (data.risks.length > 0) {
        await deps.getAlertManager().alertCredentialTheft({
          sourceDomain: pageDomain,
          targetDomain: data.targetDomain,
          formAction: data.formAction,
          isSecure: data.isSecure,
          isCrossOrigin: data.isCrossOrigin,
          fieldType: data.fieldType,
          risks: data.risks,
        });

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

      await deps.getAlertManager().alertSupplyChainRisk({
        pageDomain,
        resourceUrl: data.url,
        resourceDomain,
        resourceType: data.resourceType,
        hasIntegrity: data.hasIntegrity,
        hasCrossorigin: data.hasCrossorigin,
        isCDN: data.isCDN,
        risks: data.risks,
      });

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

      await deps.getAlertManager().alertTrackingBeacon({
        sourceDomain: pageDomain,
        targetDomain: data.targetDomain,
        url: data.url,
        bodySize: data.bodySize,
        initiator: data.initiator,
      });

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

      await deps.getAlertManager().alertClipboardHijack({
        domain: pageDomain,
        cryptoType: data.cryptoType,
        textPreview: data.text,
      });

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

    async handleCookieAccess(
      data: CookieAccessData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);

      await deps.getAlertManager().alertCookieAccess({
        domain: pageDomain,
        readCount: data.readCount,
      });

      deps.logger.debug({
        event: "SECURITY_COOKIE_ACCESS_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },

    async handleXSSDetected(
      data: XSSDetectedData,
      sender: chrome.runtime.MessageSender,
    ): Promise<{ success: boolean }> {
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);

      await deps.getAlertManager().alertXSSInjection({
        domain: pageDomain,
        injectionType: data.type,
        payloadPreview: data.payloadPreview,
      });

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

      await deps.getAlertManager().alertDOMScraping({
        domain: pageDomain,
        selector: data.selector,
        callCount: data.callCount,
      });

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

      await deps.getAlertManager().alertSuspiciousDownload({
        domain: pageDomain,
        downloadType: data.type,
        filename: data.filename,
        extension: data.extension,
        size: data.size,
        mimeType: data.mimeType,
      });

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

      await deps.getAlertManager().alertCanvasFingerprint({
        domain: pageDomain,
        callCount: data.callCount ?? 0,
        canvasWidth: data.canvasWidth ?? 0,
        canvasHeight: data.canvasHeight ?? 0,
      });

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

      await deps.getAlertManager().alertWebGLFingerprint({
        domain: pageDomain,
        parameter: data.parameter ?? 0,
      });

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

      await deps.getAlertManager().alertAudioFingerprint({
        domain: pageDomain,
        contextCount: data.contextCount ?? 0,
        sampleRate: data.sampleRate,
      });

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

      deps.logger.warn({
        event: "SECURITY_WEBRTC_CONNECTION_DETECTED",
        data: {
          source: sourceLabel(data.source),
          domain: pageDomain,
        },
      });

      return { success: true };
    },
  };
}
