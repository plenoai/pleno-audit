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
}
