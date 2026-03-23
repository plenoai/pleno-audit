import type { EnterpriseStatus } from "@pleno-audit/extension-runtime";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createConnectionAndAuthHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_SSO_STATUS", {
      execute: async () => {
        const ssoManager = await deps.getSSOManager();
        return ssoManager.getStatus();
      },
      fallback: () => ({ enabled: false, isAuthenticated: false }),
    }],
    ["SET_SSO_ENABLED", {
      execute: async (message) => {
        const ssoManager = await deps.getSSOManager();
        if ((message.data as { enabled?: boolean } | undefined)?.enabled === false) {
          await ssoManager.disableSSO();
        }
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["DISABLE_SSO", {
      execute: async () => {
        const ssoManager = await deps.getSSOManager();
        await ssoManager.disableSSO();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["GET_ENTERPRISE_STATUS", {
      execute: async () => {
        const enterpriseManager = await deps.getEnterpriseManager();
        return enterpriseManager.getStatus();
      },
      fallback: () => ({
        isManaged: false,
        ssoRequired: false,
        settingsLocked: false,
        config: null,
      } as EnterpriseStatus),
    }],
    ["GET_EFFECTIVE_DETECTION_CONFIG", {
      execute: async () => {
        const enterpriseManager = await deps.getEnterpriseManager();
        const userConfig = await deps.getDetectionConfig();
        return enterpriseManager.getEffectiveDetectionConfig(userConfig);
      },
      fallback: () => deps.fallbacks.detectionConfig,
    }],
  ];
}
