;(function() {
  'use strict'
  if (window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__) return
  window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__ = true

  const shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  const { emitSecurityEvent } = shared

  const OriginalWebSocket = window.WebSocket

  window.WebSocket = function(url, protocols) {
    emitSecurityEvent('__WEBSOCKET_CONNECTION_DETECTED__', {
      url: typeof url === 'string' ? url : url.toString(), ts: Date.now()
    })
    return protocols !== undefined ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url)
  }

  window.WebSocket.prototype = OriginalWebSocket.prototype
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING
  window.WebSocket.OPEN = OriginalWebSocket.OPEN
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED
})()
