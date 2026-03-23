import type { RuntimeHandlerDependencies, RuntimeMessageHandler } from "./types.js";

export function createDirectHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, RuntimeMessageHandler> {
  return new Map<string, RuntimeMessageHandler>([
    ["PING", (_message, _sender, sendResponse) => {
      sendResponse("PONG");
      return false;
    }],
    ["DEBUG_BRIDGE_CONNECTED", () => {
      deps.logger.debug("Debug bridge: connected");
      return false;
    }],
    ["DEBUG_BRIDGE_DISCONNECTED", () => {
      deps.logger.debug("Debug bridge: disconnected");
      return false;
    }],
    ["DEBUG_BRIDGE_FORWARD", (message, _sender, sendResponse) => {
      deps.handleDebugBridgeForward(message.debugType as string, message.debugData)
        .then(sendResponse)
        .catch((error) => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      return true;
    }],
    ["GET_GENERATED_CSP_POLICY", (_message, _sender, sendResponse) => {
      chrome.storage.local.get("generatedCSPPolicy", (data) => {
        sendResponse(data.generatedCSPPolicy || null);
      });
      return true;
    }],
    ["START_SSO_AUTH", (message, _sender, sendResponse) => {
      (async () => {
        try {
          const ssoManager = await deps.getSSOManager();
          const provider = (message.data as { provider?: string } | undefined)?.provider;
          if (provider === "oidc") {
            const session = await ssoManager.startOIDCAuth();
            sendResponse({ success: true, session });
            return;
          }
          if (provider === "saml") {
            const session = await ssoManager.startSAMLAuth();
            sendResponse({ success: true, session });
            return;
          }
          sendResponse({ success: false, error: "Unknown provider" });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Auth failed",
          });
        }
      })();
      return true;
    }],
    ["GET_KNOWN_EXTENSIONS", (_message, _sender, sendResponse) => {
      sendResponse(deps.getKnownExtensions());
      return false;
    }],
  ]);
}
