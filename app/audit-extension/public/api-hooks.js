;(function() {
  'use strict'

  if (window.__SERVICE_DETECTION_CSP_INITIALIZED__) return
  window.__SERVICE_DETECTION_CSP_INITIALIZED__ = true

  const originalFetch = window.fetch
  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator)

  const INSPECTION_BODY_SAMPLE_LIMIT = 4096

  function createSharedHookUtils() {
    function emitSecurityEvent(eventName, data) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }))
    }

    function getBodySize(body) {
      if (!body) return 0
      if (typeof body === 'string') return new Blob([body]).size
      if (body instanceof URLSearchParams) return new Blob([body.toString()]).size
      if (body instanceof Blob) return body.size
      if (body instanceof ArrayBuffer) return body.byteLength
      if (ArrayBuffer.isView(body)) return body.byteLength
      if (body instanceof FormData) {
        let size = 0
        for (const [key, value] of body.entries()) {
          size += key.length
          if (typeof value === 'string') size += value.length
          else if (value instanceof Blob) size += value.size
        }
        return size
      }
      return 0
    }

    function getBodySample(body) {
      if (!body) return ''
      if (typeof body === 'string') return body.slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
      if (body instanceof URLSearchParams) return body.toString().slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
      if (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return ''
      if (body instanceof FormData) {
        let text = ''
        for (const [key, value] of body.entries()) {
          text += typeof value === 'string' ? `${key}=${value}&` : `${key}=[binary]&`
          if (text.length >= INSPECTION_BODY_SAMPLE_LIMIT) return text.slice(0, INSPECTION_BODY_SAMPLE_LIMIT)
        }
        return text
      }
      if (typeof body === 'object' && body.constructor === Object) {
        try { return JSON.stringify(body).slice(0, INSPECTION_BODY_SAMPLE_LIMIT) } catch { return '' }
      }
      return ''
    }

    function scheduleNetworkInspection({ url, method, initiator, body, pageUrl }) {
      const normalizedMethod = (method || 'GET').toUpperCase()
      if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return

      const payload = { url, method: normalizedMethod, initiator, pageUrl, timestamp: Date.now(), bodySize: getBodySize(body) }

      const dispatch = () => {
        const bodySample = getBodySample(body)
        emitSecurityEvent('__NETWORK_INSPECTION_REQUEST__', bodySample ? { ...payload, bodySample } : payload)
      }

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => dispatch(), { timeout: 300 })
        return
      }
      setTimeout(dispatch, 0)
    }

    return { getBodySize, emitSecurityEvent, scheduleNetworkInspection }
  }

  const sharedHookUtils = window.__PLENO_HOOKS_SHARED__ || createSharedHookUtils()
  window.__PLENO_HOOKS_SHARED__ = sharedHookUtils
  const { getBodySize, emitSecurityEvent, scheduleNetworkInspection } = sharedHookUtils

  // ===== AI Prompt Capture =====
  const MAX_CONTENT_SIZE = 50000
  const TRUNCATE_SIZE = 10000

  function truncateString(str, maxLength) {
    return str.length <= maxLength ? str : str.substring(0, maxLength)
  }

  function isMessagesArray(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return false
    return messages.some(m =>
      m && typeof m === 'object' && (
        (typeof m.role === 'string' && ('content' in m || 'parts' in m)) ||
        (m.author && typeof m.author.role === 'string' && m.content && Array.isArray(m.content.parts))
      )
    )
  }

  function isGeminiContents(contents) {
    if (!Array.isArray(contents) || contents.length === 0) return false
    return contents.some(c =>
      c && typeof c === 'object' && 'parts' in c && Array.isArray(c.parts) &&
      c.parts.some(p => p && typeof p === 'object' && 'text' in p)
    )
  }

  function isChatGPTConversation(obj) {
    if (typeof obj.action === 'string' &&
        ['next', 'variant', 'continue'].includes(obj.action) &&
        typeof obj.conversation_id === 'string') return true
    if (typeof obj.action === 'string' && obj.action === 'next' && Array.isArray(obj.messages)) return true
    return false
  }

  function isAIRequestBody(body) {
    if (!body) return false
    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      if (!obj || typeof obj !== 'object') return false
      if (isMessagesArray(obj.messages)) return true
      if (typeof obj.prompt === 'string' && typeof obj.model === 'string') return true
      if (isGeminiContents(obj.contents)) return true
      if (isChatGPTConversation(obj)) return true
      return false
    } catch { return false }
  }

  function extractMessageContent(message) {
    if (typeof message.content === 'string') return message.content
    if (Array.isArray(message.content)) {
      return message.content.map(c => {
        if (typeof c === 'string') return c
        if (c.type === 'text' && typeof c.text === 'string') return c.text
        return ''
      }).join('')
    }
    if (message.content && Array.isArray(message.content.parts)) {
      return message.content.parts.map(p => typeof p === 'string' ? p : (p.text || '')).join('')
    }
    if (typeof message.text === 'string') return message.text
    return ''
  }

  function extractPrompt(body) {
    if (!body) return null
    try {
      const obj = typeof body === 'string' ? JSON.parse(body) : body
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      const contentSize = bodyStr.length
      const truncated = contentSize > TRUNCATE_SIZE

      if (isMessagesArray(obj.messages)) {
        return {
          messages: obj.messages.map(m => ({
            role: m.role || m.author?.role || 'user',
            content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
          })),
          contentSize, truncated, model: obj.model,
        }
      }
      if (typeof obj.prompt === 'string') {
        return { text: truncateString(obj.prompt, TRUNCATE_SIZE), contentSize, truncated, model: obj.model }
      }
      if (isGeminiContents(obj.contents)) {
        return {
          messages: obj.contents.map(c => ({
            role: c.role || 'user',
            content: truncateString(c.parts.map(p => p.text || '').join(''), TRUNCATE_SIZE),
          })),
          contentSize, truncated, model: obj.model,
        }
      }
      if (isChatGPTConversation(obj)) {
        return {
          chatgptAction: obj.action, conversationId: obj.conversation_id,
          parentMessageId: obj.parent_message_id, contentSize, truncated, model: obj.model,
        }
      }
      return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize, truncated }
    } catch {
      const bodyStr = String(body)
      return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize: bodyStr.length, truncated: bodyStr.length > TRUNCATE_SIZE }
    }
  }

  function extractStreamingContent(text) {
    const chunks = []
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue
      try {
        const data = JSON.parse(line.slice(6))
        const delta = data.choices?.[0]?.delta?.content
          || data.delta?.text
          || data.candidates?.[0]?.content?.parts?.[0]?.text
        if (delta) chunks.push(delta)
      } catch {}
    }
    return truncateString(chunks.join(''), TRUNCATE_SIZE)
  }

  function extractResponse(text, isStreaming) {
    const contentSize = text.length
    const truncated = contentSize > TRUNCATE_SIZE
    const result = { contentSize, truncated, isStreaming }
    try {
      if (isStreaming || text.includes('data: ')) {
        result.text = extractStreamingContent(text)
        return result
      }
      const obj = JSON.parse(text)
      if (obj.choices?.[0]?.message?.content) result.text = truncateString(obj.choices[0].message.content, TRUNCATE_SIZE)
      else if (obj.choices?.[0]?.text) result.text = truncateString(obj.choices[0].text, TRUNCATE_SIZE)
      else if (obj.content?.[0]?.text) result.text = truncateString(obj.content[0].text, TRUNCATE_SIZE)
      else if (obj.candidates?.[0]?.content?.parts?.[0]?.text) result.text = truncateString(obj.candidates[0].content.parts[0].text, TRUNCATE_SIZE)
      if (obj.usage) {
        result.usage = {
          promptTokens: obj.usage.prompt_tokens ?? obj.usage.input_tokens,
          completionTokens: obj.usage.completion_tokens ?? obj.usage.output_tokens,
          totalTokens: obj.usage.total_tokens,
        }
      }
    } catch { result.text = truncateString(text, TRUNCATE_SIZE) }
    return result
  }

  // ===== FETCH =====
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url
    const method = init?.method || (typeof input === 'object' ? input.method : 'GET') || 'GET'
    const body = init?.body

    if (url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href
        const normalizedMethod = method.toUpperCase()
        scheduleNetworkInspection({ url: fullUrl, method: normalizedMethod, initiator: 'fetch', body, pageUrl: window.location.href })
      } catch {}
    }

    if (body && method.toUpperCase() !== 'GET' && isAIRequestBody(body)) {
      const startTime = Date.now()
      const promptContent = extractPrompt(body)
      const captureData = {
        id: crypto.randomUUID(), timestamp: startTime, pageUrl: window.location.href,
        apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
        method: method.toUpperCase(), prompt: promptContent, model: promptContent?.model,
      }
      const result = originalFetch.apply(this, arguments)
      return result.then(response => {
        const clonedResponse = response.clone()
        const contentType = response.headers.get('content-type') || ''
        const isStreaming = contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')
        clonedResponse.text().then(text => {
          if (text.length <= MAX_CONTENT_SIZE) {
            captureData.response = extractResponse(text, isStreaming)
            captureData.responseTimestamp = Date.now()
            captureData.response.latencyMs = Date.now() - startTime
          }
          emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
        }).catch(() => emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData))
        return response
      }).catch(error => {
        emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
        throw error
      })
    }

    return originalFetch.apply(this, arguments)
  }

  // ===== XHR =====
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__serviceDetectionUrl = url
    this.__serviceDetectionMethod = method
    return originalXHROpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function(body) {
    const xhrUrl = this.__serviceDetectionUrl
    const xhrMethod = (this.__serviceDetectionMethod || 'GET').toUpperCase()

    if (xhrUrl) {
      try {
        const fullUrl = new URL(xhrUrl, window.location.origin).href
        scheduleNetworkInspection({ url: fullUrl, method: xhrMethod, initiator: 'xhr', body, pageUrl: window.location.href })
      } catch {}
    }

    if (body && xhrMethod !== 'GET' && isAIRequestBody(body)) {
      const startTime = Date.now()
      const promptContent = extractPrompt(body)
      const captureData = {
        id: crypto.randomUUID(), timestamp: startTime, pageUrl: window.location.href,
        apiEndpoint: xhrUrl ? new URL(xhrUrl, window.location.origin).href : window.location.href,
        method: xhrMethod, prompt: promptContent, model: promptContent?.model,
      }
      const xhr = this
      const originalOnReadyStateChange = xhr.onreadystatechange
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          try {
            const responseText = xhr.responseText
            if (responseText && responseText.length <= MAX_CONTENT_SIZE) {
              const contentType = xhr.getResponseHeader('content-type') || ''
              captureData.response = extractResponse(responseText, contentType.includes('text/event-stream'))
              captureData.responseTimestamp = Date.now()
              captureData.response.latencyMs = Date.now() - startTime
            }
          } catch {}
          emitSecurityEvent('__AI_PROMPT_CAPTURED__', captureData)
        }
        if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments)
      }
    }

    return originalXHRSend.call(this, body)
  }

  // ===== Beacon =====
  if (originalSendBeacon) {
    navigator.sendBeacon = function(url, data) {
      try {
        const fullUrl = new URL(url, window.location.origin).href
        scheduleNetworkInspection({ url: fullUrl, method: 'POST', initiator: 'beacon', body: data, pageUrl: window.location.href })
      } catch {}
      return originalSendBeacon(url, data)
    }
  }

  // ===== Supply Chain Risk =====
  const knownCDNs = [
    'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'ajax.googleapis.com',
    'code.jquery.com', 'stackpath.bootstrapcdn.com', 'maxcdn.bootstrapcdn.com',
    'cdn.bootcdn.net', 'lib.baomitu.com', 'cdn.staticfile.org',
  ]

  function checkSupplyChainRisk(element, resourceType) {
    const url = resourceType === 'script' ? element.src : element.href
    if (!url) return
    try { if (new URL(url, window.location.origin).hostname === window.location.hostname) return } catch { return }

    const hasIntegrity = element.hasAttribute('integrity') && element.integrity
    const hasCrossorigin = element.hasAttribute('crossorigin')
    let isCDN = false
    try { const h = new URL(url, window.location.origin).hostname; isCDN = knownCDNs.some(cdn => h.includes(cdn)) } catch {}

    if (!hasIntegrity && isCDN) {
      const risks = ['cdn_without_sri']
      if (!hasCrossorigin) risks.push('missing_crossorigin')
      emitSecurityEvent('__SUPPLY_CHAIN_RISK_DETECTED__', {
        url, resourceType, hasIntegrity: false, hasCrossorigin, isCDN, risks, timestamp: Date.now(),
      })
    }
  }

  // ===== DOM Mutation Observer (Supply Chain Risk only) =====
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        if (node.tagName === 'SCRIPT' && node.src) {
          checkSupplyChainRisk(node, 'script')
        }
        if (node.tagName === 'LINK' && node.href) {
          const isStylesheet = node.relList ? node.relList.contains('stylesheet') : node.getAttribute('rel')?.split(/\s+/).includes('stylesheet')
          if (isStylesheet) checkSupplyChainRisk(node, 'stylesheet')
        }
      }
    }
  })

  const startObserving = () => {
    if (document.head) observer.observe(document.head, { childList: true, subtree: true })
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
    } else {
      // body is not yet available — watch for it via DOMContentLoaded
      const onReady = () => {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true })
      }
      document.addEventListener('DOMContentLoaded', onReady, { once: true })
    }
  }
  if (document.body || document.head) startObserving()
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true })

  // ===== Credential Theft =====
  const sensitiveTypes = ['password', 'email', 'tel', 'credit-card']
  const sensitiveNames = ['password', 'passwd', 'pwd', 'pass', 'secret', 'token', 'api_key', 'apikey', 'credit', 'card', 'cvv', 'ssn', 'otp', 'pin', 'auth', 'credential', '2fa', 'mfa']

  function hasSensitiveFields(form) {
    for (const input of form.querySelectorAll('input')) {
      const type = (input.type || '').toLowerCase()
      const name = (input.name || '').toLowerCase()
      const id = (input.id || '').toLowerCase()
      const autocomplete = (input.autocomplete || '').toLowerCase()
      if (sensitiveTypes.includes(type)) return { hasSensitive: true, fieldType: type }
      for (const pattern of sensitiveNames) {
        if (name.includes(pattern) || id.includes(pattern)) return { hasSensitive: true, fieldType: pattern }
      }
      if (autocomplete.includes('password') || autocomplete.includes('cc-')) return { hasSensitive: true, fieldType: autocomplete }
    }
    return { hasSensitive: false, fieldType: null }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    try {
      const actionUrl = new URL(form.action || window.location.href, window.location.origin)
      const isCrossOrigin = actionUrl.hostname !== window.location.hostname
      const isSecure = actionUrl.protocol === 'https:'
      const { hasSensitive, fieldType } = hasSensitiveFields(form)
      if (hasSensitive) {
        const risks = []
        if (!isSecure) risks.push('insecure_protocol')
        if (isCrossOrigin) risks.push('cross_origin')
        emitSecurityEvent('__CREDENTIAL_THEFT_DETECTED__', {
          formAction: actionUrl.href, targetDomain: actionUrl.hostname,
          method: (form.method || 'GET').toUpperCase(), isSecure, isCrossOrigin,
          fieldType, risks, timestamp: Date.now(),
        })
      }
    } catch {}
  }, true)

  // ===== Clipboard Hijack =====
  const CRYPTO_PATTERNS = {
    bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    ripple: /^r[0-9a-zA-Z]{24,34}$/,
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = function(text) {
      for (const [type, pattern] of Object.entries(CRYPTO_PATTERNS)) {
        if (pattern.test(text)) {
          emitSecurityEvent('__CLIPBOARD_HIJACK_DETECTED__', {
            text: text.substring(0, 20) + '...', cryptoType: type, fullLength: text.length, timestamp: Date.now(),
          })
          break
        }
      }
      return originalWriteText(text)
    }
  }

  // ===== Cookie Access =====
  let lastCookieAccessTime = 0
  try {
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    if (desc?.get) {
      const originalGet = desc.get
      Object.defineProperty(document, 'cookie', {
        get() {
          const now = Date.now()
          if (now - lastCookieAccessTime > 1000) {
            lastCookieAccessTime = now
            emitSecurityEvent('__COOKIE_ACCESS_DETECTED__', { timestamp: now, readCount: 1, pageUrl: window.location.href })
          }
          return originalGet.call(document)
        },
        set: desc.set,
        configurable: true,
      })
    }
  } catch {}

  // ===== XSS / DOM Scraping =====
  let qsaCount = 0, qsaResetTime = Date.now()
  const originalQSA = document.querySelectorAll.bind(document)
  document.querySelectorAll = function(selector) {
    const now = Date.now()
    if (now - qsaResetTime > 5000) { qsaCount = 0; qsaResetTime = now }
    if (++qsaCount === 50) {
      emitSecurityEvent('__DOM_SCRAPING_DETECTED__', { selector, callCount: qsaCount, timestamp: now })
    }
    return originalQSA(selector)
  }

  const XSS_PATTERNS = [/<script[^>]*>[^<]+/i, /javascript:\s*[^"'\s]/i, /on(error|load)\s*=\s*["'][^"']*eval/i, /<iframe[^>]*src\s*=\s*["']?javascript:/i]
  const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  if (innerHTMLDesc?.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      get: innerHTMLDesc.get,
      set(value) {
        if (typeof value === 'string' && XSS_PATTERNS.some(p => p.test(value))) {
          emitSecurityEvent('__XSS_DETECTED__', { type: 'innerHTML', payloadPreview: value.substring(0, 100), timestamp: Date.now() })
        }
        return innerHTMLDesc.set.call(this, value)
      },
      configurable: true,
    })
  }

  // ===== Suspicious Download =====
  const SUSPICIOUS_EXTENSIONS = ['.exe', '.msi', '.bat', '.ps1', '.cmd', '.scr', '.vbs', '.js', '.jar', '.dll']
  const originalCreateObjectURL = URL.createObjectURL
  URL.createObjectURL = function(blob) {
    if (blob instanceof Blob) {
      emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', { type: 'blob', size: blob.size, mimeType: blob.type, timestamp: Date.now() })
    }
    return originalCreateObjectURL.call(this, blob)
  }

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLAnchorElement) || (!target.download && !target.href)) return
    try {
      const href = target.href || ''
      const download = target.download || ''
      if (href.startsWith('blob:') || href.startsWith('data:')) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: href.startsWith('blob:') ? 'blob_link' : 'data_url', filename: download, timestamp: Date.now(),
        })
        return
      }
      const filename = download || href.split('/').pop() || ''
      const ext = '.' + filename.split('.').pop().toLowerCase()
      if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
        emitSecurityEvent('__SUSPICIOUS_DOWNLOAD_DETECTED__', {
          type: 'suspicious_extension', filename, extension: ext, url: href, timestamp: Date.now(),
        })
      }
    } catch {}
  }, true)
})()
