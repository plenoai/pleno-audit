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
}
