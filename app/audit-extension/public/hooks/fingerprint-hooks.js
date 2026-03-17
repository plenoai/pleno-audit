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
    if (canvasCallCount >= 2) {
      emitSecurityEvent('__CANVAS_FINGERPRINT_DETECTED__', {
        callCount: canvasCallCount,
        canvasWidth: this.width,
        canvasHeight: this.height,
        timestamp: Date.now(),
        pageUrl: location.href
      })
    }
    if (!canvasCallResetTimer) {
      canvasCallResetTimer = setTimeout(function() {
        canvasCallCount = 0
        canvasCallResetTimer = null
      }, 5000)
    }
    return originalToDataURL.apply(this, arguments)
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
            timestamp: Date.now(),
            pageUrl: location.href
          })
        }
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
      if (audioContextCount >= 1) {
        emitSecurityEvent('__AUDIO_FINGERPRINT_DETECTED__', {
          contextCount: audioContextCount,
          sampleRate: options?.sampleRate,
          timestamp: Date.now(),
          pageUrl: location.href
        })
      }
      if (options !== undefined) {
        return new OriginalAudioContext(options)
      }
      return new OriginalAudioContext()
    }
    NewAudioContext.prototype = OriginalAudioContext.prototype
    window.AudioContext = NewAudioContext
    if (window.webkitAudioContext) {
      window.webkitAudioContext = NewAudioContext
    }
  }
})()
