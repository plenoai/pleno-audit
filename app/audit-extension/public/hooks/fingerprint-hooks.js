;(function() {
  'use strict'
  if (window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__) return
  window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__ = true

  var shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  var emitSecurityEvent = shared.emitSecurityEvent

  // Canvas fingerprinting detection
  var originalToDataURL = HTMLCanvasElement.prototype.toDataURL

  HTMLCanvasElement.prototype.toDataURL = function() {
    emitSecurityEvent('__CANVAS_FINGERPRINT_DETECTED__', {
      w: this.width, h: this.height, ts: Date.now()
    })
    return originalToDataURL.apply(this, arguments)
  }

  // WebGL fingerprinting detection
  var originalGetParameter = null

  function hookWebGLGetParameter(gl) {
    if (!originalGetParameter) {
      originalGetParameter = gl.__proto__.getParameter
    }
    gl.__proto__.getParameter = function(pname) {
      // RENDERER, VENDOR, or debug renderer info extension params
      if (pname === 0x1F01 || pname === 0x1F00 || pname === 0x9245 || pname === 0x9246) {
        emitSecurityEvent('__WEBGL_FINGERPRINT_DETECTED__', { pname: pname, ts: Date.now() })
      }
      return originalGetParameter.call(this, pname)
    }
  }

  // Hook getContext to intercept WebGL creation
  var originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function(contextType) {
    var ctx = originalGetContext.apply(this, arguments)
    if (ctx && (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl')) {
      hookWebGLGetParameter(ctx)
    }
    return ctx
  }

  // AudioContext fingerprinting detection
  if (window.AudioContext || window.webkitAudioContext) {
    var OriginalAudioContext = window.AudioContext || window.webkitAudioContext

    var NewAudioContext = function AudioContext(options) {
      emitSecurityEvent('__AUDIO_FINGERPRINT_DETECTED__', { ts: Date.now() })
      return options !== undefined ? new OriginalAudioContext(options) : new OriginalAudioContext()
    }
    NewAudioContext.prototype = OriginalAudioContext.prototype
    window.AudioContext = NewAudioContext
    if (window.webkitAudioContext) {
      window.webkitAudioContext = NewAudioContext
    }
  }

  // RTCPeerConnection detection
  if (window.RTCPeerConnection) {
    var OriginalRTCPeerConnection = window.RTCPeerConnection
    window.RTCPeerConnection = function() {
      emitSecurityEvent('__WEBRTC_CONNECTION_DETECTED__', { ts: Date.now() })
      return new OriginalRTCPeerConnection(...arguments)
    }
    window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype
  }

  // BroadcastChannel detection
  if (window.BroadcastChannel) {
    var OriginalBroadcastChannel = window.BroadcastChannel
    window.BroadcastChannel = function(name) {
      emitSecurityEvent('__BROADCAST_CHANNEL_DETECTED__', { name: name, ts: Date.now() })
      return new OriginalBroadcastChannel(name)
    }
    window.BroadcastChannel.prototype = OriginalBroadcastChannel.prototype
  }
})()
