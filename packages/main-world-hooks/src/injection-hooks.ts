/**
 * @fileoverview Injection Detection Hooks
 *
 * eval, Function constructor, requestFullscreen, clipboard read, geolocation の検出。
 */

import { type SharedHookUtils } from "./shared.js";

export function initInjectionHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  // eval()
  const originalEval = window.eval;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of eval
  window.eval = function (this: unknown, code: string) {
    emitSecurityEvent("__DYNAMIC_CODE_EXECUTION_DETECTED__", {
      method: "eval",
      codeLength: typeof code === "string" ? code.length : 0,
      codeSample: typeof code === "string" ? code.substring(0, 200) : "",
      timestamp: Date.now(),
      pageUrl: location.href,
    });
    return originalEval.call(this as any, code);
  } as typeof eval;

  // Function constructor
  const OriginalFunction = window.Function;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of Function constructor
  window.Function = function (this: unknown, ...args: string[]) {
    const body = args.length > 0 ? args[args.length - 1] : "";
    emitSecurityEvent("__DYNAMIC_CODE_EXECUTION_DETECTED__", {
      method: "Function",
      codeLength: typeof body === "string" ? body.length : 0,
      codeSample: typeof body === "string" ? body.substring(0, 200) : "",
      argCount: args.length,
      timestamp: Date.now(),
      pageUrl: location.href,
    });
    return OriginalFunction.apply(this as any, args);
  } as FunctionConstructor;
  (window.Function as any).prototype = OriginalFunction.prototype;

  // requestFullscreen - only alert on non-media elements (video/canvas fullscreen is normal)
  const originalRequestFullscreen = Element.prototype.requestFullscreen;
  const FULLSCREEN_SAFE_TAGS = new Set(["VIDEO", "CANVAS", "IFRAME"]);
  if (originalRequestFullscreen) {
    Element.prototype.requestFullscreen = function (options?: FullscreenOptions) {
      if (!FULLSCREEN_SAFE_TAGS.has(this.tagName)) {
        emitSecurityEvent("__FULLSCREEN_PHISHING_DETECTED__", {
          element: this.tagName,
          elementId: this.id || null,
          className: this.className || null,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
      }
      return originalRequestFullscreen.call(this, options);
    };
  }
  // Webkit prefix
  const el = Element.prototype as Element & { webkitRequestFullscreen?: () => void };
  if (el.webkitRequestFullscreen) {
    const originalWebkitFullscreen = el.webkitRequestFullscreen;
    el.webkitRequestFullscreen = function () {
      emitSecurityEvent("__FULLSCREEN_PHISHING_DETECTED__", {
        element: this.tagName,
        elementId: (this as Element).id || null,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalWebkitFullscreen.apply(this);
    };
  }

  // clipboard.readText
  if (navigator.clipboard && navigator.clipboard.readText) {
    const originalReadText = navigator.clipboard.readText.bind(navigator.clipboard);
    navigator.clipboard.readText = function () {
      emitSecurityEvent("__CLIPBOARD_READ_DETECTED__", {
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalReadText();
    };
  }

  // navigator.sendBeacon (covert exfiltration channel)
  // Only alert on large payloads (>1KB) to avoid false positives from analytics
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
      const dataSize = data ? new Blob([data as BlobPart]).size : 0;
      if (dataSize > 1024) {
        emitSecurityEvent("__SEND_BEACON_DETECTED__", {
          url: String(url),
          dataSize,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
      }
      return originalSendBeacon(url, data);
    };
  }

  // getUserMedia / getDisplayMedia (media capture)
  if (navigator.mediaDevices) {
    if (navigator.mediaDevices.getUserMedia) {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (constraints?: MediaStreamConstraints) {
        emitSecurityEvent("__MEDIA_CAPTURE_DETECTED__", {
          method: "getUserMedia",
          audio: !!constraints?.audio,
          video: !!constraints?.video,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        return originalGetUserMedia(constraints);
      };
    }
    if (navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = function (constraints?: DisplayMediaStreamOptions) {
        emitSecurityEvent("__MEDIA_CAPTURE_DETECTED__", {
          method: "getDisplayMedia",
          audio: !!constraints?.audio,
          video: true,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        return originalGetDisplayMedia(constraints);
      };
    }
  }

  // Notification API - browser already requires permission grant, no need for extension alert
  // Removed to avoid false positives on chat/email apps

  // geolocation - browser already shows permission dialog, no need for extension alert
  // Removed to avoid false positives on map/weather apps

  // Credential Management API (phishing/harvesting)
  if (navigator.credentials?.get) {
    const originalCredentialsGet = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = function (options?: CredentialRequestOptions) {
      emitSecurityEvent("__CREDENTIAL_API_DETECTED__", {
        method: "get",
        hasPassword: !!(options as Record<string, unknown>)?.password,
        hasFederated: !!(options as Record<string, unknown>)?.federated,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalCredentialsGet(options);
    };
  }

  // DeviceMotion / DeviceOrientation (sensor fingerprinting)
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const sensorEvents = new Set(["devicemotion", "deviceorientation"]);
  // Clipboard event sniffing (copy/cut/paste) — only emit on rapid succession (>10 in 5s)
  const clipboardSniffEvents = new Set(["copy", "cut", "paste"]);
  // Drag-and-drop data theft (dragstart/drop) — only emit on rapid succession (>10 in 5s)
  const dragSniffEvents = new Set(["dragstart", "drop"]);
  // Selection API keylogging (selectionchange) — only emit on rapid succession (>10 in 5s)
  const selectionSniffEvents = new Set(["selectionchange"]);

  // Rate-limiting state for sniff events: only alert on rapid bursts (>10 registrations in 5s)
  const SNIFF_BURST_WINDOW_MS = 5000;
  const SNIFF_BURST_THRESHOLD = 10;
  let clipboardSniffCount = 0; let clipboardSniffWindowStart = 0; let clipboardSniffEmitted = false;
  let dragSniffCount = 0; let dragSniffWindowStart = 0; let dragSniffEmitted = false;
  let selectionSniffCount = 0; let selectionSniffWindowStart = 0; let selectionSniffEmitted = false;

  function checkSniffBurst(
    now: number,
    count: number,
    windowStart: number,
    emitted: boolean,
  ): { count: number; windowStart: number; emitted: boolean; shouldEmit: boolean } {
    if (now - windowStart > SNIFF_BURST_WINDOW_MS) {
      count = 0;
      windowStart = now;
      emitted = false;
    }
    count++;
    const shouldEmit = !emitted && count > SNIFF_BURST_THRESHOLD;
    return { count, windowStart, emitted: emitted || shouldEmit, shouldEmit };
  }

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (sensorEvents.has(type)) {
      emitSecurityEvent("__DEVICE_SENSOR_ACCESSED__", {
        sensorType: type,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
    } else if (clipboardSniffEvents.has(type)) {
      const now = Date.now();
      const result = checkSniffBurst(now, clipboardSniffCount, clipboardSniffWindowStart, clipboardSniffEmitted);
      clipboardSniffCount = result.count; clipboardSniffWindowStart = result.windowStart; clipboardSniffEmitted = result.emitted;
      if (result.shouldEmit) {
        emitSecurityEvent("__CLIPBOARD_EVENT_SNIFFING_DETECTED__", {
          eventType: type,
          burstCount: clipboardSniffCount,
          timestamp: now,
          pageUrl: location.href,
        });
      }
    } else if (dragSniffEvents.has(type)) {
      const now = Date.now();
      const result = checkSniffBurst(now, dragSniffCount, dragSniffWindowStart, dragSniffEmitted);
      dragSniffCount = result.count; dragSniffWindowStart = result.windowStart; dragSniffEmitted = result.emitted;
      if (result.shouldEmit) {
        emitSecurityEvent("__DRAG_EVENT_SNIFFING_DETECTED__", {
          eventType: type,
          burstCount: dragSniffCount,
          timestamp: now,
          pageUrl: location.href,
        });
      }
    } else if (selectionSniffEvents.has(type)) {
      const now = Date.now();
      const result = checkSniffBurst(now, selectionSniffCount, selectionSniffWindowStart, selectionSniffEmitted);
      selectionSniffCount = result.count; selectionSniffWindowStart = result.windowStart; selectionSniffEmitted = result.emitted;
      if (result.shouldEmit) {
        emitSecurityEvent("__SELECTION_SNIFFING_DETECTED__", {
          eventType: type,
          burstCount: selectionSniffCount,
          timestamp: now,
          pageUrl: location.href,
        });
      }
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // navigator.mediaDevices.enumerateDevices (device fingerprinting)
  if (navigator.mediaDevices?.enumerateDevices) {
    const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function () {
      emitSecurityEvent("__DEVICE_ENUMERATION_DETECTED__", {
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalEnumerateDevices();
    };
  }

  // ===== WebAssembly Instantiation Detection =====
  // Only alert for large modules (>1MB) to avoid false positives from legitimate WASM usage.
  // Small WASM modules are common in normal web apps (e.g., image codecs, crypto primitives).
  // Large modules >1MB are a strong signal of obfuscated exploit payloads or covert computation.
  const WASM_SIZE_THRESHOLD = 1024 * 1024; // 1MB
  if (typeof WebAssembly !== "undefined") {
    if (typeof WebAssembly.instantiate === "function") {
      const originalInstantiate = WebAssembly.instantiate;
      WebAssembly.instantiate = function (
        bufferSourceOrModule: BufferSource | WebAssembly.Module,
        importObject?: WebAssembly.Imports,
      ): Promise<WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance> {
        const isBinary = bufferSourceOrModule instanceof ArrayBuffer
          || ArrayBuffer.isView(bufferSourceOrModule);
        const byteLength = isBinary
          ? (bufferSourceOrModule instanceof ArrayBuffer
              ? bufferSourceOrModule.byteLength
              : (bufferSourceOrModule as ArrayBufferView).byteLength)
          : null;
        if (byteLength !== null && byteLength > WASM_SIZE_THRESHOLD) {
          emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
            method: "instantiate",
            isBinary,
            byteLength,
            timestamp: Date.now(),
            pageUrl: location.href,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of WebAssembly.instantiate
        return originalInstantiate(bufferSourceOrModule as any, importObject as any);
      };
    }

    if (typeof WebAssembly.compile === "function") {
      const originalCompile = WebAssembly.compile;
      WebAssembly.compile = function (bytes: BufferSource): Promise<WebAssembly.Module> {
        const byteLength = bytes instanceof ArrayBuffer
          ? bytes.byteLength
          : (bytes as ArrayBufferView).byteLength;
        if (byteLength > WASM_SIZE_THRESHOLD) {
          emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
            method: "compile",
            isBinary: true,
            byteLength,
            timestamp: Date.now(),
            pageUrl: location.href,
          });
        }
        return originalCompile(bytes);
      };
    }

    // instantiateStreaming/compileStreaming: byte size not known upfront — skip to avoid false positives.
  }

}
