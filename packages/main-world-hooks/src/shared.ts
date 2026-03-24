/**
 * @fileoverview Shared Hook Utilities
 *
 * main-worldフック間で共有されるユーティリティ。
 * api-hooks.ts で初期化され、window.__PLENO_HOOKS_SHARED__ に格納される。
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

function getBodySize(body: unknown): number {
  if (!body) return 0;
  if (typeof body === "string") return new Blob([body]).size;
  if (body instanceof URLSearchParams) return new Blob([body.toString()]).size;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof FormData) {
    let size = 0;
    for (const [key, value] of body.entries()) {
      size += key.length;
      if (typeof value === "string") size += value.length;
      else if (value instanceof Blob) size += value.size;
    }
    return size;
  }
  return 0;
}

function getBodySample(body: unknown): string {
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
  if (typeof body === "object" && body !== null && body.constructor === Object) {
    try {
      return JSON.stringify(body).slice(0, INSPECTION_BODY_SAMPLE_LIMIT);
    } catch {
      return "";
    }
  }
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

  const payload = {
    url: params.url,
    method: normalizedMethod,
    initiator: params.initiator,
    pageUrl: params.pageUrl,
    timestamp: Date.now(),
    bodySize: getBodySize(params.body),
  };

  const dispatch = () => {
    const bodySample = getBodySample(params.body);
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
