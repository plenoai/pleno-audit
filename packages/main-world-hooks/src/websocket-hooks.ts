/**
 * @fileoverview WebSocket Detection Hooks
 */

import { type SharedHookUtils } from "./shared.js";

export function initWebSocketHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
    emitSecurityEvent("__WEBSOCKET_CONNECTION_DETECTED__", {
      url: typeof url === "string" ? url : url.toString(),
      ts: Date.now(),
    });
    return protocols !== undefined ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
  } as unknown as typeof WebSocket;

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
}
