;(function() {
  'use strict'
  if (window.__PLENO_WORKER_HOOKS_INITIALIZED__) return
  window.__PLENO_WORKER_HOOKS_INITIALIZED__ = true

  const shared = window.__PLENO_HOOKS_SHARED__
  if (!shared) return
  const { emitSecurityEvent } = shared

  // Hook Worker constructor
  const OriginalWorker = window.Worker
  window.Worker = function(scriptURL, options) {
    const url = typeof scriptURL === 'string' ? scriptURL : scriptURL.toString()
    const isBlobUrl = url.startsWith('blob:')

    emitSecurityEvent('__WORKER_CREATED__', {
      url: isBlobUrl ? 'blob:' : url,
      isBlobUrl: isBlobUrl,
      type: options?.type || 'classic',
      timestamp: Date.now(),
      pageUrl: location.href
    })

    return new OriginalWorker(scriptURL, options)
  }
  window.Worker.prototype = OriginalWorker.prototype

  // Hook SharedWorker constructor
  if (window.SharedWorker) {
    const OriginalSharedWorker = window.SharedWorker
    window.SharedWorker = function(scriptURL, options) {
      const url = typeof scriptURL === 'string' ? scriptURL : scriptURL.toString()
      const isBlobUrl = url.startsWith('blob:')

      emitSecurityEvent('__SHARED_WORKER_CREATED__', {
        url: isBlobUrl ? 'blob:' : url,
        isBlobUrl: isBlobUrl,
        name: typeof options === 'string' ? options : options?.name,
        timestamp: Date.now(),
        pageUrl: location.href
      })

      return new OriginalSharedWorker(scriptURL, options)
    }
    window.SharedWorker.prototype = OriginalSharedWorker.prototype
  }

  // Hook ServiceWorker registration
  if (navigator.serviceWorker) {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker)
    navigator.serviceWorker.register = function(scriptURL, options) {
      const url = typeof scriptURL === 'string' ? scriptURL : scriptURL.toString()

      emitSecurityEvent('__SERVICE_WORKER_REGISTERED__', {
        url: url,
        scope: options?.scope,
        type: options?.type || 'classic',
        timestamp: Date.now(),
        pageUrl: location.href
      })

      return originalRegister(scriptURL, options)
    }
  }
})()
