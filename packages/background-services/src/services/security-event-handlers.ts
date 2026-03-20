import type { AlertManager } from "@pleno-audit/alerts";
import { resolveEventTimestamp } from "./event-timestamp.js";

interface LoggerLike {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

interface AuditEventInput {
  type: string;
  domain: string;
  timestamp: number;
  details: Record<string, unknown>;
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
  addEvent: (event: AuditEventInput) => Promise<unknown>;
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
      const targetUrl = data.targetUrl || data.url || "";
      const pageDomain = resolvePageDomain(sender, data.pageUrl, deps.extractDomainFromUrl);
      const eventTimestamp = resolveEventTimestamp(data.timestamp);

      await deps.addEvent({
        type: "data_exfiltration_detected",
        domain: data.targetDomain,
        timestamp: eventTimestamp,
        details: {
          targetUrl,
          targetDomain: data.targetDomain,
          method: data.method,
          bodySize: data.bodySize,
          initiator: data.initiator,
          pageUrl: data.pageUrl,
          sensitiveDataTypes: data.sensitiveDataTypes ?? [],
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "credential_theft_risk",
      });

      await deps.addEvent({
        type: "credential_theft_risk",
        domain: data.targetDomain,
        timestamp: eventTimestamp,
        details: {
          formAction: data.formAction,
          targetDomain: data.targetDomain,
          method: data.method,
          isSecure: data.isSecure,
          isCrossOrigin: data.isCrossOrigin,
          fieldType: data.fieldType,
          risks: data.risks,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "supply_chain_risk",
      });

      await deps.addEvent({
        type: "supply_chain_risk",
        domain: resourceDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          resourceType: data.resourceType,
          hasIntegrity: data.hasIntegrity,
          hasCrossorigin: data.hasCrossorigin,
          isCDN: data.isCDN,
          risks: data.risks,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "tracking_beacon_detected",
      });

      await deps.addEvent({
        type: "tracking_beacon_detected",
        domain: data.targetDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          targetDomain: data.targetDomain,
          bodySize: data.bodySize,
          initiator: data.initiator,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "clipboard_hijack_detected",
      });

      await deps.addEvent({
        type: "clipboard_hijack_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          text: data.text,
          cryptoType: data.cryptoType,
          fullLength: data.fullLength,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "cookie_access_detected",
      });

      await deps.addEvent({
        type: "cookie_access_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          readCount: data.readCount,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "xss_detected",
      });

      await deps.addEvent({
        type: "xss_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          type: data.type,
          payloadPreview: data.payloadPreview,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "dom_scraping_detected",
      });

      await deps.addEvent({
        type: "dom_scraping_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          selector: data.selector,
          callCount: data.callCount,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "suspicious_download_detected",
      });

      await deps.addEvent({
        type: "suspicious_download_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          type: data.type,
          filename: data.filename,
          extension: data.extension,
          url: data.url,
          size: data.size,
          mimeType: data.mimeType,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "websocket_connection_detected",
      });

      await deps.addEvent({
        type: "websocket_connection_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          hostname: data.hostname,
          isExternal: data.isExternal,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "worker_created",
      });

      await deps.addEvent({
        type: "worker_created",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          isBlobUrl: data.isBlobUrl,
          type: data.type,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "shared_worker_created",
      });

      await deps.addEvent({
        type: "shared_worker_created",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          isBlobUrl: data.isBlobUrl,
          name: data.name,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "service_worker_registered",
      });

      await deps.addEvent({
        type: "service_worker_registered",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          url: data.url,
          scope: data.scope,
          type: data.type,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "dynamic_code_execution_detected",
      });

      await deps.addEvent({
        type: "dynamic_code_execution_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          method: data.method,
          codeLength: data.codeLength,
          codeSample: data.codeSample,
          argCount: data.argCount,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "fullscreen_phishing_detected",
      });

      await deps.addEvent({
        type: "fullscreen_phishing_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          element: data.element,
          elementId: data.elementId,
          className: data.className,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "clipboard_read_detected",
      });

      await deps.addEvent({
        type: "clipboard_read_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "geolocation_accessed",
      });

      await deps.addEvent({
        type: "geolocation_accessed",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          method: data.method,
          highAccuracy: data.highAccuracy,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "canvas_fingerprint_detected",
      });

      await deps.addEvent({
        type: "canvas_fingerprint_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          callCount: data.callCount,
          canvasWidth: data.canvasWidth,
          canvasHeight: data.canvasHeight,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "webgl_fingerprint_detected",
      });

      await deps.addEvent({
        type: "webgl_fingerprint_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          parameter: data.parameter,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "audio_fingerprint_detected",
      });

      await deps.addEvent({
        type: "audio_fingerprint_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          contextCount: data.contextCount,
          sampleRate: data.sampleRate,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.timestamp, {
        logger: deps.logger,
        context: "broadcast_channel_detected",
      });

      await deps.addEvent({
        type: "broadcast_channel_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          channelName: data.channelName,
          blocked: data.blocked,
          pageUrl: data.pageUrl,
        },
      });

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
      const eventTimestamp = resolveEventTimestamp(data.ts || data.timestamp, {
        logger: deps.logger,
        context: "webrtc_connection_detected",
      });

      await deps.addEvent({
        type: "webrtc_connection_detected",
        domain: pageDomain,
        timestamp: eventTimestamp,
        details: {
          pageUrl: data.pageUrl,
        },
      });

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
