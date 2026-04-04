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

  PolicyViolationAlertParams,
  TrackingBeaconAlertParams,
  ClipboardHijackAlertParams,
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
  OpenRedirectAlertParams,
  DLPPIIDetectedAlertParams,
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

  buildPolicyViolationAlert,
  buildTrackingBeaconAlert,
  buildClipboardHijackAlert,
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
  buildOpenRedirectAlert,
  buildDLPPIIDetectedAlert,
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
 * Persistent alert store options
 */
export interface PersistentAlertStoreOptions {
  maxAlerts?: number;
  load: () => Promise<SecurityAlert[]>;
  save: (alerts: SecurityAlert[]) => Promise<void>;
}

const DEFAULT_MAX_ALERTS = 500;

/**
 * Persistent alert store backed by chrome.storage.local
 *
 * Keeps an in-memory Map for fast reads and persists to storage on writes.
 * Enforces a max alert count, evicting oldest alerts first.
 */
export function createPersistentAlertStore(
  options: PersistentAlertStoreOptions,
): AlertStore {
  const { load, save, maxAlerts = DEFAULT_MAX_ALERTS } = options;
  const alerts: Map<string, SecurityAlert> = new Map();
  let initialized = false;
  let pendingSave: ReturnType<typeof setTimeout> | null = null;

  async function ensureLoaded(): Promise<void> {
    if (initialized) return;
    const stored = await load();
    for (const alert of stored) {
      alerts.set(alert.id, alert);
    }
    initialized = true;
  }

  function scheduleSave(): void {
    if (pendingSave !== null) return;
    pendingSave = setTimeout(() => {
      pendingSave = null;
      const all = Array.from(alerts.values());
      all.sort((a, b) => b.timestamp - a.timestamp);
      void save(all);
    }, 1000);
  }

  function evictOldest(): void {
    if (alerts.size <= maxAlerts) return;
    const sorted = Array.from(alerts.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    const toRemove = sorted.slice(0, alerts.size - maxAlerts);
    for (const alert of toRemove) {
      alerts.delete(alert.id);
    }
  }

  return {
    async getAlerts(options) {
      await ensureLoaded();
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
      await ensureLoaded();
      alerts.set(alert.id, alert);
      evictOldest();
      scheduleSave();
    },

    async updateAlert(id, updates) {
      await ensureLoaded();
      const alert = alerts.get(id);
      if (alert) {
        alerts.set(id, { ...alert, ...updates });
        scheduleSave();
      }
    },

    async deleteAlert(id) {
      await ensureLoaded();
      alerts.delete(id);
      scheduleSave();
    },

    async getAlertCount(status) {
      await ensureLoaded();
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
  const disabledCategories = new Set<string>();

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

  function shouldCreateAlert(category: string, _severity: AlertSeverity): boolean {
    if (!config.enabled) return false;
    if (disabledCategories.has(category)) return false;
    return true;
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
    if (!shouldCreateAlert(params.category, params.severity)) {
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
      url: params.url,
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
    alertInput: CreateAlertInput | null,
    url?: string,
  ): Promise<SecurityAlert | null> {
    if (!alertInput) {
      return null;
    }
    if (url) {
      alertInput.url = url;
    }
    return createAlert(alertInput);
  }

  async function alertNRD(params: NRDAlertParams, url?: string): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildNRDAlert(params), url);
  }

  async function alertTyposquat(
    params: TyposquatAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildTyposquatAlert(params), url);
  }

  async function alertCSPViolation(
    params: CSPViolationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCSPViolationAlert(params), url);
  }

  async function alertAISensitive(
    params: AISensitiveAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildAISensitiveAlert(params), url);
  }

  async function alertShadowAI(
    params: ShadowAIAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildShadowAIAlert(params), url);
  }

  async function alertExtension(
    params: ExtensionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildExtensionAlert(params), url);
  }

  async function alertDataExfiltration(
    params: DataExfiltrationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDataExfiltrationAlert(params), url);
  }

  async function alertCredentialTheft(
    params: CredentialTheftAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCredentialTheftAlert(params), url);
  }

  async function alertSupplyChainRisk(
    params: SupplyChainRiskAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSupplyChainRiskAlert(params), url);
  }

  async function alertPolicyViolation(
    params: PolicyViolationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPolicyViolationAlert(params), url);
  }

  async function alertTrackingBeacon(
    params: TrackingBeaconAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildTrackingBeaconAlert(params), url);
  }

  async function alertClipboardHijack(
    params: ClipboardHijackAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardHijackAlert(params), url);
  }

  async function alertXSSInjection(
    params: XSSInjectionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildXSSInjectionAlert(params), url);
  }

  async function alertDOMScraping(
    params: DOMScrapingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDOMScrapingAlert(params), url);
  }

  async function alertSuspiciousDownload(
    params: SuspiciousDownloadAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSuspiciousDownloadAlert(params), url);
  }

  async function alertCanvasFingerprint(
    params: CanvasFingerprintAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCanvasFingerprintAlert(params), url);
  }

  async function alertWebGLFingerprint(
    params: WebGLFingerprintAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebGLFingerprintAlert(params), url);
  }

  async function alertAudioFingerprint(
    params: AudioFingerprintAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildAudioFingerprintAlert(params), url);
  }

  async function alertDynamicCodeExecution(
    params: DynamicCodeExecutionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDynamicCodeExecutionAlert(params), url);
  }

  async function alertFullscreenPhishing(
    params: FullscreenPhishingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFullscreenPhishingAlert(params), url);
  }

  async function alertClipboardRead(
    params: ClipboardReadAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardReadAlert(params), url);
  }

  async function alertGeolocationAccess(
    params: GeolocationAccessAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildGeolocationAccessAlert(params), url);
  }

  async function alertWebSocketConnection(
    params: WebSocketConnectionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebSocketConnectionAlert(params), url);
  }

  async function alertWebRTCConnection(
    params: WebRTCConnectionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWebRTCConnectionAlert(params), url);
  }

  async function alertBroadcastChannel(
    params: BroadcastChannelAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildBroadcastChannelAlert(params), url);
  }

  async function alertSendBeacon(
    params: SendBeaconAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSendBeaconAlert(params), url);
  }

  async function alertMediaCapture(
    params: MediaCaptureAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildMediaCaptureAlert(params), url);
  }

  async function alertNotificationPhishing(
    params: NotificationPhishingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildNotificationPhishingAlert(params), url);
  }

  async function alertCredentialAPI(
    params: CredentialAPIAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCredentialAPIAlert(params), url);
  }

  async function alertDeviceSensor(
    params: DeviceSensorAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDeviceSensorAlert(params), url);
  }

  async function alertDeviceEnumeration(
    params: DeviceEnumerationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDeviceEnumerationAlert(params), url);
  }

  async function alertStorageExfiltration(
    params: StorageExfiltrationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildStorageExfiltrationAlert(params), url);
  }

  async function alertPrototypePollution(
    params: PrototypePollutionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPrototypePollutionAlert(params), url);
  }

  async function alertDNSPrefetchLeak(
    params: DNSPrefetchLeakAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDNSPrefetchLeakAlert(params), url);
  }

  async function alertFormHijack(
    params: FormHijackAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFormHijackAlert(params), url);
  }

  async function alertCSSKeylogging(
    params: CSSKeyloggingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCSSKeyloggingAlert(params), url);
  }

  async function alertPerformanceObserver(
    params: PerformanceObserverAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPerformanceObserverAlert(params), url);
  }

  async function alertPostMessageExfil(
    params: PostMessageExfilAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildPostMessageExfilAlert(params), url);
  }

  async function alertDOMClobbering(
    params: DOMClobberingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDOMClobberingAlert(params), url);
  }

  async function alertCacheAPIAbuse(
    params: CacheAPIAbuseAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildCacheAPIAbuseAlert(params), url);
  }

  async function alertFetchExfiltration(
    params: FetchExfiltrationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFetchExfiltrationAlert(params), url);
  }

  async function alertWASMExecution(
    params: WASMExecutionAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildWASMExecutionAlert(params), url);
  }

  async function alertIntersectionObserver(
    params: IntersectionObserverAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIntersectionObserverAlert(params), url);
  }

  async function alertIndexedDBAbuse(
    params: IndexedDBAbuseAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIndexedDBAbuseAlert(params), url);
  }

  async function alertHistoryManipulation(
    params: HistoryManipulationAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildHistoryManipulationAlert(params), url);
  }

  async function alertMessageChannel(
    params: MessageChannelAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildMessageChannelAlert(params), url);
  }

  async function alertResizeObserver(
    params: ResizeObserverAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildResizeObserverAlert(params), url);
  }

  async function alertExecCommandClipboard(
    params: ExecCommandClipboardAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildExecCommandClipboardAlert(params), url);
  }

  async function alertEventSourceChannel(
    params: EventSourceChannelAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildEventSourceChannelAlert(params), url);
  }

  async function alertFontFingerprint(
    params: FontFingerprintAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildFontFingerprintAlert(params), url);
  }

  async function alertIdleCallbackTiming(
    params: IdleCallbackTimingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildIdleCallbackTimingAlert(params), url);
  }

  async function alertClipboardEventSniffing(
    params: ClipboardEventSniffingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildClipboardEventSniffingAlert(params), url);
  }

  async function alertDragEventSniffing(
    params: DragEventSniffingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDragEventSniffingAlert(params), url);
  }

  async function alertSelectionSniffing(
    params: SelectionSniffingAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildSelectionSniffingAlert(params), url);
  }

  async function alertOpenRedirect(
    params: OpenRedirectAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildOpenRedirectAlert(params), url);
  }

  async function alertDLPPIIDetected(
    params: DLPPIIDetectedAlertParams, url?: string,
  ): Promise<SecurityAlert | null> {
    return createOptionalAlert(buildDLPPIIDetectedAlert(params), url);
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
    alertPolicyViolation,
    alertTrackingBeacon,
    alertClipboardHijack,
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
    alertOpenRedirect,
    alertDLPPIIDetected,
    updateAlertStatus,
    getAlerts,
    getAlertCount,
    subscribe,
    acknowledgeAll,
    clearResolved,
    setDisabledCategories,
    getDisabledCategories,
  };

  function setDisabledCategories(categories: string[]): void {
    disabledCategories.clear();
    for (const cat of categories) {
      disabledCategories.add(cat);
    }
  }

  function getDisabledCategories(): string[] {
    return Array.from(disabledCategories);
  }
}

export type AlertManager = ReturnType<typeof createAlertManager>;
