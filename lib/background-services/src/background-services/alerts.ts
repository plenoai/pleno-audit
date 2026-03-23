import { DEFAULT_NOTIFICATION_CONFIG, getStorage } from "@libztbs/extension-runtime";
import {
  DEFAULT_POLICY_CONFIG,
  createAlertManager,
  createPolicyManager,
  type AlertManager,
  type PolicyManager,
  type SecurityAlert,
} from "@libztbs/alerts";
import type { BackgroundServiceState } from "./state.js";

type PolicyViolation = ReturnType<PolicyManager["checkDomain"]>["violations"][number];

async function alertPolicyViolations(
  state: BackgroundServiceState,
  domain: string,
  violations: PolicyViolation[]
): Promise<void> {
  if (violations.length === 0) {
    return;
  }
  const am = getAlertManager(state);
  for (const violation of violations) {
    await am.alertPolicyViolation({
      domain,
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      ruleType: violation.ruleType,
      action: violation.action,
      matchedPattern: violation.matchedPattern,
      target: violation.target,
    });
  }
}

export function getAlertManager(state: BackgroundServiceState): AlertManager {
  if (!state.alertManager) {
    state.alertManager = createAlertManager({
      enabled: true,
      showNotifications: true,
      playSound: false,
      rules: [],
      severityFilter: ["critical", "high"],
    });

    state.alertManager.subscribe((alert: SecurityAlert) => {
      void showChromeNotification(state, alert);
    });
  }
  return state.alertManager;
}

export async function getPolicyManager(state: BackgroundServiceState): Promise<PolicyManager> {
  if (!state.policyManager) {
    const storage = await getStorage();
    const config = storage.policyConfig || DEFAULT_POLICY_CONFIG;
    state.policyManager = createPolicyManager(config);
  }
  return state.policyManager;
}

export async function checkDomainPolicy(state: BackgroundServiceState, domain: string): Promise<void> {
  const pm = await getPolicyManager(state);
  const result = pm.checkDomain(domain);
  await alertPolicyViolations(state, domain, result.violations);
}

export async function checkAIServicePolicy(
  state: BackgroundServiceState,
  params: {
    domain: string;
    provider?: string;
    dataTypes?: string[];
  }
): Promise<void> {
  const pm = await getPolicyManager(state);
  const result = pm.checkAIService(params);
  await alertPolicyViolations(state, params.domain, result.violations);
}

export async function checkDataTransferPolicy(
  state: BackgroundServiceState,
  params: {
    destination: string;
    sizeKB: number;
  }
): Promise<void> {
  const pm = await getPolicyManager(state);
  const result = pm.checkDataTransfer(params);
  await alertPolicyViolations(state, params.destination, result.violations);
}

export async function showChromeNotification(state: BackgroundServiceState, alert: SecurityAlert): Promise<void> {
  try {
    const storage = await getStorage();
    const notificationConfig = storage.notificationConfig || DEFAULT_NOTIFICATION_CONFIG;

    if (!notificationConfig.enabled) {
      state.logger?.debug("Notification disabled, skipping:", alert.title);
      return;
    }

    if (!notificationConfig.severityFilter.includes(alert.severity)) {
      state.logger?.debug("Notification filtered by severity:", alert.severity);
      return;
    }

    const iconUrl = alert.severity === "critical" || alert.severity === "high"
      ? "icon-dev-128.png"
      : "icon-128.png";

    await chrome.notifications.create(alert.id, {
      type: "basic",
      iconUrl,
      title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      message: alert.description,
      priority: alert.severity === "critical" ? 2 : alert.severity === "high" ? 1 : 0,
      requireInteraction: alert.severity === "critical",
    });
  } catch (error) {
    state.logger?.warn("Failed to show notification:", error);
  }
}

export function registerNotificationClickHandler(): void {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html#graph"),
    });
    chrome.notifications.clear(notificationId);
  });
}
