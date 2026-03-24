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

  // requestFullscreen
  const originalRequestFullscreen = Element.prototype.requestFullscreen;
  if (originalRequestFullscreen) {
    Element.prototype.requestFullscreen = function (options?: FullscreenOptions) {
      emitSecurityEvent("__FULLSCREEN_PHISHING_DETECTED__", {
        element: this.tagName,
        elementId: this.id || null,
        className: this.className || null,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
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
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
      emitSecurityEvent("__SEND_BEACON_DETECTED__", {
        url: String(url),
        dataSize: data ? new Blob([data as BlobPart]).size : 0,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
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

  // Notification API (phishing)
  if (typeof Notification !== "undefined") {
    const OriginalNotification = Notification;
    window.Notification = function (title: string, options?: NotificationOptions) {
      emitSecurityEvent("__NOTIFICATION_PHISHING_DETECTED__", {
        title,
        body: options?.body?.substring(0, 200) ?? "",
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return new OriginalNotification(title, options);
    } as unknown as typeof Notification;
    Object.setPrototypeOf(window.Notification, OriginalNotification);
    Object.defineProperty(window.Notification, "permission", {
      get: () => OriginalNotification.permission,
    });
    window.Notification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
  }

  // geolocation
  if (navigator.geolocation) {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = function (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) {
      emitSecurityEvent("__GEOLOCATION_ACCESSED__", {
        method: "getCurrentPosition",
        highAccuracy: options?.enableHighAccuracy || false,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalGetCurrentPosition(success, error ?? undefined, options);
    };

    const originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    navigator.geolocation.watchPosition = function (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) {
      emitSecurityEvent("__GEOLOCATION_ACCESSED__", {
        method: "watchPosition",
        highAccuracy: options?.enableHighAccuracy || false,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalWatchPosition(success, error ?? undefined, options);
    };
  }

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
  // Clipboard event sniffing (copy/cut/paste) — Red iter8 attack
  const clipboardSniffEvents = new Set(["copy", "cut", "paste"]);
  // Drag-and-drop data theft (dragstart/drop) — Red iter8 attack
  const dragSniffEvents = new Set(["dragstart", "drop"]);
  // Selection API keylogging (selectionchange) — Red iter7 attack
  const selectionSniffEvents = new Set(["selectionchange"]);
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
      emitSecurityEvent("__CLIPBOARD_EVENT_SNIFFING_DETECTED__", {
        eventType: type,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
    } else if (dragSniffEvents.has(type)) {
      emitSecurityEvent("__DRAG_EVENT_SNIFFING_DETECTED__", {
        eventType: type,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
    } else if (selectionSniffEvents.has(type)) {
      emitSecurityEvent("__SELECTION_SNIFFING_DETECTED__", {
        eventType: type,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
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

  // PerformanceObserver side channel (resource timing exfiltration)
  if (typeof PerformanceObserver !== "undefined") {
    const OriginalPerformanceObserver = PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of PerformanceObserver
    (window as any).PerformanceObserver = function (this: unknown, callback: PerformanceObserverCallback) {
      const instance = new OriginalPerformanceObserver(callback);
      const originalObserve = instance.observe.bind(instance);
      instance.observe = function (options?: PerformanceObserverInit) {
        const entryTypes: string[] = options?.entryTypes ?? (options?.type ? [options.type] : []);
        if (entryTypes.includes("resource") || entryTypes.includes("navigation")) {
          emitSecurityEvent("__PERFORMANCE_OBSERVER_DETECTED__", {
            entryType: entryTypes.join(","),
            timestamp: Date.now(),
            pageUrl: location.href,
          });
        }
        return originalObserve(options);
      };
      return instance;
    } as unknown as typeof PerformanceObserver;
    (window as any).PerformanceObserver.prototype = OriginalPerformanceObserver.prototype;
    (window as any).PerformanceObserver.supportedEntryTypes = OriginalPerformanceObserver.supportedEntryTypes;
  }

  // ===== WebAssembly Instantiation Detection =====
  // Detects WebAssembly.instantiate/compile — WASM is used for obfuscated exploit payloads and covert computation.
  if (typeof WebAssembly !== "undefined") {
    if (typeof WebAssembly.instantiate === "function") {
      const originalInstantiate = WebAssembly.instantiate;
      WebAssembly.instantiate = function (
        bufferSourceOrModule: BufferSource | WebAssembly.Module,
        importObject?: WebAssembly.Imports,
      ): Promise<WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance> {
        const isBinary = bufferSourceOrModule instanceof ArrayBuffer
          || ArrayBuffer.isView(bufferSourceOrModule);
        emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
          method: "instantiate",
          isBinary,
          byteLength: isBinary
            ? (bufferSourceOrModule instanceof ArrayBuffer
                ? bufferSourceOrModule.byteLength
                : (bufferSourceOrModule as ArrayBufferView).byteLength)
            : null,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of WebAssembly.instantiate
        return originalInstantiate(bufferSourceOrModule as any, importObject as any);
      };
    }

    if (typeof WebAssembly.compile === "function") {
      const originalCompile = WebAssembly.compile;
      WebAssembly.compile = function (bytes: BufferSource): Promise<WebAssembly.Module> {
        emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
          method: "compile",
          isBinary: true,
          byteLength: bytes instanceof ArrayBuffer
            ? bytes.byteLength
            : (bytes as ArrayBufferView).byteLength,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        return originalCompile(bytes);
      };
    }

    if (typeof WebAssembly.instantiateStreaming === "function") {
      const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
      WebAssembly.instantiateStreaming = function (
        source: Response | PromiseLike<Response>,
        importObject?: WebAssembly.Imports,
      ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
        emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
          method: "instantiateStreaming",
          isBinary: false,
          byteLength: null,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        return originalInstantiateStreaming(source, importObject);
      };
    }

    if (typeof WebAssembly.compileStreaming === "function") {
      const originalCompileStreaming = WebAssembly.compileStreaming;
      WebAssembly.compileStreaming = function (
        source: Response | PromiseLike<Response>,
      ): Promise<WebAssembly.Module> {
        emitSecurityEvent("__WASM_EXECUTION_DETECTED__", {
          method: "compileStreaming",
          isBinary: false,
          byteLength: null,
          timestamp: Date.now(),
          pageUrl: location.href,
        });
        return originalCompileStreaming(source);
      };
    }
  }

  // postMessage cross-origin exfiltration (outgoing)
  const originalPostMessage = window.postMessage.bind(window);
  window.postMessage = function (message: unknown, targetOriginOrOptions: string | WindowPostMessageOptions, transfer?: Transferable[]) {
    const targetOrigin = typeof targetOriginOrOptions === "string"
      ? targetOriginOrOptions
      : (targetOriginOrOptions as WindowPostMessageOptions).targetOrigin ?? "*";
    const isCrossOrigin = targetOrigin !== window.location.origin && targetOrigin !== "/";
    if (isCrossOrigin) {
      emitSecurityEvent("__POSTMESSAGE_EXFIL_DETECTED__", {
        targetOrigin,
        direction: "outgoing",
        timestamp: Date.now(),
        pageUrl: location.href,
      });
    }
    return transfer !== undefined
      ? originalPostMessage(message, targetOriginOrOptions as string, transfer)
      : originalPostMessage(message, targetOriginOrOptions as string);
  };

  // postMessage cross-origin exfiltration (incoming from iframes/popups)
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== window.location.origin && event.origin !== "") {
      emitSecurityEvent("__POSTMESSAGE_EXFIL_DETECTED__", {
        targetOrigin: event.origin,
        direction: "incoming",
        timestamp: Date.now(),
        pageUrl: location.href,
      });
    }
  });

  // ===== MessageChannel Covert Communication Detection =====
  if (typeof MessageChannel !== "undefined") {
    const OriginalMessageChannel = MessageChannel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of MessageChannel constructor
    (window as any).MessageChannel = function (this: unknown) {
      emitSecurityEvent("__MESSAGE_CHANNEL_DETECTED__", {
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return new OriginalMessageChannel();
    } as unknown as typeof MessageChannel;
    (window as any).MessageChannel.prototype = OriginalMessageChannel.prototype;
  }

  // ===== ResizeObserver Device Fingerprinting Detection =====
  if (typeof ResizeObserver !== "undefined") {
    const OriginalResizeObserver = ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of ResizeObserver constructor
    (window as any).ResizeObserver = function (
      this: unknown,
      callback: ResizeObserverCallback,
    ) {
      emitSecurityEvent("__RESIZE_OBSERVER_DETECTED__", {
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return new OriginalResizeObserver(callback);
    } as unknown as typeof ResizeObserver;
    (window as any).ResizeObserver.prototype = OriginalResizeObserver.prototype;
  }

  // ===== EventSource Covert C2 Channel Detection =====
  // EventSource is used for server-sent events and can serve as a covert C2 (command-and-control) channel.
  if (typeof EventSource !== "undefined") {
    const OriginalEventSource = EventSource;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch of EventSource constructor
    (window as any).EventSource = function (this: unknown, url: string | URL, eventSourceInitDict?: EventSourceInit) {
      emitSecurityEvent("__EVENTSOURCE_DETECTED__", {
        url: String(url),
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return new OriginalEventSource(url, eventSourceInitDict);
    } as unknown as typeof EventSource;
    (window as any).EventSource.prototype = OriginalEventSource.prototype;
    (window as any).EventSource.CONNECTING = OriginalEventSource.CONNECTING;
    (window as any).EventSource.OPEN = OriginalEventSource.OPEN;
    (window as any).EventSource.CLOSED = OriginalEventSource.CLOSED;
  }

  // ===== FontFace API Fingerprinting Detection =====
  // document.fonts.check() called repeatedly is used to fingerprint installed fonts.
  if (typeof document !== "undefined" && document.fonts && typeof document.fonts.check === "function") {
    const originalFontCheck = document.fonts.check.bind(document.fonts);
    let fontCheckCount = 0;
    let fontCheckWindowStart = 0;
    let fontFingerprintEmitted = false;
    document.fonts.check = function (font: string, text?: string) {
      const now = Date.now();
      if (now - fontCheckWindowStart > 1000) {
        fontCheckCount = 0;
        fontCheckWindowStart = now;
        fontFingerprintEmitted = false;
      }
      fontCheckCount++;
      if (!fontFingerprintEmitted && fontCheckCount > 3) {
        fontFingerprintEmitted = true;
        emitSecurityEvent("__FONT_FINGERPRINT_DETECTED__", {
          callCount: fontCheckCount,
          timestamp: now,
          pageUrl: location.href,
        });
      }
      return originalFontCheck(font, text);
    };
  }

  // ===== requestIdleCallback Timing Side Channel Detection =====
  // Rapid chained requestIdleCallback calls are used as a timing side channel to infer CPU activity.
  if (typeof window.requestIdleCallback === "function") {
    const originalRequestIdleCallback = window.requestIdleCallback;
    let idleCallbackCount = 0;
    let idleCallbackWindowStart = 0;
    let idleCallbackEmitted = false;
    window.requestIdleCallback = function (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ): number {
      const now = Date.now();
      if (now - idleCallbackWindowStart > 2000) {
        idleCallbackCount = 0;
        idleCallbackWindowStart = now;
        idleCallbackEmitted = false;
      }
      idleCallbackCount++;
      if (!idleCallbackEmitted && idleCallbackCount > 3) {
        idleCallbackEmitted = true;
        emitSecurityEvent("__IDLE_CALLBACK_DETECTED__", {
          callCount: idleCallbackCount,
          timestamp: now,
          pageUrl: location.href,
        });
      }
      return originalRequestIdleCallback(callback, options);
    };
  }

  // ===== IntersectionObserver Surveillance Detection =====
  // Hook prototype.observe() instead of constructor (Chromium prevents constructor override)
  if (typeof IntersectionObserver !== "undefined" && IntersectionObserver.prototype.observe) {
    const originalObserve = IntersectionObserver.prototype.observe;
    IntersectionObserver.prototype.observe = function (target: Element) {
      emitSecurityEvent("__INTERSECTION_OBSERVER_DETECTED__", {
        observedCount: 1,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalObserve.call(this, target);
    };
  }
}
