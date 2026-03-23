import { setDebuggerSink, createLogger, type LogEntry } from "@libztbs/extension-runtime";
import { DEBUG_SERVER_URL, LOG_BUFFER_SIZE, RECONNECT_INTERVAL } from "./constants.js";
import { createDebugHandlers, dispatchDebugHandler } from "./handlers.js";
import type { DebugBridgeDeps, DebugMessage, DebugHandlerResult, DebugResponse } from "./types.js";

const logger = createLogger("debug-bridge");

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let logBuffer: LogEntry[] = [];

let handlers = createDebugHandlers(logger);

function sendLog(entry: LogEntry): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "DEBUG_LOG",
        data: entry,
      })
    );
  } else {
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE) {
      logBuffer.shift();
    }
  }
}

function flushLogBuffer(): void {
  if (ws?.readyState !== WebSocket.OPEN || logBuffer.length === 0) {
    return;
  }

  for (const entry of logBuffer) {
    ws.send(
      JSON.stringify({
        type: "DEBUG_LOG",
        data: entry,
      })
    );
  }
  logBuffer = [];
}

export function initDebugBridge(deps?: DebugBridgeDeps): void {
  if (!import.meta.env.DEV) {
    return;
  }

  handlers = createDebugHandlers(logger, deps);
  setDebuggerSink(sendLog);

  logger.info("Initializing...");
  connect();
}

function connect(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    ws = new WebSocket(DEBUG_SERVER_URL);

    ws.onopen = () => {
      logger.info("Connected to debug server");
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      sendResponse({
        success: true,
        data: {
          type: "connected",
          extensionId: chrome.runtime.id,
          version: chrome.runtime.getManifest().version,
          devMode: true,
        },
      });

      flushLogBuffer();
    };

    ws.onmessage = async (event) => {
      try {
        const message: DebugMessage = JSON.parse(event.data as string);
        const response = await handleMessage(message);
        sendResponse({ id: message.id, ...response });
      } catch (error) {
        logger.error("Error handling message:", error);
      }
    };

    ws.onclose = (event) => {
      logger.info(
        `Disconnected from debug server (code: ${event.code}, reason: ${event.reason || "none"})`
      );
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      logger.error("WebSocket error:", error);
      ws?.close();
    };
  } catch (error) {
    logger.error("Connection error:", error);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
}

function sendResponse(response: DebugResponse): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

async function handleMessage(message: DebugMessage): Promise<DebugHandlerResult> {
  const { type, data } = message;

  try {
    const fallback = async (): Promise<DebugHandlerResult> => ({
      success: false,
      error: `Unknown message type: ${type}. Debug bridge cannot forward messages to background.`,
    });

    return await dispatchDebugHandler(handlers, type, data, fallback);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
