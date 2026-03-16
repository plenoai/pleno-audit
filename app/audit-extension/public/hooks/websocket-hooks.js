;(function() {
  'use strict'
  if (window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__) return
  window.__PLENO_WEBSOCKET_HOOKS_INITIALIZED__ = true

  const shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  const { emitSecurityEvent } = shared

  const OriginalWebSocket = window.WebSocket

  window.WebSocket = function(url, protocols) {
    const wsUrl = typeof url === 'string' ? url : url.toString()

    try {
      const parsed = new URL(wsUrl)
      const isExternal = parsed.hostname !== location.hostname

      if (isExternal) {
        emitSecurityEvent('__WEBSOCKET_CONNECTION_DETECTED__', {
          url: wsUrl,
          hostname: parsed.hostname,
          protocol: parsed.protocol,
          isExternal: true,
          timestamp: Date.now(),
          pageUrl: location.href
        })
      }
    } catch(e) {}

    if (protocols !== undefined) {
      return new OriginalWebSocket(url, protocols)
    }
    return new OriginalWebSocket(url)
  }

  window.WebSocket.prototype = OriginalWebSocket.prototype
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING
  window.WebSocket.OPEN = OriginalWebSocket.OPEN
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED
})()
