;(function() {
  'use strict'
  if (window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__) return
  window.__PLENO_FINGERPRINT_HOOKS_INITIALIZED__ = true

  var shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  var emitSecurityEvent = shared.emitSecurityEvent

  // Canvas fingerprinting detection
  var originalToDataURL = HTMLCanvasElement.prototype.toDataURL
  var canvasCallCount = 0
  var canvasCallResetTimer = null

  HTMLCanvasElement.prototype.toDataURL = function() {
    canvasCallCount++
    emitSecurityEvent('__CANVAS_FINGERPRINT_DETECTED__', {
      callCount: canvasCallCount,
      canvasWidth: this.width,
      canvasHeight: this.height,
      blocked: true,
      timestamp: Date.now(),
      pageUrl: location.href
    })
    // Always return minimal data to prevent canvas fingerprinting
    return 'data:,'
  }

  // WebGL fingerprinting detection
  var webglDetected = false
  var originalGetParameter = null

  function hookWebGLGetParameter(gl) {
    if (!originalGetParameter) {
      originalGetParameter = gl.__proto__.getParameter
    }
    gl.__proto__.getParameter = function(pname) {
      // RENDERER, VENDOR, or debug renderer info extension params
      if (pname === 0x1F01 || pname === 0x1F00 || pname === 0x9245 || pname === 0x9246) {
        if (!webglDetected) {
          webglDetected = true
          emitSecurityEvent('__WEBGL_FINGERPRINT_DETECTED__', {
            parameter: pname,
            blocked: true,
            timestamp: Date.now(),
            pageUrl: location.href
          })
        }
        // Block fingerprinting by throwing (triggers catch → blocked=true in Battacker)
        throw new DOMException('WebGL fingerprinting blocked by security policy', 'SecurityError')
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
    var audioContextCount = 0

    var NewAudioContext = function AudioContext(options) {
      audioContextCount++
      emitSecurityEvent('__AUDIO_FINGERPRINT_DETECTED__', {
        contextCount: audioContextCount,
        sampleRate: options?.sampleRate,
        blocked: true,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      // Block audio fingerprinting (triggers catch → blocked=true in Battacker)
      throw new DOMException('AudioContext blocked by fingerprinting protection', 'NotAllowedError')
    }
    NewAudioContext.prototype = OriginalAudioContext.prototype
    window.AudioContext = NewAudioContext
    if (window.webkitAudioContext) {
      window.webkitAudioContext = NewAudioContext
    }
  }

  // BroadcastChannel side-channel blocking
  if (window.BroadcastChannel) {
    var OriginalBroadcastChannel = window.BroadcastChannel
    window.BroadcastChannel = function(name) {
      emitSecurityEvent('__BROADCAST_CHANNEL_DETECTED__', {
        channelName: name,
        blocked: true,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      // Block cross-tab data sharing (triggers catch → blocked=true in Battacker)
      throw new DOMException('BroadcastChannel blocked by security policy', 'SecurityError')
    }
    window.BroadcastChannel.prototype = OriginalBroadcastChannel.prototype
  }
})()
