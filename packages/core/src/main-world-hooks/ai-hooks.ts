/**
 * @fileoverview AI Prompt Capture Hooks
 *
 * fetch/XHR/Beaconをインターセプトし、AIサービスへのリクエストを検出・記録する。
 *
 * === Main World Invariant ===
 * このファイルは MAIN world で実行される。
 * 停止する可能性のある複雑な処理（JSON.parse, regex, Blob生成等）は一切行わない。
 * イベントをフックし、軽量なメタデータのみをemitする。
 * 重い解析はbackground側で行う。
 */

import { type SharedHookUtils } from "./shared.js";

const MAX_BODY_SAMPLE = 10000;

// ===== Lightweight AI URL Detection =====
// string.includes による O(n) 判定。regex/JSON.parse は使わない。
export const AI_URL_MARKERS = [
  "api.openai.com",
  "chatgpt.com/backend-api",
  "api.anthropic.com",
  "claude.ai/api",
  "generativelanguage.googleapis.com",
  "aiplatform.googleapis.com",
  ".openai.azure.com",
  "api.cohere.ai",
  "api.cohere.com",
  "api-inference.huggingface.co",
  "openrouter.ai/api",
  "api.together.xyz",
  "api.fireworks.ai",
  "api.mistral.ai",
  "api.perplexity.ai",
  "api.groq.com",
  "api.deepseek.com",
  "/v1/chat/completions",
  "/v1/completions",
  "/v1/messages",
];

export function isLikelyAIUrl(url: string): boolean {
  for (let i = 0; i < AI_URL_MARKERS.length; i++) {
    if (url.includes(AI_URL_MARKERS[i])) return true;
  }
  return false;
}

export function getBodySample(body: unknown): string | undefined {
  if (typeof body === "string") return body.length <= MAX_BODY_SAMPLE ? body : body.substring(0, MAX_BODY_SAMPLE);
  return undefined;
}

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => fn(), { timeout: 3000 });
  } else {
    setTimeout(fn, 0);
  }
}

export function initAIHooks(shared: SharedHookUtils): void {
  const { emitSecurityEvent, scheduleNetworkInspection } = shared;
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

  // ===== FETCH =====
  window.fetch = function (this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    const isRequest = typeof input === "object" && "url" in input;
    const url = typeof input === "string" ? input : (input as Request)?.url;
    const method = init?.method || (isRequest ? (input as Request).method : "GET") || "GET";
    const body = init?.body;
    const hasBody = body || (isRequest && !(input as Request).bodyUsed);

    // Schedule deferred network inspection (already uses requestIdleCallback)
    if (url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: method.toUpperCase(), initiator: "fetch", body, pageUrl: window.location.href });
      } catch { /* invalid URL */ }
    }

    // Clone Request body BEFORE calling original fetch (which consumes it)
    let bodyTextPromise: Promise<string | undefined> | undefined;
    if (hasBody && method.toUpperCase() !== "GET" && url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        if (isLikelyAIUrl(fullUrl)) {
          const bodySample = getBodySample(body);
          if (bodySample) {
            bodyTextPromise = Promise.resolve(bodySample);
          } else if (isRequest) {
            // Request object: clone to read body without consuming original
            try {
              const clonedReq = (input as Request).clone();
              bodyTextPromise = clonedReq.text().then(
                (t) => t.length <= MAX_BODY_SAMPLE ? t : t.substring(0, MAX_BODY_SAMPLE),
                () => undefined,
              );
            } catch { /* clone failed */ }
          }
        }
      } catch { /* ignore URL parse error */ }
    }

    // Call original IMMEDIATELY — return unmodified Promise
    const result = originalFetch.apply(this, [input, init] as unknown as [RequestInfo | URL, RequestInit | undefined]);

    // Side-effect: deferred AI capture for likely AI URLs
    if (bodyTextPromise && url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        const startTime = Date.now();
        // Register side-effect .then() — does NOT wrap the returned promise
        result.then((response) => {
          try {
            const clone = response.clone();
            const contentType = response.headers.get("content-type") || "";
            scheduleIdle(() => {
              Promise.all([bodyTextPromise, clone.text().catch(() => undefined)]).then(([reqBody, resText]) => {
                emitSecurityEvent("__AI_PROMPT_CAPTURED__", {
                  id: crypto.randomUUID(),
                  timestamp: startTime,
                  pageUrl: window.location.href,
                  apiEndpoint: fullUrl,
                  method: method.toUpperCase(),
                  rawRequestBody: reqBody,
                  rawResponseBody: resText && (resText.length <= MAX_BODY_SAMPLE ? resText : resText.substring(0, MAX_BODY_SAMPLE)),
                  rawResponseContentType: contentType,
                  responseTimestamp: Date.now(),
                });
              }).catch(() => { /* ignore */ });
            });
          } catch { /* ignore clone/read errors */ }
        }).catch(() => { /* ignore fetch errors in side effect */ });
      } catch { /* ignore URL parse error */ }
    }

    return result;
  };

  // ===== XHR =====
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __aiHookUrl: string | URL }).__aiHookUrl = url;
    (this as XMLHttpRequest & { __aiHookMethod: string }).__aiHookMethod = method;
    return (originalXHROpen as Function).call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as XMLHttpRequest & { __aiHookUrl: string | URL; __aiHookMethod: string };
    const xhrUrl = xhr.__aiHookUrl;
    const xhrMethod = (xhr.__aiHookMethod || "GET").toUpperCase();

    // Schedule deferred network inspection
    if (xhrUrl) {
      try {
        const fullUrl = new URL(xhrUrl, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: xhrMethod, initiator: "xhr", body, pageUrl: window.location.href });
      } catch { /* invalid URL */ }
    }

    // Side-effect: deferred AI capture
    if (body && xhrMethod !== "GET" && xhrUrl) {
      try {
        const fullUrl = new URL(xhrUrl, window.location.origin).href;
        if (isLikelyAIUrl(fullUrl)) {
          const bodySample = getBodySample(body);
          const startTime = Date.now();
          const originalOnReadyStateChange = xhr.onreadystatechange;
          xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
            if (this.readyState === 4) {
              scheduleIdle(() => {
                try {
                  const responseText = this.responseText;
                  const contentType = this.getResponseHeader("content-type") || "";
                  emitSecurityEvent("__AI_PROMPT_CAPTURED__", {
                    id: crypto.randomUUID(),
                    timestamp: startTime,
                    pageUrl: window.location.href,
                    apiEndpoint: fullUrl,
                    method: xhrMethod,
                    rawRequestBody: bodySample,
                    rawResponseBody: responseText && responseText.length <= MAX_BODY_SAMPLE
                      ? responseText : responseText?.substring(0, MAX_BODY_SAMPLE),
                    rawResponseContentType: contentType,
                    responseTimestamp: Date.now(),
                  });
                } catch { /* ignore */ }
              });
            }
            if (originalOnReadyStateChange) originalOnReadyStateChange.call(this, ev);
          };
        }
      } catch { /* ignore */ }
    }

    return originalXHRSend.call(this, body);
  };

  // ===== Beacon =====
  if (originalSendBeacon) {
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: "POST", initiator: "beacon", body: data, pageUrl: window.location.href });
      } catch { /* invalid URL */ }
      return originalSendBeacon(url, data);
    };
  }
}
