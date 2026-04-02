import { describe, it, expect } from "vitest";
import {
  isAIRequestBody,
  extractPromptContent,
  extractModel,
  extractResponseContent,
  inferProviderFromResponse,
} from "./detector.js";

describe("isAIRequestBody", () => {
  describe("Chat Completion format", () => {
    it("detects OpenAI chat completion format", () => {
      const body = {
        model: "gpt-4",
        messages: [
          { role: "user", content: "Hello" },
        ],
      };
      expect(isAIRequestBody(body)).toBe(true);
    });

    it("detects string body with messages", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(isAIRequestBody(body)).toBe(true);
    });

    it("detects messages with parts (Anthropic)", () => {
      const body = {
        model: "claude-3",
        messages: [
          { role: "user", parts: [{ text: "Hello" }] },
        ],
      };
      expect(isAIRequestBody(body)).toBe(true);
    });
  });

  describe("Completion format", () => {
    it("detects prompt completion format", () => {
      const body = {
        model: "text-davinci-003",
        prompt: "Complete this:",
      };
      expect(isAIRequestBody(body)).toBe(true);
    });

    it("requires both prompt and model", () => {
      expect(isAIRequestBody({ prompt: "Hello" })).toBe(false);
      expect(isAIRequestBody({ model: "gpt-4" })).toBe(false);
    });
  });

  describe("Gemini format", () => {
    it("detects Gemini contents format", () => {
      const body = {
        contents: [
          {
            parts: [{ text: "Hello" }],
          },
        ],
      };
      expect(isAIRequestBody(body)).toBe(true);
    });

    it("detects Gemini with role", () => {
      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
        ],
      };
      expect(isAIRequestBody(body)).toBe(true);
    });
  });

  describe("invalid bodies", () => {
    it("returns false for null", () => {
      expect(isAIRequestBody(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAIRequestBody(undefined)).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isAIRequestBody({})).toBe(false);
    });

    it("returns false for non-AI request", () => {
      expect(isAIRequestBody({ data: "test" })).toBe(false);
    });

    it("returns false for invalid JSON string", () => {
      expect(isAIRequestBody("not json")).toBe(false);
    });

    it("returns false for empty messages array", () => {
      expect(isAIRequestBody({ messages: [] })).toBe(false);
    });
  });
});

describe("extractPromptContent", () => {
  describe("Chat Completion format", () => {
    it("extracts messages from chat format", () => {
      const body = {
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      };
      const result = extractPromptContent(body);

      expect(result?.messages).toBeDefined();
      expect(result?.messages?.length).toBe(2);
      expect(result?.messages?.[0].content).toBe("Hello");
    });

    it("extracts content from array format", () => {
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: " World" },
            ],
          },
        ],
      };
      const result = extractPromptContent(body);

      expect(result?.messages?.[0].content).toBe("Hello World");
    });

    it("handles messages with content containing text objects", () => {
      const body = {
        messages: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
      };
      const result = extractPromptContent(body);

      expect(result?.messages?.[0].content).toBe("Hello");
    });
  });

  describe("Completion format", () => {
    it("extracts prompt text", () => {
      const body = {
        prompt: "Complete this sentence",
        model: "gpt-4",
      };
      const result = extractPromptContent(body);

      expect(result?.text).toBe("Complete this sentence");
    });
  });

  describe("Gemini format", () => {
    it("extracts Gemini contents", () => {
      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }, { text: " Gemini" }],
          },
        ],
      };
      const result = extractPromptContent(body);

      expect(result?.messages?.[0].content).toBe("Hello Gemini");
    });
  });

  describe("content size and truncation", () => {
    it("includes content size", () => {
      const body = { messages: [{ role: "user", content: "Hello" }] };
      const result = extractPromptContent(body);

      expect(result?.contentSize).toBeGreaterThan(0);
    });

    it("indicates truncation for large content", () => {
      const largeContent = "x".repeat(20000);
      const body = { messages: [{ role: "user", content: largeContent }] };
      const result = extractPromptContent(body);

      expect(result?.truncated).toBe(true);
    });

    it("indicates no truncation for small content", () => {
      const body = { messages: [{ role: "user", content: "Hello" }] };
      const result = extractPromptContent(body);

      expect(result?.truncated).toBe(false);
    });
  });

  describe("invalid bodies", () => {
    it("returns null for null input", () => {
      expect(extractPromptContent(null)).toBeNull();
    });

    it("returns rawBody for unparseable content", () => {
      const result = extractPromptContent("just a string");
      expect(result?.rawBody).toBeDefined();
    });
  });
});

describe("extractModel", () => {
  it("extracts model from object", () => {
    expect(extractModel({ model: "gpt-4" })).toBe("gpt-4");
  });

  it("extracts model from JSON string", () => {
    expect(extractModel(JSON.stringify({ model: "claude-3" }))).toBe("claude-3");
  });

  it("returns undefined for missing model", () => {
    expect(extractModel({ messages: [] })).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(extractModel(null)).toBeUndefined();
  });

  it("returns undefined for invalid JSON", () => {
    expect(extractModel("not json")).toBeUndefined();
  });
});

describe("extractResponseContent", () => {
  describe("OpenAI format", () => {
    it("extracts message content", () => {
      const response = JSON.stringify({
        choices: [{
          message: { role: "assistant", content: "Hello!" },
        }],
      });
      const result = extractResponseContent(response, false);

      expect(result.text).toBe("Hello!");
      expect(result.isStreaming).toBe(false);
    });

    it("extracts text completion content", () => {
      const response = JSON.stringify({
        choices: [{ text: "Completed text" }],
      });
      const result = extractResponseContent(response, false);

      expect(result.text).toBe("Completed text");
    });

    it("extracts usage info", () => {
      const response = JSON.stringify({
        choices: [{ message: { content: "Hello" } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });
      const result = extractResponseContent(response, false);

      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(5);
      expect(result.usage?.totalTokens).toBe(15);
    });
  });

  describe("Anthropic format", () => {
    it("extracts content array", () => {
      const response = JSON.stringify({
        content: [{ type: "text", text: "Hello from Claude" }],
      });
      const result = extractResponseContent(response, false);

      expect(result.text).toBe("Hello from Claude");
    });

    it("extracts Anthropic usage", () => {
      const response = JSON.stringify({
        content: [{ text: "Hello" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });
      const result = extractResponseContent(response, false);

      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(5);
    });
  });

  describe("Gemini format", () => {
    it("extracts candidates content", () => {
      const response = JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: "Hello from Gemini" }],
          },
        }],
      });
      const result = extractResponseContent(response, false);

      expect(result.text).toBe("Hello from Gemini");
    });
  });

  describe("streaming responses", () => {
    it("extracts OpenAI streaming content", () => {
      const response = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]`;
      const result = extractResponseContent(response, true);

      expect(result.text).toBe("Hello World");
      expect(result.isStreaming).toBe(true);
    });

    it("extracts Anthropic streaming content", () => {
      const response = `data: {"delta":{"text":"Hello"}}
data: {"delta":{"text":" World"}}`;
      const result = extractResponseContent(response, true);

      expect(result.text).toBe("Hello World");
    });

    it("handles data: prefix detection", () => {
      const response = `data: {"choices":[{"delta":{"content":"Hello"}}]}`;
      const result = extractResponseContent(response, false);

      expect(result.text).toBe("Hello");
    });
  });

  describe("truncation", () => {
    it("indicates truncation for large response", () => {
      const largeText = "x".repeat(20000);
      const result = extractResponseContent(largeText, false);

      expect(result.truncated).toBe(true);
      expect(result.contentSize).toBe(20000);
    });
  });
});

describe("inferProviderFromResponse", () => {
  it("detects OpenAI from choices array", () => {
    const response = JSON.stringify({
      choices: [{ message: { content: "Hello" } }],
    });
    expect(inferProviderFromResponse(response)).toBe("openai");
  });

  it("detects Anthropic from content array", () => {
    const response = JSON.stringify({
      content: [{ type: "text", text: "Hello" }],
    });
    expect(inferProviderFromResponse(response)).toBe("anthropic");
  });

  it("detects Anthropic from streaming event", () => {
    const response = "event: content_block_delta\ndata: {}";
    expect(inferProviderFromResponse(response)).toBe("anthropic");
  });

  it("detects Google from candidates array", () => {
    const response = JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Hello" }] } }],
    });
    expect(inferProviderFromResponse(response)).toBe("google");
  });

  it("returns unknown for unrecognized format", () => {
    const response = JSON.stringify({ data: "test" });
    expect(inferProviderFromResponse(response)).toBe("unknown");
  });

  it("returns unknown for invalid JSON", () => {
    expect(inferProviderFromResponse("not json")).toBe("unknown");
  });

  it("handles SSE data: prefix", () => {
    const response = `data: {"choices":[{"message":{"content":"Hello"}}]}`;
    expect(inferProviderFromResponse(response)).toBe("openai");
  });
});
