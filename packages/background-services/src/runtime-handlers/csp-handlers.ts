import type { CSPConfig, CSPGenerationOptions } from "@pleno-audit/csp";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createCspHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_CSP_REPORTS", {
      execute: (message) => deps.getCSPReports(message.data as {
        type?: "csp-violation" | "network-request";
        limit?: number;
        offset?: number;
        since?: string;
        until?: string;
      }),
      fallback: () => [],
    }],
    ["GENERATE_CSP", {
      execute: (message) => deps.generateCSPPolicy((message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options),
      fallback: () => null,
    }],
    ["GENERATE_CSP_BY_DOMAIN", {
      execute: (message) => deps.generateCSPPolicyByDomain((message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options),
      fallback: () => null,
    }],
    ["REGENERATE_CSP_POLICY", {
      execute: async (message) => {
        try {
          const options = (message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options
            || { strictMode: false, includeReportUri: true };
          const result = await deps.generateCSPPolicyByDomain(options);
          if (result == null) {
            deps.logger.warn("REGENERATE_CSP_POLICY returned null", { options });
            return null;
          }
          await deps.saveGeneratedCSPPolicy(result);
          return result;
        } catch (error) {
          deps.logger.error("REGENERATE_CSP_POLICY failed", error);
          return null;
        }
      },
      fallback: () => null,
    }],
    ["GET_CSP_CONFIG", {
      execute: () => deps.getCSPConfig(),
      fallback: () => deps.fallbacks.cspConfig,
    }],
    ["SET_CSP_CONFIG", {
      execute: (message) => deps.setCSPConfig(message.data as Partial<CSPConfig>),
      fallback: () => ({ success: false }),
    }],
    ["CLEAR_CSP_DATA", {
      execute: () => deps.clearCSPData(),
      fallback: () => ({ success: false }),
    }],
    ["CLEAR_ALL_DATA", {
      execute: () => deps.clearAllData(),
      fallback: () => ({ success: false }),
    }],
  ];
}
