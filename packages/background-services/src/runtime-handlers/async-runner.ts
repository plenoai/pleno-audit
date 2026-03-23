import type {
  AsyncMessageHandlerConfig,
  LoggerLike,
  RuntimeMessage,
} from "./types.js";

export function runAsyncMessageHandler(
  logger: LoggerLike,
  config: AsyncMessageHandlerConfig,
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): true {
  Promise.resolve(config.execute(message, sender))
    .then(sendResponse)
    .catch((error) => {
      logger.error("Async message handler failed", {
        type: message.type,
        senderTabId: sender.tab?.id,
        senderUrl: sender.tab?.url,
        error: error instanceof Error ? error.message : String(error),
      });
      sendResponse(config.fallback());
    });
  return true;
}
