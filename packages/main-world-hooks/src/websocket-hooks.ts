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
  // Static readonly constants must be copied via cast for monkey-patching
  (window.WebSocket as any).CONNECTING = OriginalWebSocket.CONNECTING;
  (window.WebSocket as any).OPEN = OriginalWebSocket.OPEN;
  (window.WebSocket as any).CLOSING = OriginalWebSocket.CLOSING;
  (window.WebSocket as any).CLOSED = OriginalWebSocket.CLOSED;
}
