/**
 * @fileoverview Fingerprint Detection Hooks
 *
 * Canvas, WebGL, AudioContext, RTCPeerConnection, BroadcastChannel の検出。
 */

import { type SharedHookUtils } from "./shared.js";

export function initFingerprintHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  // Canvas fingerprinting detection
  // Only flag small canvases (<=300x100) typical of fingerprinting probes.
  // Larger canvases are likely legitimate rendering (charts, games, image editing).
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args: Parameters<typeof originalToDataURL>) {
    if (this.width <= 256 && this.height <= 64) {
      emitSecurityEvent("__CANVAS_FINGERPRINT_DETECTED__", { w: this.width, h: this.height, ts: Date.now() });
    }
    return originalToDataURL.apply(this, args);
  };

  // WebGL fingerprinting detection
  // Only alert when 2+ distinct fingerprint params are read within 500ms
  // (single param reads are normal rendering; fingerprinting probes read multiple)
  let originalGetParameter: WebGLRenderingContext["getParameter"] | null = null;
  const webglSeenParams = new Set<number>();
  let webglWindowStart = 0;
  let webglAlertEmitted = false;
  const WEBGL_FP_WINDOW_MS = 500;
  const WEBGL_FP_THRESHOLD = 2;

  function hookWebGLGetParameter(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (!originalGetParameter) {
      originalGetParameter = Object.getPrototypeOf(gl).getParameter;
    }
    Object.getPrototypeOf(gl).getParameter = function (pname: number) {
      // RENDERER(0x1F01), VENDOR(0x1F00), or debug renderer info extension params
      if (!webglAlertEmitted && (pname === 0x1f01 || pname === 0x1f00 || pname === 0x9245 || pname === 0x9246)) {
        const now = Date.now();
        if (now - webglWindowStart > WEBGL_FP_WINDOW_MS) {
          webglSeenParams.clear();
          webglWindowStart = now;
        }
        webglSeenParams.add(pname);
        if (webglSeenParams.size >= WEBGL_FP_THRESHOLD) {
          webglAlertEmitted = true;
          emitSecurityEvent("__WEBGL_FINGERPRINT_DETECTED__", { pname, ts: now });
        }
      }
      return originalGetParameter!.call(this, pname);
    };
  }

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string, ...rest: unknown[]) {
    const ctx = (originalGetContext as Function).apply(this, [contextType, ...rest]);
    if (ctx && (contextType === "webgl" || contextType === "webgl2" || contextType === "experimental-webgl")) {
      hookWebGLGetParameter(ctx as WebGLRenderingContext);
    }
    return ctx;
  } as typeof HTMLCanvasElement.prototype.getContext;

  // AudioContext fingerprinting detection — deduplicated (once per page)
  if (window.AudioContext) {
    const OriginalAudioContext = window.AudioContext;
    let audioContextEmitted = false;
    const NewAudioContext = function (this: AudioContext, options?: AudioContextOptions) {
      if (!audioContextEmitted) {
        audioContextEmitted = true;
        emitSecurityEvent("__AUDIO_FINGERPRINT_DETECTED__", { ts: Date.now() });
      }
      return options !== undefined ? new OriginalAudioContext(options) : new OriginalAudioContext();
    } as unknown as typeof AudioContext;
    NewAudioContext.prototype = OriginalAudioContext.prototype;
    window.AudioContext = NewAudioContext;
  }

  // RTCPeerConnection detection — deduplicated (once per page)
  if (window.RTCPeerConnection) {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    let rtcEmitted = false;
    window.RTCPeerConnection = function (...args: ConstructorParameters<typeof RTCPeerConnection>) {
      if (!rtcEmitted) {
        rtcEmitted = true;
        emitSecurityEvent("__WEBRTC_CONNECTION_DETECTED__", { ts: Date.now() });
      }
      return new OriginalRTCPeerConnection(...args);
    } as unknown as typeof RTCPeerConnection;
    window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
  }

  // BroadcastChannel - widely used for tab sync (login state, theme, settings)
  // Removed to avoid false positives on normal multi-tab applications
}
