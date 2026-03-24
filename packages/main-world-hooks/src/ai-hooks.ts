/**
 * @fileoverview AI Prompt Capture Hooks
 *
 * fetch/XHR/Beaconをインターセプトし、AIサービスへのリクエストを検出・記録する。
 */

import { type SharedHookUtils } from "./shared.js";

const MAX_CONTENT_SIZE = 50000;
const TRUNCATE_SIZE = 10000;

function truncateString(str: string, maxLength: number): string {
  return str.length <= maxLength ? str : str.substring(0, maxLength);
}

function isMessagesArray(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.some(
    (m) =>
      m &&
      typeof m === "object" &&
      ((typeof m.role === "string" && ("content" in m || "parts" in m)) ||
        (m.author && typeof m.author.role === "string" && m.content && Array.isArray(m.content.parts))),
  );
}

function isGeminiContents(contents: unknown): boolean {
  if (!Array.isArray(contents) || contents.length === 0) return false;
  return contents.some(
    (c) =>
      c &&
      typeof c === "object" &&
      "parts" in c &&
      Array.isArray(c.parts) &&
      c.parts.some((p: unknown) => p && typeof p === "object" && "text" in (p as Record<string, unknown>)),
  );
}

function isChatGPTConversation(obj: Record<string, unknown>): boolean {
  if (
    typeof obj.action === "string" &&
    ["next", "variant", "continue"].includes(obj.action as string) &&
    typeof obj.conversation_id === "string"
  )
    return true;
  if (typeof obj.action === "string" && obj.action === "next" && Array.isArray(obj.messages)) return true;
  return false;
}

function isAIRequestBody(body: unknown): boolean {
  if (!body) return false;
  try {
    const obj = typeof body === "string" ? JSON.parse(body) : body;
    if (!obj || typeof obj !== "object") return false;
    if (isMessagesArray(obj.messages)) return true;
    if (typeof obj.prompt === "string" && typeof obj.model === "string") return true;
    if (isGeminiContents(obj.contents)) return true;
    if (isChatGPTConversation(obj as Record<string, unknown>)) return true;
    return false;
  } catch {
    return false;
  }
}

function extractMessageContent(message: Record<string, unknown>): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((c: unknown) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && (c as Record<string, unknown>).type === "text" && typeof (c as Record<string, unknown>).text === "string")
          return (c as Record<string, string>).text;
        return "";
      })
      .join("");
  }
  if (
    message.content &&
    typeof message.content === "object" &&
    Array.isArray((message.content as Record<string, unknown>).parts)
  ) {
    return ((message.content as Record<string, unknown>).parts as unknown[])
      .map((p) => (typeof p === "string" ? p : (p as Record<string, string>)?.text || ""))
      .join("");
  }
  if (typeof message.text === "string") return message.text;
  return "";
}

function extractPrompt(body: unknown): Record<string, unknown> | null {
  if (!body) return null;
  try {
    const obj = typeof body === "string" ? JSON.parse(body) : body;
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const contentSize = bodyStr.length;
    const truncated = contentSize > TRUNCATE_SIZE;

    if (isMessagesArray(obj.messages)) {
      return {
        messages: (obj.messages as Record<string, unknown>[]).map((m) => ({
          role: m.role || (m.author as Record<string, unknown>)?.role || "user",
          content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
        })),
        contentSize,
        truncated,
        model: obj.model,
      };
    }
    if (typeof obj.prompt === "string") {
      return { text: truncateString(obj.prompt, TRUNCATE_SIZE), contentSize, truncated, model: obj.model };
    }
    if (isGeminiContents(obj.contents)) {
      return {
        messages: (obj.contents as Array<{ role?: string; parts: Array<{ text?: string }> }>).map((c) => ({
          role: c.role || "user",
          content: truncateString(c.parts.map((p) => p.text || "").join(""), TRUNCATE_SIZE),
        })),
        contentSize,
        truncated,
        model: obj.model,
      };
    }
    if (isChatGPTConversation(obj as Record<string, unknown>)) {
      return {
        chatgptAction: obj.action,
        conversationId: obj.conversation_id,
        parentMessageId: obj.parent_message_id,
        contentSize,
        truncated,
        model: obj.model,
      };
    }
    return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize, truncated };
  } catch {
    const bodyStr = String(body);
    return { rawBody: truncateString(bodyStr, TRUNCATE_SIZE), contentSize: bodyStr.length, truncated: bodyStr.length > TRUNCATE_SIZE };
  }
}

function extractStreamingContent(text: string): string {
  const chunks: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
    try {
      const data = JSON.parse(line.slice(6));
      const delta = data.choices?.[0]?.delta?.content || data.delta?.text || data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (delta) chunks.push(delta);
    } catch {
      /* skip */
    }
  }
  return truncateString(chunks.join(""), TRUNCATE_SIZE);
}

function extractResponse(text: string, isStreaming: boolean): Record<string, unknown> {
  const contentSize = text.length;
  const truncated = contentSize > TRUNCATE_SIZE;
  const result: Record<string, unknown> = { contentSize, truncated, isStreaming };
  try {
    if (isStreaming || text.includes("data: ")) {
      result.text = extractStreamingContent(text);
      return result;
    }
    const obj = JSON.parse(text);
    if (obj.choices?.[0]?.message?.content) result.text = truncateString(obj.choices[0].message.content, TRUNCATE_SIZE);
    else if (obj.choices?.[0]?.text) result.text = truncateString(obj.choices[0].text, TRUNCATE_SIZE);
    else if (obj.content?.[0]?.text) result.text = truncateString(obj.content[0].text, TRUNCATE_SIZE);
    else if (obj.candidates?.[0]?.content?.parts?.[0]?.text)
      result.text = truncateString(obj.candidates[0].content.parts[0].text, TRUNCATE_SIZE);
    if (obj.usage) {
      result.usage = {
        promptTokens: obj.usage.prompt_tokens ?? obj.usage.input_tokens,
        completionTokens: obj.usage.completion_tokens ?? obj.usage.output_tokens,
        totalTokens: obj.usage.total_tokens,
      };
    }
  } catch {
    result.text = truncateString(text, TRUNCATE_SIZE);
  }
  return result;
}

export function initAIHooks(shared: SharedHookUtils): void {
  const { emitSecurityEvent, scheduleNetworkInspection } = shared;
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

  // ===== FETCH =====
  window.fetch = function (this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : (input as Request)?.url;
    const method = init?.method || (typeof input === "object" ? (input as Request).method : "GET") || "GET";
    const body = init?.body;

    if (url) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: method.toUpperCase(), initiator: "fetch", body, pageUrl: window.location.href });
      } catch {
        /* invalid URL */
      }
    }

    if (body && method.toUpperCase() !== "GET" && isAIRequestBody(body)) {
      const startTime = Date.now();
      const promptContent = extractPrompt(body);
      const captureData: Record<string, unknown> = {
        id: crypto.randomUUID(),
        timestamp: startTime,
        pageUrl: window.location.href,
        apiEndpoint: url ? new URL(url, window.location.origin).href : window.location.href,
        method: method.toUpperCase(),
        prompt: promptContent,
        model: promptContent?.model,
      };
      const result = originalFetch.apply(this, [input, init] as unknown as [RequestInfo | URL, RequestInit | undefined]);
      return result.then((response) => {
        const clonedResponse = response.clone();
        const contentType = response.headers.get("content-type") || "";
        const isStreaming = contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson");
        clonedResponse
          .text()
          .then((text) => {
            if (text.length <= MAX_CONTENT_SIZE) {
              captureData.response = extractResponse(text, isStreaming);
              captureData.responseTimestamp = Date.now();
              (captureData.response as Record<string, unknown>).latencyMs = Date.now() - startTime;
            }
            emitSecurityEvent("__AI_PROMPT_CAPTURED__", captureData);
          })
          .catch(() => emitSecurityEvent("__AI_PROMPT_CAPTURED__", captureData));
        return response;
      }).catch((error) => {
        emitSecurityEvent("__AI_PROMPT_CAPTURED__", captureData);
        throw error;
      });
    }

    return originalFetch.apply(this, [input, init] as unknown as [RequestInfo | URL, RequestInit | undefined]);
  };

  // ===== XHR =====
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __serviceDetectionUrl: string | URL }).__serviceDetectionUrl = url;
    (this as XMLHttpRequest & { __serviceDetectionMethod: string }).__serviceDetectionMethod = method;
    return (originalXHROpen as Function).call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as XMLHttpRequest & { __serviceDetectionUrl: string | URL; __serviceDetectionMethod: string };
    const xhrUrl = xhr.__serviceDetectionUrl;
    const xhrMethod = (xhr.__serviceDetectionMethod || "GET").toUpperCase();

    if (xhrUrl) {
      try {
        const fullUrl = new URL(xhrUrl, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: xhrMethod, initiator: "xhr", body, pageUrl: window.location.href });
      } catch {
        /* invalid URL */
      }
    }

    if (body && xhrMethod !== "GET" && isAIRequestBody(body)) {
      const startTime = Date.now();
      const promptContent = extractPrompt(body);
      const captureData: Record<string, unknown> = {
        id: crypto.randomUUID(),
        timestamp: startTime,
        pageUrl: window.location.href,
        apiEndpoint: xhrUrl ? new URL(xhrUrl, window.location.origin).href : window.location.href,
        method: xhrMethod,
        prompt: promptContent,
        model: promptContent?.model,
      };
      const originalOnReadyStateChange = xhr.onreadystatechange;
      xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
        if (this.readyState === 4) {
          try {
            const responseText = this.responseText;
            if (responseText && responseText.length <= MAX_CONTENT_SIZE) {
              const contentType = this.getResponseHeader("content-type") || "";
              captureData.response = extractResponse(responseText, contentType.includes("text/event-stream"));
              captureData.responseTimestamp = Date.now();
              (captureData.response as Record<string, unknown>).latencyMs = Date.now() - startTime;
            }
          } catch {
            /* ignore */
          }
          emitSecurityEvent("__AI_PROMPT_CAPTURED__", captureData);
        }
        if (originalOnReadyStateChange) originalOnReadyStateChange.call(this, ev);
      };
    }

    return originalXHRSend.call(this, body);
  };

  // ===== Beacon =====
  if (originalSendBeacon) {
    navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
      try {
        const fullUrl = new URL(url, window.location.origin).href;
        scheduleNetworkInspection({ url: fullUrl, method: "POST", initiator: "beacon", body: data, pageUrl: window.location.href });
      } catch {
        /* invalid URL */
      }
      return originalSendBeacon(url, data);
    };
  }
}
