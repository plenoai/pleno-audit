import type { AIMonitorConfig, CapturedAIPrompt, RawAICapture } from "@libztbs/ai-detector";
import { parseRawAICapture } from "@libztbs/ai-detector";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

export function createAIPromptHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["AI_PROMPT_CAPTURED", {
      execute: (message) => {
        const raw = message.data as RawAICapture | CapturedAIPrompt;
        // Support both raw (from refactored main-world hooks) and parsed (legacy) formats
        const parsed = "rawRequestBody" in raw
          ? parseRawAICapture(raw as RawAICapture)
          : raw as CapturedAIPrompt;
        if (!parsed) return Promise.resolve({ success: false });
        return deps.handleAIPromptCaptured(parsed);
      },
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
