/**
 * AI Hooks のテスト
 *
 * export化された isLikelyAIUrl, getBodySample, AI_URL_MARKERS の直接テスト。
 */
import { describe, it, expect } from "vitest";
import { isLikelyAIUrl, getBodySample, AI_URL_MARKERS } from "./ai-hooks.js";

describe("AI_URL_MARKERS", () => {
  it("includes major AI providers", () => {
    expect(AI_URL_MARKERS).toContain("api.openai.com");
    expect(AI_URL_MARKERS).toContain("api.anthropic.com");
    expect(AI_URL_MARKERS).toContain("generativelanguage.googleapis.com");
  });

  it("includes generic AI API paths", () => {
    expect(AI_URL_MARKERS).toContain("/v1/chat/completions");
    expect(AI_URL_MARKERS).toContain("/v1/messages");
  });
});

describe("isLikelyAIUrl", () => {
  it("detects OpenAI API", () => {
    expect(isLikelyAIUrl("https://api.openai.com/v1/chat/completions")).toBe(true);
  });

  it("detects Anthropic API", () => {
    expect(isLikelyAIUrl("https://api.anthropic.com/v1/messages")).toBe(true);
  });

  it("detects Google AI", () => {
    expect(isLikelyAIUrl("https://generativelanguage.googleapis.com/v1/models")).toBe(true);
  });

  it("detects Azure OpenAI", () => {
    expect(isLikelyAIUrl("https://myapp.openai.azure.com/openai/deployments/gpt-4/chat/completions")).toBe(true);
  });

  it("detects ChatGPT backend", () => {
    expect(isLikelyAIUrl("https://chatgpt.com/backend-api/conversation")).toBe(true);
  });

  it("detects Claude.ai API", () => {
    expect(isLikelyAIUrl("https://claude.ai/api/messages")).toBe(true);
  });

  it("detects other AI providers", () => {
    expect(isLikelyAIUrl("https://api.cohere.ai/generate")).toBe(true);
    expect(isLikelyAIUrl("https://api.mistral.ai/v1/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://api.groq.com/openai/v1/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://api.deepseek.com/v1/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://api.perplexity.ai/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://api.together.xyz/v1/chat/completions")).toBe(true);
    expect(isLikelyAIUrl("https://api.fireworks.ai/inference/v1/chat/completions")).toBe(true);
  });

  it("detects generic /v1/completions path", () => {
    expect(isLikelyAIUrl("https://custom-ai.example.com/v1/completions")).toBe(true);
  });

  it("returns false for non-AI URLs", () => {
    expect(isLikelyAIUrl("https://example.com/api/data")).toBe(false);
    expect(isLikelyAIUrl("https://google.com/search")).toBe(false);
    expect(isLikelyAIUrl("https://cdn.jsdelivr.net/npm/package")).toBe(false);
    expect(isLikelyAIUrl("https://api.stripe.com/v1/charges")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isLikelyAIUrl("")).toBe(false);
  });
});

describe("getBodySample (ai-hooks)", () => {
  it("returns string body as-is when within limit", () => {
    expect(getBodySample("hello")).toBe("hello");
  });

  it("truncates string body exceeding 10KB", () => {
    const body = "x".repeat(20000);
    const result = getBodySample(body);
    expect(result).toBeDefined();
    expect(result!.length).toBe(10000);
  });

  it("returns undefined for null", () => {
    expect(getBodySample(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(getBodySample(undefined)).toBeUndefined();
  });

  it("returns undefined for non-string body", () => {
    expect(getBodySample(new ArrayBuffer(8))).toBeUndefined();
    expect(getBodySample(123)).toBeUndefined();
  });

  it("returns string for exactly 10000 chars", () => {
    const body = "a".repeat(10000);
    expect(getBodySample(body)).toBe(body);
  });
});
