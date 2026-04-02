interface DebugBridgeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

type DebugHandler = (data: unknown) => Promise<DebugBridgeResponse>;

function normalizeUrl(rawUrl: string): string {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  return `https://${rawUrl}`;
}

export function createDebugBridgeHandler(): (type: string, data: unknown) => Promise<DebugBridgeResponse> {
  const handlers = new Map<string, DebugHandler>([
    ["DEBUG_TAB_OPEN", async (rawData) => {
      const params = rawData as { url: string };
      if (typeof params?.url !== "string" || params.url.trim() === "") {
        return { success: false, error: "Invalid or missing URL" };
      }

      const url = normalizeUrl(params.url.trim());
      const tab = await chrome.tabs.create({ url, active: true });
      return { success: true, data: { tabId: tab.id, url: tab.url || url } };
    }],
  ]);

  return async (type: string, data: unknown): Promise<DebugBridgeResponse> => {
    const handler = handlers.get(type);
    if (!handler) {
      return { success: false, error: `Unknown debug message type: ${type}` };
    }

    try {
      return await handler(data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };
}
