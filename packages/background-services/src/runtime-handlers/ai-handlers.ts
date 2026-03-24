import type { AIMonitorConfig, CapturedAIPrompt } from "@libztbs/ai-detector";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createAIPromptHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["AI_PROMPT_CAPTURED", {
      execute: (message) => deps.handleAIPromptCaptured(message.data as CapturedAIPrompt),
      fallback: () => ({ success: false }),
    }],
    ["GET_AI_MONITOR_CONFIG", {
      execute: () => deps.getAIMonitorConfig(),
      fallback: () => deps.fallbacks.aiMonitorConfig,
    }],
    ["SET_AI_MONITOR_CONFIG", {
      execute: (message) => deps.setAIMonitorConfig(message.data as Partial<AIMonitorConfig>),
      fallback: () => ({ success: false }),
    }],
  ];
}
