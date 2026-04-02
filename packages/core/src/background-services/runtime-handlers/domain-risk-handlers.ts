import type { NRDConfig } from "../../nrd/index.js";
import type { TyposquatConfig } from "../../typosquat/index.js";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createDomainRiskHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["CHECK_NRD", {
      execute: (message) => deps.handleNRDCheck((message.data as { domain: string }).domain),
      fallback: () => ({ error: true }),
    }],
    ["GET_NRD_CONFIG", {
      execute: () => deps.getNRDConfig(),
      fallback: () => deps.fallbacks.nrdConfig,
    }],
    ["SET_NRD_CONFIG", {
      execute: (message) => deps.setNRDConfig(message.data as NRDConfig),
      fallback: () => ({ success: false }),
    }],
    ["CHECK_TYPOSQUAT", {
      execute: (message) => deps.handleTyposquatCheck((message.data as { domain: string }).domain),
      fallback: () => ({ error: true }),
    }],
    ["GET_TYPOSQUAT_CONFIG", {
      execute: () => deps.getTyposquatConfig(),
      fallback: () => deps.fallbacks.typosquatConfig,
    }],
    ["SET_TYPOSQUAT_CONFIG", {
      execute: (message) => deps.setTyposquatConfig(message.data as TyposquatConfig),
      fallback: () => ({ success: false }),
    }],
  ];
}
