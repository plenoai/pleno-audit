;(function() {
  'use strict'
  if (window.__PLENO_INJECTION_HOOKS_INITIALIZED__) return
  window.__PLENO_INJECTION_HOOKS_INITIALIZED__ = true

  var shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  var emitSecurityEvent = shared.emitSecurityEvent

  // Hook eval() - observe dynamic code execution
  var originalEval = window.eval
  window.eval = function(code) {
    emitSecurityEvent('__DYNAMIC_CODE_EXECUTION_DETECTED__', {
      method: 'eval',
      codeLength: typeof code === 'string' ? code.length : 0,
      codeSample: typeof code === 'string' ? code.substring(0, 200) : '',
      timestamp: Date.now(),
      pageUrl: location.href
    })
    return originalEval.call(this, code)
  }

  // Hook Function constructor - observe dynamic code execution
  var OriginalFunction = window.Function
  window.Function = function() {
    var args = Array.prototype.slice.call(arguments)
    var body = args.length > 0 ? args[args.length - 1] : ''

    emitSecurityEvent('__DYNAMIC_CODE_EXECUTION_DETECTED__', {
      method: 'Function',
      codeLength: typeof body === 'string' ? body.length : 0,
      codeSample: typeof body === 'string' ? body.substring(0, 200) : '',
      argCount: args.length,
      timestamp: Date.now(),
      pageUrl: location.href
    })

    return OriginalFunction.apply(this, arguments)
  }
  window.Function.prototype = OriginalFunction.prototype

  // Hook requestFullscreen
  var originalRequestFullscreen = Element.prototype.requestFullscreen
  if (originalRequestFullscreen) {
    Element.prototype.requestFullscreen = function(options) {
      emitSecurityEvent('__FULLSCREEN_PHISHING_DETECTED__', {
        element: this.tagName,
        elementId: this.id || null,
        className: this.className || null,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      return originalRequestFullscreen.call(this, options)
    }
  }
  // Webkit prefix
  if (Element.prototype.webkitRequestFullscreen) {
    var originalWebkitFullscreen = Element.prototype.webkitRequestFullscreen
    Element.prototype.webkitRequestFullscreen = function() {
      emitSecurityEvent('__FULLSCREEN_PHISHING_DETECTED__', {
        element: this.tagName,
        elementId: this.id || null,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      return originalWebkitFullscreen.apply(this, arguments)
    }
  }

  // Hook clipboard.readText
  if (navigator.clipboard && navigator.clipboard.readText) {
    var originalReadText = navigator.clipboard.readText.bind(navigator.clipboard)
    navigator.clipboard.readText = function() {
      emitSecurityEvent('__CLIPBOARD_READ_DETECTED__', {
        timestamp: Date.now(),
        pageUrl: location.href
      })
      return originalReadText()
    }
  }

  // Hook geolocation
  if (navigator.geolocation) {
    var originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      emitSecurityEvent('__GEOLOCATION_ACCESSED__', {
        method: 'getCurrentPosition',
        highAccuracy: options?.enableHighAccuracy || false,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      return originalGetCurrentPosition(success, error, options)
    }

    var originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation)
    navigator.geolocation.watchPosition = function(success, error, options) {
      emitSecurityEvent('__GEOLOCATION_ACCESSED__', {
        method: 'watchPosition',
        highAccuracy: options?.enableHighAccuracy || false,
        timestamp: Date.now(),
        pageUrl: location.href
      })
      return originalWatchPosition(success, error, options)
    }
  }
})()
