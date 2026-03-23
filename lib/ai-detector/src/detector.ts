/**
 * AI Request Detection
 */
import type {
  InferredProvider,
  AIPromptContent,
  AIResponseContent,
} from "./types.js";

const TRUNCATE_SIZE = 10000; // 10KB

// ============================================================================
// Request Structure Detection
// ============================================================================

/**
 * リクエストボディがAIサービスへのリクエストかどうか判定
 */
export function isAIRequestBody(body: unknown): boolean {
  if (!body) return false;

  try {
    const obj = typeof body === "string" ? JSON.parse(body) : body;
    if (!obj || typeof obj !== "object") return false;

    // Chat Completion形式: { messages: [...], model: "..." }
    if (isMessagesArray(obj.messages)) {
      return true;
    }

    // Completion形式: { prompt: "...", model: "..." }
    if (typeof obj.prompt === "string" && typeof obj.model === "string") {
      return true;
    }

    // Gemini形式: { contents: [{ parts: [...] }] }
    if (isGeminiContents(obj.contents)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * messages配列かどうかチェック
 */
function isMessagesArray(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;

  return messages.some(
    (m) =>
      m &&
      typeof m === "object" &&
      typeof m.role === "string" &&
      ("content" in m || "parts" in m)
  );
}

/**
 * Gemini形式のcontentsかどうかチェック
 */
function isGeminiContents(contents: unknown): boolean {
  if (!Array.isArray(contents) || contents.length === 0) return false;

  return contents.some(
    (c) =>
      c &&
      typeof c === "object" &&
      "parts" in c &&
      Array.isArray(c.parts) &&
      c.parts.some(
        (p: unknown) => p && typeof p === "object" && "text" in (p as object)
      )
  );
}

// ============================================================================
// Prompt Extraction
// ============================================================================

/**
 * リクエストボディからプロンプト内容を抽出
 */
export function extractPromptContent(body: unknown): AIPromptContent | null {
  if (!body) return null;

  try {
    const obj = typeof body === "string" ? JSON.parse(body) : body;
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const contentSize = bodyStr.length;
    const truncated = contentSize > TRUNCATE_SIZE;

    // Chat Completion形式
    if (isMessagesArray(obj.messages)) {
      return {
        messages: obj.messages.map(
          (m: { role: string; content: unknown; text?: string }) => ({
            role: m.role || "user",
            content: truncateString(extractMessageContent(m), TRUNCATE_SIZE),
          })
        ),
        contentSize,
        truncated,
      };
    }

    // Completion形式
    if (typeof obj.prompt === "string") {
      return {
        text: truncateString(obj.prompt, TRUNCATE_SIZE),
        contentSize,
        truncated,
      };
    }

    // Gemini形式
    if (isGeminiContents(obj.contents)) {
      const messages = obj.contents.map(
        (c: { role?: string; parts: Array<{ text?: string }> }) => ({
          role: c.role || "user",
          content: truncateString(
            c.parts.map((p: { text?: string }) => p.text || "").join(""),
            TRUNCATE_SIZE
          ),
        })
      );
      return {
        messages,
        contentSize,
        truncated,
      };
    }

    // 解析できない場合は生データ
    return {
      rawBody: truncateString(bodyStr, TRUNCATE_SIZE),
      contentSize,
      truncated,
    };
  } catch {
    const bodyStr = String(body);
    return {
      rawBody: truncateString(bodyStr, TRUNCATE_SIZE),
      contentSize: bodyStr.length,
      truncated: bodyStr.length > TRUNCATE_SIZE,
    };
  }
}

/**
 * メッセージからコンテンツを抽出
 */
function extractMessageContent(message: {
  content?: unknown;
  text?: string;
}): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((c: { text?: string; type?: string }) => {
        if (typeof c === "string") return c;
        if (c.type === "text" && typeof c.text === "string") return c.text;
        return "";
      })
      .join("");
  }
  if (typeof message.text === "string") {
    return message.text;
  }
  return "";
}

/**
 * モデル名を抽出
 */
export function extractModel(body: unknown): string | undefined {
  if (!body) return undefined;

  try {
    const obj = typeof body === "string" ? JSON.parse(body) : body;
    if (typeof obj.model === "string") return obj.model;
    return undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Response Extraction
// ============================================================================

/**
 * レスポンスからコンテンツを抽出
 */
export function extractResponseContent(
  text: string,
  isStreaming: boolean
): AIResponseContent {
  const contentSize = text.length;
  const truncated = contentSize > TRUNCATE_SIZE;

  const result: AIResponseContent = {
    contentSize,
    truncated,
    isStreaming,
  };

  try {
    // ストリーミングレスポンスの処理
    if (isStreaming || text.includes("data: ")) {
      result.text = extractStreamingContent(text);
      return result;
    }

    // 通常のJSONレスポンス
    const obj = JSON.parse(text);

    // OpenAI形式: choices[].message.content
    if (obj.choices?.[0]?.message?.content) {
      result.text = truncateString(
        obj.choices[0].message.content,
        TRUNCATE_SIZE
      );
    } else if (obj.choices?.[0]?.text) {
      result.text = truncateString(obj.choices[0].text, TRUNCATE_SIZE);
    }
    // Anthropic形式: content[].text
    else if (obj.content?.[0]?.text) {
      result.text = truncateString(obj.content[0].text, TRUNCATE_SIZE);
    }
    // Gemini形式: candidates[].content.parts[].text
    else if (obj.candidates?.[0]?.content?.parts?.[0]?.text) {
      result.text = truncateString(
        obj.candidates[0].content.parts[0].text,
        TRUNCATE_SIZE
      );
    }

    // Usage情報
    if (obj.usage) {
      result.usage = {
        promptTokens: obj.usage.prompt_tokens ?? obj.usage.input_tokens,
        completionTokens:
          obj.usage.completion_tokens ?? obj.usage.output_tokens,
        totalTokens: obj.usage.total_tokens,
      };
    }
  } catch {
    // JSONパースできない場合はそのまま
    result.text = truncateString(text, TRUNCATE_SIZE);
  }

  return result;
}

/**
 * ストリーミングレスポンスからテキストを抽出
 */
function extractStreamingContent(text: string): string {
  const chunks: string[] = [];

  // SSE形式: data: {...}
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    if (line.includes("[DONE]")) continue;

    try {
      const data = JSON.parse(line.slice(6));

      // OpenAI delta形式
      const deltaContent = data.choices?.[0]?.delta?.content;
      if (deltaContent) {
        chunks.push(deltaContent);
        continue;
      }

      // Anthropic delta形式
      const anthropicDelta = data.delta?.text;
      if (anthropicDelta) {
        chunks.push(anthropicDelta);
        continue;
      }

      // Gemini streaming
      const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (geminiText) {
        chunks.push(geminiText);
      }
    } catch {
      // skip invalid JSON
    }
  }

  return truncateString(chunks.join(""), TRUNCATE_SIZE);
}

// ============================================================================
// Provider Inference
// ============================================================================

/**
 * レスポンス構造からプロバイダーを推定
 */
export function inferProviderFromResponse(text: string): InferredProvider {
  try {
    // ストリーミング判定
    if (text.includes("event: content_block_delta")) {
      return "anthropic";
    }

    const obj = JSON.parse(
      text.startsWith("data: ") ? text.split("\n")[0].slice(6) : text
    );

    // Anthropic: content配列
    if (obj.content && Array.isArray(obj.content) && obj.content[0]?.text) {
      return "anthropic";
    }

    // Google Gemini: candidates配列
    if (obj.candidates && Array.isArray(obj.candidates)) {
      return "google";
    }

    // OpenAI互換: choices配列
    if (obj.choices && Array.isArray(obj.choices)) {
      return "openai";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

// ============================================================================
// Utilities
// ============================================================================

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength);
}
