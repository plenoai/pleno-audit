import type { DebugHandlerResult } from "./types.js";

export async function openTab(params: { url: string }): Promise<DebugHandlerResult> {
  try {
    let url = params.url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    const tab = await chrome.tabs.create({ url, active: true });
    return {
      success: true,
      data: {
        tabId: tab.id,
        url: tab.url || url,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to open tab",
    };
  }
}
