/**
 * @fileoverview Shared Hook Utilities
 *
 * main-worldフック間で共有されるユーティリティ。
 * api-hooks.ts で初期化され、window.__PLENO_HOOKS_SHARED__ に格納される。
 *
 * === Main World Invariant ===
 * このファイルは MAIN world で実行される。
 * 停止する可能性のある複雑な処理（Blob生成, JSON.stringify等）は一切同期実行しない。
 * 全ての重い処理は requestIdleCallback/setTimeout 内で遅延実行する。
 */

declare global {
  interface Window {
    __PLENO_HOOKS_SHARED__?: SharedHookUtils;
    __SERVICE_DETECTION_CSP_INITIALIZED__?: boolean;
    __PLENO_FINGERPRINT_HOOKS_INITIALIZED__?: boolean;
    __PLENO_INJECTION_HOOKS_INITIALIZED__?: boolean;
    __PLENO_WEBSOCKET_HOOKS_INITIALIZED__?: boolean;
    __PLENO_WORKER_HOOKS_INITIALIZED__?: boolean;
  }
}

export interface SharedHookUtils {
  emitSecurityEvent: (eventName: string, data: Record<string, unknown>) => void;
  getBodySize: (body: unknown) => number;
  scheduleNetworkInspection: (params: {
    url: string;
    method: string;
    initiator: string;
    body: unknown;
    pageUrl: string;
  }) => void;
}

const INSPECTION_BODY_SAMPLE_LIMIT = 4096;

function emitSecurityEvent(eventName: string, data: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
}

/**
 * Lightweight body size estimation — no Blob allocation, no iteration.
 * Used for synchronous hot-path only. Exact size is not needed.
 */
export function getBodySize(body: unknown): number {
  if (!body) return 0;
  if (typeof body === "string") return body.length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  // URLSearchParams, FormData, ReadableStream — cannot estimate without allocation
  return 0;
}

/**
 * Body sample extraction — called only in deferred context (requestIdleCallback).
 */
export function getBodySample(body: unknown): string {
  if (!body) return "";
  if (typeof body === "string") return body.slice(0, INSPECTION_BODY_SAMPLE_LIMIT);
  if (body instanceof URLSearchParams) return body.toString().slice(0, INSPECTION_BODY_SAMPLE_LIMIT);
  if (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return "";
  if (body instanceof FormData) {
    let text = "";
    for (const [key, value] of body.entries()) {
      text += typeof value === "string" ? `${key}=${value}&` : `${key}=[binary]&`;
      if (text.length >= INSPECTION_BODY_SAMPLE_LIMIT) return text.slice(0, INSPECTION_BODY_SAMPLE_LIMIT);
    }
    return text;
  }
  // Avoid JSON.stringify on arbitrary objects — could be slow or throw
  return "";
}

function scheduleNetworkInspection(params: {
  url: string;
  method: string;
  initiator: string;
  body: unknown;
  pageUrl: string;
}): void {
  const normalizedMethod = (params.method || "GET").toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") return;

  // Capture only lightweight metadata synchronously
  const basePayload = {
    url: params.url,
    method: normalizedMethod,
    initiator: params.initiator,
    pageUrl: params.pageUrl,
    timestamp: Date.now(),
  };

  // ALL heavy processing deferred to idle time
  const dispatch = () => {
    const bodySize = getBodySize(params.body);
    const bodySample = getBodySample(params.body);
    const payload = { ...basePayload, bodySize };
    emitSecurityEvent(
      "__NETWORK_INSPECTION_REQUEST__",
      bodySample ? { ...payload, bodySample } : payload,
    );
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => dispatch(), { timeout: 300 });
    return;
  }
  setTimeout(dispatch, 0);
}

export function createSharedHookUtils(): SharedHookUtils {
  return { emitSecurityEvent, getBodySize, scheduleNetworkInspection };
}

export function getSharedHooks(): SharedHookUtils {
  if (!window.__PLENO_HOOKS_SHARED__) {
    window.__PLENO_HOOKS_SHARED__ = createSharedHookUtils();
  }
  return window.__PLENO_HOOKS_SHARED__;
}

export { emitSecurityEvent };
