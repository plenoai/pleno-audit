import {
  createLogger,
  getBrowserAPI,
  hasManagedStorage,
  isFirefox,
} from "../extension-runtime/index.js";
import type {
  EnterpriseManagedConfig,
  EnterpriseStatus,
  DetectionConfig,
  NotificationConfig,
} from "../extension-runtime/index.js";
import type { SSOConfig } from "./sso-manager.js";
import { getSSOManager } from "./sso-manager.js";

const logger = createLogger("enterprise-manager");

type ManagedStorageChangeListener = (config: EnterpriseManagedConfig | null) => void;

class EnterpriseManager {
  private managedConfig: EnterpriseManagedConfig | null = null;
  private listeners: Set<ManagedStorageChangeListener> = new Set();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadManagedConfig();
      this.setupStorageListener();
      this.initialized = true;
      logger.info("EnterpriseManager initialized", {
        isManaged: this.isManaged(),
        ssoRequired: this.isSSORequired(),
        settingsLocked: this.isSettingsLocked(),
      });
    } catch (error) {
      logger.error("Failed to initialize EnterpriseManager:", error);
    }
  }

  private async loadManagedConfig(): Promise<void> {
    try {
      if (!hasManagedStorage()) {
        if (isFirefox) {
          logger.debug("Managed storage not available in Firefox - Enterprise features disabled");
        } else {
          logger.debug("chrome.storage.managed not available");
        }
        this.managedConfig = null;
        return;
      }

      const api = getBrowserAPI();
      const result = await api.storage.managed.get(null) as Partial<EnterpriseManagedConfig>;

      if (Object.keys(result).length === 0) {
        logger.debug("No managed storage configuration found");
        this.managedConfig = null;
        return;
      }

      const hasValidConfig =
        result.sso?.provider ||
        result.settings?.locked !== undefined ||
        result.reporting?.endpoint ||
        result.policy?.allowedDomains?.length ||
        result.policy?.blockedDomains?.length;

      if (!hasValidConfig) {
        logger.debug("Managed storage exists but contains no valid configuration");
        this.managedConfig = null;
        return;
      }

      this.managedConfig = result as EnterpriseManagedConfig;
      logger.info("Loaded managed configuration", {
        hasSSO: !!this.managedConfig.sso,
        hasSettings: !!this.managedConfig.settings,
        hasReporting: !!this.managedConfig.reporting,
        hasPolicy: !!this.managedConfig.policy,
      });

      if (this.managedConfig.sso?.provider) {
        await this.applySSOConfig();
      }
    } catch (error) {
      if ((error as Error)?.message?.includes("not supported")) {
        logger.debug("Managed storage not supported");
      } else {
        logger.warn("Error loading managed config:", error);
      }
      this.managedConfig = null;
    }
  }

  private setupStorageListener(): void {
    if (!hasManagedStorage()) {
      return;
    }

    const api = getBrowserAPI();
    if (!api.storage.managed?.onChanged) {
      return;
    }

    api.storage.managed.onChanged.addListener((changes) => {
      logger.info("Managed storage changed", { keys: Object.keys(changes) });
      this.loadManagedConfig().then(() => {
        this.notifyListeners();
      });
    });
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  private async applySSOConfig(): Promise<void> {
    if (!this.managedConfig?.sso?.provider) {
      return;
    }

    const ssoManager = await getSSOManager();
    const ssoConfig = this.managedConfig.sso;

    let config: SSOConfig;

    if (ssoConfig.provider === "oidc") {
      if (!ssoConfig.clientId || !ssoConfig.authority) {
        logger.error("OIDC config missing required fields (clientId, authority)");
        return;
      }
      if (!this.isValidUrl(ssoConfig.authority)) {
        logger.error("OIDC authority is not a valid URL:", ssoConfig.authority);
        return;
      }
      config = {
        provider: "oidc",
        clientId: ssoConfig.clientId,
        authority: ssoConfig.authority,
        scope: ssoConfig.scope,
      };
    } else if (ssoConfig.provider === "saml") {
      if (!ssoConfig.entityId) {
        logger.error("SAML config missing required field (entityId)");
        return;
      }
      if (ssoConfig.entryPoint && !this.isValidUrl(ssoConfig.entryPoint)) {
        logger.error("SAML entryPoint is not a valid URL:", ssoConfig.entryPoint);
        return;
      }
      config = {
        provider: "saml",
        entityId: ssoConfig.entityId,
        entryPoint: ssoConfig.entryPoint,
        issuer: ssoConfig.issuer,
      };
    } else {
      logger.error("Unknown SSO provider:", ssoConfig.provider);
      return;
    }

    const result = await ssoManager.setConfig(config);
    if (result.success) {
      logger.info("Applied managed SSO config", { provider: ssoConfig.provider });
    } else {
      logger.error("Failed to apply managed SSO config");
    }
  }

  isManaged(): boolean {
    return this.managedConfig !== null;
  }

  isSSORequired(): boolean {
    return this.managedConfig?.sso?.required === true;
  }

  isSettingsLocked(): boolean {
    return this.managedConfig?.settings?.locked === true;
  }

  getStatus(): EnterpriseStatus {
    return {
      isManaged: this.isManaged(),
      ssoRequired: this.isSSORequired(),
      settingsLocked: this.isSettingsLocked(),
      config: this.managedConfig,
    };
  }

  getManagedConfig(): EnterpriseManagedConfig | null {
    return this.managedConfig;
  }

  getEffectiveDetectionConfig(userConfig: DetectionConfig): DetectionConfig {
    if (!this.managedConfig?.settings) {
      return userConfig;
    }

    const managed = this.managedConfig.settings;
    return {
      enableNRD: managed.enableNRD ?? userConfig.enableNRD,
      enableTyposquat: managed.enableTyposquat ?? userConfig.enableTyposquat,
      enableAI: managed.enableAI ?? userConfig.enableAI,
      enableDLPAnonymize: userConfig.enableDLPAnonymize,
    };
  }

  getEffectiveSetting<K extends keyof DetectionConfig>(
    key: K,
    userValue: DetectionConfig[K]
  ): DetectionConfig[K] {
    if (!this.managedConfig?.settings) {
      return userValue;
    }

    const managedValue = this.managedConfig.settings[key];
    return managedValue !== undefined ? managedValue as DetectionConfig[K] : userValue;
  }

  isSettingManaged<K extends keyof DetectionConfig>(key: K): boolean {
    if (!this.isSettingsLocked()) {
      return false;
    }
    return this.managedConfig?.settings?.[key] !== undefined;
  }

  getReportingConfig() {
    return this.managedConfig?.reporting ?? null;
  }

  getPolicyConfig() {
    return this.managedConfig?.policy ?? null;
  }

  getEffectiveNotificationConfig(userConfig: NotificationConfig): NotificationConfig {
    if (!this.managedConfig?.settings) {
      return userConfig;
    }

    const managed = this.managedConfig.settings;
    return {
      ...userConfig,
      enabled: managed.enableNotifications ?? userConfig.enabled,
    };
  }

  subscribe(listener: ManagedStorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.managedConfig);
      } catch (error) {
        logger.error("Error in managed config listener:", error);
      }
    }
  }
}

let enterpriseManagerInstance: EnterpriseManager | null = null;

export async function getEnterpriseManager(): Promise<EnterpriseManager> {
  if (!enterpriseManagerInstance) {
    enterpriseManagerInstance = new EnterpriseManager();
    await enterpriseManagerInstance.initialize();
  }
  return enterpriseManagerInstance;
}

export function createEnterpriseManager(): EnterpriseManager {
  return new EnterpriseManager();
}

export { EnterpriseManager };
