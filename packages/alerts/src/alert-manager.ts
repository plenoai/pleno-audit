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
} from "./alert-builders.js";
import {
  buildNRDAlert,
  buildTyposquatAlert,
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
      { id: "block", label: "ブロック", type: "block" },
      { id: "report", label: "報告", type: "report" },
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
    severityFilter: ["critical", "high"],
  },
  store?: AlertStore
) {
  const alertStore = store || createInMemoryAlertStore();
  const listeners: Set<AlertListener> = new Set();
  const rules: Map<string, AlertRule> = new Map();

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

  function shouldCreateAlert(severity: AlertSeverity): boolean {
    if (!config.enabled) {
      return false;
    }

    const severityOrder: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];
    const minSeverityIndex = Math.min(
      ...config.severityFilter.map((severityFilterItem) =>
        severityOrder.indexOf(severityFilterItem)
      )
    );
    const alertSeverityIndex = severityOrder.indexOf(severity);

    return alertSeverityIndex <= minSeverityIndex;
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

    const alert: SecurityAlert = {
      id: generateAlertId(),
      category: params.category,
      severity: params.severity,
      status: "new",
      title: params.title,
      description: params.description,
      domain: params.domain,
      timestamp: Date.now(),
      details: params.details,
      actions: params.actions || getDefaultActions(params.category),
    };

    await alertStore.addAlert(alert);
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
    updateAlertStatus,
    getAlerts,
    getAlertCount,
    subscribe,
    acknowledgeAll,
    clearResolved,
  };
}

export type AlertManager = ReturnType<typeof createAlertManager>;
