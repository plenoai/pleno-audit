import type { Logger } from "@libztbs/extension-runtime";
import type { DebugHandlerResult } from "./types.js";

export async function getSnapshot(logger: Logger): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get(null);

    return {
      success: true,
      data: {
        storage,
        extensionId: chrome.runtime.id,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    logger.error("getSnapshot error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
