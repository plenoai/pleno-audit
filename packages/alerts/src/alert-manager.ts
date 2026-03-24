/**
 * @fileoverview Alert Manager
 *
 * Manages security alerts, notifications, and alert lifecycle.
 */

import type {
  SecurityAlert,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AlertConfig,
  AlertRule,
  AlertAction,
} from "./types.js";
import type {
  CreateAlertInput,
  NRDAlertParams,
  TyposquatAlertParams,
  CSPViolationAlertParams,
  AISensitiveAlertParams,
  ShadowAIAlertParams,
  ExtensionAlertParams,
  DataExfiltrationAlertParams,
  CredentialTheftAlertParams,
  SupplyChainRiskAlertParams,
  ComplianceAlertParams,
  PolicyViolationAlertParams,
  TrackingBeaconAlertParams,
  ClipboardHijackAlertParams,
  CookieAccessAlertParams,
  XSSInjectionAlertParams,
  DOMScrapingAlertParams,
  SuspiciousDownloadAlertParams,
  CanvasFingerprintAlertParams,
  WebGLFingerprintAlertParams,
  AudioFingerprintAlertParams,
  DynamicCodeExecutionAlertParams,
  FullscreenPhishingAlertParams,
  ClipboardReadAlertParams,
  GeolocationAccessAlertParams,
  WebSocketConnectionAlertParams,
  WebRTCConnectionAlertParams,
  BroadcastChannelAlertParams,
  SendBeaconAlertParams,
  MediaCaptureAlertParams,
  NotificationPhishingAlertParams,
  CredentialAPIAlertParams,
  DeviceSensorAlertParams,
  DeviceEnumerationAlertParams,
  StorageExfiltrationAlertParams,
  PrototypePollutionAlertParams,
  DNSPrefetchLeakAlertParams,
  FormHijackAlertParams,
  CSSKeyloggingAlertParams,
  PerformanceObserverAlertParams,
  PostMessageExfilAlertParams,
  DOMClobberingAlertParams,
  CacheAPIAbuseAlertParams,
  FetchExfiltrationAlertParams,
  WASMExecutionAlertParams,
  IntersectionObserverAlertParams,
  IndexedDBAbuseAlertParams,
  HistoryManipulationAlertParams,
  MessageChannelAlertParams,
  ResizeObserverAlertParams,
  ExecCommandClipboardAlertParams,
  EventSourceChannelAlertParams,
  FontFingerprintAlertParams,
  IdleCallbackTimingAlertParams,
  ClipboardEventSniffingAlertParams,
  DragEventSniffingAlertParams,
  SelectionSniffingAlertParams,
} from "./alert-builders.js";
import {
  buildNRDAlert,
  buildTyposquatAlert,
  buildCSPViolationAlert,
  buildAISensitiveAlert,
  buildShadowAIAlert,
  buildExtensionAlert,
  buildDataExfiltrationAlert,
  buildCredentialTheftAlert,
  buildSupplyChainRiskAlert,
  buildComplianceAlert,
  buildPolicyViolationAlert,
  buildTrackingBeaconAlert,
  buildClipboardHijackAlert,
  buildCookieAccessAlert,
  buildXSSInjectionAlert,
  buildDOMScrapingAlert,
  buildSuspiciousDownloadAlert,
  buildCanvasFingerprintAlert,
  buildWebGLFingerprintAlert,
  buildAudioFingerprintAlert,
  buildDynamicCodeExecutionAlert,
  buildFullscreenPhishingAlert,
  buildClipboardReadAlert,
  buildGeolocationAccessAlert,
  buildWebSocketConnectionAlert,
  buildWebRTCConnectionAlert,
  buildBroadcastChannelAlert,
  buildSendBeaconAlert,
  buildMediaCaptureAlert,
  buildNotificationPhishingAlert,
  buildCredentialAPIAlert,
  buildDeviceSensorAlert,
  buildDeviceEnumerationAlert,
  buildStorageExfiltrationAlert,
  buildPrototypePollutionAlert,
  buildDNSPrefetchLeakAlert,
  buildFormHijackAlert,
  buildCSSKeyloggingAlert,
  buildPerformanceObserverAlert,
  buildPostMessageExfilAlert,
  buildDOMClobberingAlert,
  buildCacheAPIAbuseAlert,
  buildFetchExfiltrationAlert,
  buildWASMExecutionAlert,
  buildIntersectionObserverAlert,
  buildIndexedDBAbuseAlert,
  buildHistoryManipulationAlert,
  buildMessageChannelAlert,
  buildResizeObserverAlert,
  buildExecCommandClipboardAlert,
  buildEventSourceChannelAlert,
  buildFontFingerprintAlert,
  buildIdleCallbackTimingAlert,
  buildClipboardEventSniffingAlert,
  buildDragEventSniffingAlert,
  buildSelectionSniffingAlert,
} from "./alert-builders.js";

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Alert store interface
 */
export interface AlertStore {
  getAlerts(options?: { limit?: number; status?: AlertStatus[] }): Promise<SecurityAlert[]>;
  addAlert(alert: SecurityAlert): Promise<void>;
  updateAlert(id: string, updates: Partial<SecurityAlert>): Promise<void>;
  deleteAlert(id: string): Promise<void>;
  getAlertCount(status?: AlertStatus[]): Promise<number>;
}

/**
 * In-memory alert store
 */
export function createInMemoryAlertStore(): AlertStore {
  const alerts: Map<string, SecurityAlert> = new Map();

  return {
    async getAlerts(options) {
      let result = Array.from(alerts.values());

      if (options?.status) {
        result = result.filter((a) => options.status!.includes(a.status));
      }

      result.sort((a, b) => b.timestamp - a.timestamp);

      if (options?.limit) {
        result = result.slice(0, options.limit);
      }

      return result;
    },

    async addAlert(alert) {
      alerts.set(alert.id, alert);
    },

    async updateAlert(id, updates) {
      const alert = alerts.get(id);
      if (alert) {
        alerts.set(id, { ...alert, ...updates });
      }
    },

    async deleteAlert(id) {
      alerts.delete(id);
    },

    async getAlertCount(status) {
      if (!status) return alerts.size;
      return Array.from(alerts.values()).filter((a) => status.includes(a.status)).length;
    },
  };
}

/**
 * Alert event listener
 */
export type AlertListener = (alert: SecurityAlert) => void;

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "nrd-high",
    name: "High confidence NRD",
    enabled: true,
    category: "nrd",
    condition: { type: "always" },
    severity: "high",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
  {
    id: "typosquat-high",
    name: "High confidence typosquat",
    enabled: true,
    category: "typosquat",
    condition: { type: "always" },
    severity: "critical",
    actions: [
      { id: "report", label: "報告", type: "report" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
];

/**
 * Create alert manager
 */
export function createAlertManager(
  config: AlertConfig = {
    enabled: true,
    showNotifications: true,
    playSound: false,
    rules: [],
  },
  store?: AlertStore
) {
  const alertStore = store || createInMemoryAlertStore();
  const listeners: Set<AlertListener> = new Set();
  const rules: Map<string, AlertRule> = new Map();

  // Dedup: track (category, domain) → alertId for merging duplicate alerts
  const DEDUP_WINDOW_MS = 60_000; // 1 minute window
  const dedupMap = new Map<string, { alertId: string; timestamp: number }>();

  for (const rule of [...DEFAULT_RULES, ...config.rules]) {
    rules.set(rule.id, rule);
  }

  function getDefaultActions(category: AlertCategory): AlertAction[] {
    const rule = Array.from(rules.values()).find(
      (currentRule) => currentRule.category === category && currentRule.enabled
    );

    return (
      rule?.actions || [
        { id: "investigate", label: "調査", type: "investigate" },
        { id: "dismiss", label: "無視", type: "dismiss" },
      ]
    );
  }

  function shouldCreateAlert(_severity: AlertSeverity): boolean {
    return config.enabled;
  }

  function notifyListeners(alert: SecurityAlert): void {
    for (const listener of listeners) {
      try {
        listener(alert);
      } catch {
        // Ignore listener errors
      }
    }
  }

  async function createAlert(params: CreateAlertInput): Promise<SecurityAlert | null> {
    if (!shouldCreateAlert(params.severity)) {
      return null;
    }

    // Dedup: merge alerts with same (category, domain, title) within the time window
    const dedupKey = `${params.category}::${params.domain}::${params.title}`;
    const now = Date.now();
    const existing = dedupMap.get(dedupKey);

    if (existing && now - existing.timestamp < DEDUP_WINDOW_MS) {
      // Increment count on existing alert instead of creating a new one
      const existingAlerts = await alertStore.getAlerts();
      const existingAlert = existingAlerts.find((a) => a.id === existing.alertId);
      if (existingAlert) {
        const newCount = (existingAlert.count ?? 1) + 1;
        await alertStore.updateAlert(existing.alertId, {
          count: newCount,
          timestamp: now, // Update timestamp to latest occurrence
        });
        existing.timestamp = now; // Extend the dedup window
        return existingAlert;
      }
    }

    const alert: SecurityAlert = {
      id: generateAlertId(),
      category: params.category,
      severity: params.severity,
      status: "new",
      title: params.title,
      description: params.description,
      domain: params.domain,
      timestamp: now,
      details: params.details,
      actions: params.actions || getDefaultActions(params.category),
      count: 1,
    };

    await alertStore.addAlert(alert);
    dedupMap.set(dedupKey, { alertId: alert.id, timestamp: now });
    notifyListeners(alert);

    return alert;
  }

  async function createOptionalAlert(
    alertInput: CreateAlertInput | null
  ): Promise<SecurityAlert | null> {
    if (!alertInput) {
      return null;
    }

    return createAlert(alertInput);
  }

  async function alertNRD(params: NRDAlertParams): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildNRDAlert(params));
  }

  async function alertTyposquat(
    params: TyposquatAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildTyposquatAlert(params));
  }

  async function alertCSPViolation(
    params: CSPViolationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCSPViolationAlert(params));
  }

  async function alertAISensitive(
    params: AISensitiveAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildAISensitiveAlert(params));
  }

  async function alertShadowAI(
    params: ShadowAIAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildShadowAIAlert(params));
  }

  async function alertExtension(
    params: ExtensionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildExtensionAlert(params));
  }

  async function alertDataExfiltration(
    params: DataExfiltrationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDataExfiltrationAlert(params));
  }

  async function alertCredentialTheft(
    params: CredentialTheftAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCredentialTheftAlert(params));
  }

  async function alertSupplyChainRisk(
    params: SupplyChainRiskAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSupplyChainRiskAlert(params));
  }

  async function alertCompliance(
    params: ComplianceAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildComplianceAlert(params));
  }

  async function alertPolicyViolation(
    params: PolicyViolationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPolicyViolationAlert(params));
  }

  async function alertTrackingBeacon(
    params: TrackingBeaconAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildTrackingBeaconAlert(params));
  }

  async function alertClipboardHijack(
    params: ClipboardHijackAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardHijackAlert(params));
  }

  async function alertCookieAccess(
    params: CookieAccessAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCookieAccessAlert(params));
  }

  async function alertXSSInjection(
    params: XSSInjectionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildXSSInjectionAlert(params));
  }

  async function alertDOMScraping(
    params: DOMScrapingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDOMScrapingAlert(params));
  }

  async function alertSuspiciousDownload(
    params: SuspiciousDownloadAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSuspiciousDownloadAlert(params));
  }

  async function alertCanvasFingerprint(
    params: CanvasFingerprintAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCanvasFingerprintAlert(params));
  }

  async function alertWebGLFingerprint(
    params: WebGLFingerprintAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebGLFingerprintAlert(params));
  }

  async function alertAudioFingerprint(
    params: AudioFingerprintAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildAudioFingerprintAlert(params));
  }

  async function alertDynamicCodeExecution(
    params: DynamicCodeExecutionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDynamicCodeExecutionAlert(params));
  }

  async function alertFullscreenPhishing(
    params: FullscreenPhishingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFullscreenPhishingAlert(params));
  }

  async function alertClipboardRead(
    params: ClipboardReadAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardReadAlert(params));
  }

  async function alertGeolocationAccess(
    params: GeolocationAccessAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildGeolocationAccessAlert(params));
  }

  async function alertWebSocketConnection(
    params: WebSocketConnectionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebSocketConnectionAlert(params));
  }

  async function alertWebRTCConnection(
    params: WebRTCConnectionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebRTCConnectionAlert(params));
  }

  async function alertBroadcastChannel(
    params: BroadcastChannelAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildBroadcastChannelAlert(params));
  }

  async function alertSendBeacon(
    params: SendBeaconAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSendBeaconAlert(params));
  }

  async function alertMediaCapture(
    params: MediaCaptureAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildMediaCaptureAlert(params));
  }

  async function alertNotificationPhishing(
    params: NotificationPhishingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildNotificationPhishingAlert(params));
  }

  async function alertCredentialAPI(
    params: CredentialAPIAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCredentialAPIAlert(params));
  }

  async function alertDeviceSensor(
    params: DeviceSensorAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDeviceSensorAlert(params));
  }

  async function alertDeviceEnumeration(
    params: DeviceEnumerationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDeviceEnumerationAlert(params));
  }

  async function alertStorageExfiltration(
    params: StorageExfiltrationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildStorageExfiltrationAlert(params));
  }

  async function alertPrototypePollution(
    params: PrototypePollutionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPrototypePollutionAlert(params));
  }

  async function alertDNSPrefetchLeak(
    params: DNSPrefetchLeakAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDNSPrefetchLeakAlert(params));
  }

  async function alertFormHijack(
    params: FormHijackAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFormHijackAlert(params));
  }

  async function alertCSSKeylogging(
    params: CSSKeyloggingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCSSKeyloggingAlert(params));
  }

  async function alertPerformanceObserver(
    params: PerformanceObserverAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPerformanceObserverAlert(params));
  }

  async function alertPostMessageExfil(
    params: PostMessageExfilAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPostMessageExfilAlert(params));
  }

  async function alertDOMClobbering(
    params: DOMClobberingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDOMClobberingAlert(params));
  }

  async function alertCacheAPIAbuse(
    params: CacheAPIAbuseAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCacheAPIAbuseAlert(params));
  }

  async function alertFetchExfiltration(
    params: FetchExfiltrationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFetchExfiltrationAlert(params));
  }

  async function alertWASMExecution(
    params: WASMExecutionAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWASMExecutionAlert(params));
  }

  async function alertIntersectionObserver(
    params: IntersectionObserverAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIntersectionObserverAlert(params));
  }

  async function alertIndexedDBAbuse(
    params: IndexedDBAbuseAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIndexedDBAbuseAlert(params));
  }

  async function alertHistoryManipulation(
    params: HistoryManipulationAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildHistoryManipulationAlert(params));
  }

  async function alertMessageChannel(
    params: MessageChannelAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildMessageChannelAlert(params));
  }

  async function alertResizeObserver(
    params: ResizeObserverAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildResizeObserverAlert(params));
  }

  async function alertExecCommandClipboard(
    params: ExecCommandClipboardAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildExecCommandClipboardAlert(params));
  }

  async function alertEventSourceChannel(
    params: EventSourceChannelAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildEventSourceChannelAlert(params));
  }

  async function alertFontFingerprint(
    params: FontFingerprintAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFontFingerprintAlert(params));
  }

  async function alertIdleCallbackTiming(
    params: IdleCallbackTimingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIdleCallbackTimingAlert(params));
  }

  async function alertClipboardEventSniffing(
    params: ClipboardEventSniffingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardEventSniffingAlert(params));
  }

  async function alertDragEventSniffing(
    params: DragEventSniffingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDragEventSniffingAlert(params));
  }

  async function alertSelectionSniffing(
    params: SelectionSniffingAlertParams
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSelectionSniffingAlert(params));
  }

  async function updateAlertStatus(
    alertId: string,
    status: AlertStatus
  ): Promise<void> {
    await alertStore.updateAlert(alertId, { status });
  }

  async function getAlerts(options?: {
    limit?: number;
    status?: AlertStatus[];
  }): Promise<SecurityAlert[]> {
    return alertStore.getAlerts(options);
  }

  async function getAlertCount(status?: AlertStatus[]): Promise<number> {
    return alertStore.getAlertCount(status);
  }

  function subscribe(listener: AlertListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function acknowledgeAll(): Promise<void> {
    const newAlerts = await alertStore.getAlerts({ status: ["new"] });

    for (const alert of newAlerts) {
      await alertStore.updateAlert(alert.id, { status: "acknowledged" });
    }
  }

  async function clearResolved(): Promise<void> {
    const resolvedAlerts = await alertStore.getAlerts({
      status: ["resolved", "dismissed"],
    });

    for (const alert of resolvedAlerts) {
      await alertStore.deleteAlert(alert.id);
    }
  }

  return {
    createAlert,
    alertNRD,
    alertTyposquat,
    alertCSPViolation,
    alertAISensitive,
    alertShadowAI,
    alertExtension,
    alertDataExfiltration,
    alertCredentialTheft,
    alertSupplyChainRisk,
    alertCompliance,
    alertPolicyViolation,
    alertTrackingBeacon,
    alertClipboardHijack,
    alertCookieAccess,
    alertXSSInjection,
    alertDOMScraping,
    alertSuspiciousDownload,
    alertCanvasFingerprint,
    alertWebGLFingerprint,
    alertAudioFingerprint,
    alertDynamicCodeExecution,
    alertFullscreenPhishing,
    alertClipboardRead,
    alertGeolocationAccess,
    alertWebSocketConnection,
    alertWebRTCConnection,
    alertBroadcastChannel,
    alertSendBeacon,
    alertMediaCapture,
    alertNotificationPhishing,
    alertCredentialAPI,
    alertDeviceSensor,
    alertDeviceEnumeration,
    alertStorageExfiltration,
    alertPrototypePollution,
    alertDNSPrefetchLeak,
    alertFormHijack,
    alertCSSKeylogging,
    alertPerformanceObserver,
    alertPostMessageExfil,
    alertDOMClobbering,
    alertCacheAPIAbuse,
    alertFetchExfiltration,
    alertWASMExecution,
    alertIntersectionObserver,
    alertIndexedDBAbuse,
    alertHistoryManipulation,
    alertMessageChannel,
    alertResizeObserver,
    alertExecCommandClipboard,
    alertEventSourceChannel,
    alertFontFingerprint,
    alertIdleCallbackTiming,
    alertClipboardEventSniffing,
    alertDragEventSniffing,
    alertSelectionSniffing,
    updateAlertStatus,
    getAlerts,
    getAlertCount,
    subscribe,
    acknowledgeAll,
    clearResolved,
  };
}

export type AlertManager = ReturnType<typeof createAlertManager>;
