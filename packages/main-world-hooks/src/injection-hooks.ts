/**
 * @fileoverview Injection Detection Hooks
 *
 * requestFullscreen, sendBeacon, WASM, device enumeration の検出。
 *
 * === Main World Invariant ===
 * このファイルは MAIN world で実行される。
 * 停止する可能性のある複雑な処理は一切行わない。
 * イベントをフックし、軽量なメタデータのみを queueMicrotask 経由で emit する。
 *
 * === Anti-Tamper Compatibility ===
 * 以下のフックは銀行セキュリティSDK（ZCB等）の改ざん検知に引っかかるため除去:
 * - window.eval — CSP script-src violation で代替検出可能
 * - window.Function — 同上
 * - EventTarget.prototype.addEventListener — プロトタイプ改変は検出対象
 */

import { type SharedHookUtils } from "./shared.js";

function deferEmit(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"], name: string, data: Record<string, unknown>): void {
  queueMicrotask(() => emitSecurityEvent(name, data));
}

export function initInjectionHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  // requestFullscreen - only alert on non-media elements (video/canvas fullscreen is normal)
  const originalRequestFullscreen = Element.prototype.requestFullscreen;
  const FULLSCREEN_SAFE_TAGS = new Set(["VIDEO", "CANVAS", "IFRAME"]);
  if (originalRequestFullscreen) {
    Element.prototype.requestFullscreen = function (options?: FullscreenOptions) {
      if (!FULLSCREEN_SAFE_TAGS.has(this.tagName)) {
        deferEmit(emitSecurityEvent, "__FULLSCREEN_PHISHING_DETECTED__", {
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
      deferEmit(emitSecurityEvent, "__FULLSCREEN_PHISHING_DETECTED__", {
        element: this.tagName,
        elementId: (this as Element).id || null,
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalWebkitFullscreen.apply(this);
    };
  }

  // navigator.sendBeacon (covert exfiltration channel)
  // Only alert on large payloads. Use lightweight size estimation (no Blob allocation).
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
      if (data != null) {
        let estimatedSize = 0;
        if (typeof data === "string") estimatedSize = data.length;
        else if (data instanceof ArrayBuffer) estimatedSize = data.byteLength;
        else if (data instanceof Blob) estimatedSize = data.size;
        if (estimatedSize > 1024) {
          deferEmit(emitSecurityEvent, "__SEND_BEACON_DETECTED__", {
            url: String(url),
            dataSize: estimatedSize,
            timestamp: Date.now(),
            pageUrl: location.href,
          });
        }
      }
      return originalSendBeacon(url, data);
    };
  }

  // navigator.mediaDevices.enumerateDevices (device fingerprinting)
  if (navigator.mediaDevices?.enumerateDevices) {
    const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function () {
      deferEmit(emitSecurityEvent, "__DEVICE_ENUMERATION_DETECTED__", {
        timestamp: Date.now(),
        pageUrl: location.href,
      });
      return originalEnumerateDevices();
    };
  }

  // ===== WebAssembly Instantiation Detection =====
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
          deferEmit(emitSecurityEvent, "__WASM_EXECUTION_DETECTED__", {
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
          deferEmit(emitSecurityEvent, "__WASM_EXECUTION_DETECTED__", {
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
  }

}
