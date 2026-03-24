import { DEFAULT_CSP_CONFIG } from "@libztbs/csp";
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "@libztbs/extension-runtime";
import { DEFAULT_POLICY_CONFIG } from "@libztbs/alerts";
import type { BackgroundServiceState } from "./state.js";
import type { CookieInfo, DetectedService, StorageData } from "./types.js";

export function queueStorageOperation<T>(
  state: BackgroundServiceState,
  operation: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    state.storageQueue = state.storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

export async function initStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get([
    "services",
    "cspConfig",
    "detectionConfig",
    "notificationConfig",
    "policyConfig",
  ]) as Partial<StorageData>;
  return {
    services: result.services || ({} as Record<string, DetectedService>),
    cspConfig: result.cspConfig || DEFAULT_CSP_CONFIG,
    detectionConfig: result.detectionConfig || DEFAULT_DETECTION_CONFIG,
    notificationConfig: result.notificationConfig || DEFAULT_NOTIFICATION_CONFIG,
    policyConfig: result.policyConfig || DEFAULT_POLICY_CONFIG,
  };
}

export async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

function createDefaultService(domain: string): DetectedService {
  return {
    domain,
    detectedAt: Date.now(),
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
  };
}

export async function updateService(
  state: BackgroundServiceState,
  domain: string,
  update: Partial<DetectedService>,
  onNewDomain?: (domain: string) => Promise<void>
) {
  return queueStorageOperation(state, async () => {
    const storage = await initStorage();
    const isNewDomain = !storage.services[domain];
    const existing = storage.services[domain] || createDefaultService(domain);

    storage.services[domain] = {
      ...existing,
      ...update,
    };

    await saveStorage({ services: storage.services });

    if (isNewDomain && onNewDomain) {
      onNewDomain(domain).catch((error) => {
        state.logger?.warn("Failed to check domain policy:", domain, error);
      });
    }
  });
}

export async function addCookieToService(
  state: BackgroundServiceState,
  domain: string,
  cookie: CookieInfo
) {
  return queueStorageOperation(state, async () => {
    const storage = await initStorage();

    if (!storage.services[domain]) {
      storage.services[domain] = createDefaultService(domain);
    }

    const service = storage.services[domain];
    const exists = service.cookies.some((c) => c.name === cookie.name);
    if (!exists) {
      service.cookies.push(cookie);
    }

    await saveStorage({ services: storage.services });
  });
}
