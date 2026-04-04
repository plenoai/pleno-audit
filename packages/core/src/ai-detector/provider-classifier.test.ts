import { describe, it, expect } from "vitest";
import {
  classifyByModelName,
  classifyByUrl,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
} from "./provider-classifier.js";

describe("classifyByModelName", () => {
  describe("OpenAI models", () => {
    it("classifies GPT-4 models", () => {
      expect(classifyByModelName("gpt-4")?.provider).toBe("openai");
      expect(classifyByModelName("gpt-4-turbo")?.provider).toBe("openai");
      expect(classifyByModelName("gpt-4o")?.provider).toBe("openai");
    });

    it("classifies GPT-3.5 models", () => {
      expect(classifyByModelName("gpt-3.5-turbo")?.provider).toBe("openai");
    });

    it("classifies o1 models", () => {
      expect(classifyByModelName("o1-preview")?.provider).toBe("openai");
      expect(classifyByModelName("o1-mini")?.provider).toBe("openai");
    });
  });

  describe("Anthropic models", () => {
    it("classifies Claude 3 models", () => {
      expect(classifyByModelName("claude-3-opus")?.provider).toBe("anthropic");
      expect(classifyByModelName("claude-3-sonnet")?.provider).toBe("anthropic");
      expect(classifyByModelName("claude-3-haiku")?.provider).toBe("anthropic");
    });

    it("classifies Claude 2 models", () => {
      expect(classifyByModelName("claude-2")?.provider).toBe("anthropic");
      expect(classifyByModelName("claude-2.1")?.provider).toBe("anthropic");
    });
  });

  describe("Google models", () => {
    it("classifies Gemini models", () => {
      expect(classifyByModelName("gemini-pro")?.provider).toBe("google");
      expect(classifyByModelName("gemini-1.5-pro")?.provider).toBe("google");
    });

    it("classifies PaLM models", () => {
      expect(classifyByModelName("palm-2")?.provider).toBe("google");
    });
  });

  describe("Mistral models", () => {
    it("classifies Mistral models", () => {
      expect(classifyByModelName("mistral-large")?.provider).toBe("mistral");
      expect(classifyByModelName("mixtral-8x7b")?.provider).toBe("mistral");
    });
  });

  describe("Meta models", () => {
    it("classifies Llama models", () => {
      expect(classifyByModelName("llama-2-70b")?.provider).toBe("meta");
      expect(classifyByModelName("llama-3-8b")?.provider).toBe("meta");
      expect(classifyByModelName("code-llama")?.provider).toBe("meta");
    });
  });

  describe("DeepSeek models", () => {
    it("classifies DeepSeek models", () => {
      expect(classifyByModelName("deepseek-chat")?.provider).toBe("deepseek");
      expect(classifyByModelName("deepseek-coder")?.provider).toBe("deepseek");
    });
  });

  it("returns null for unknown models", () => {
    expect(classifyByModelName("unknown-model")).toBeNull();
    expect(classifyByModelName("")).toBeNull();
  });
});

describe("classifyByUrl", () => {
  describe("OpenAI URLs", () => {
    it("classifies OpenAI API URLs", () => {
      expect(classifyByUrl("https://api.openai.com/v1/chat/completions")?.provider).toBe("openai");
    });

    it("classifies ChatGPT backend URLs", () => {
      expect(classifyByUrl("https://chatgpt.com/backend-api/conversation")?.provider).toBe("openai");
    });
  });

  describe("Anthropic URLs", () => {
    it("classifies Anthropic API URLs", () => {
      expect(classifyByUrl("https://api.anthropic.com/v1/messages")?.provider).toBe("anthropic");
    });

    it("classifies Claude.ai URLs", () => {
      expect(classifyByUrl("https://claude.ai/api/chat")?.provider).toBe("anthropic");
    });
  });

  describe("Google URLs", () => {
    it("classifies Generative Language API URLs", () => {
      expect(classifyByUrl("https://generativelanguage.googleapis.com/v1/models")?.provider).toBe("google");
    });
  });

  describe("Azure OpenAI URLs", () => {
    it("classifies Azure OpenAI URLs", () => {
      expect(classifyByUrl("https://myresource.openai.azure.com/openai/deployments")?.provider).toBe("azure");
    });
  });

  describe("Other providers", () => {
    it("classifies Cohere URLs", () => {
      expect(classifyByUrl("https://api.cohere.ai/v1/generate")?.provider).toBe("cohere");
    });

    it("classifies Mistral URLs", () => {
      expect(classifyByUrl("https://api.mistral.ai/v1/chat")?.provider).toBe("mistral");
    });

    it("classifies Groq URLs", () => {
      expect(classifyByUrl("https://api.groq.com/openai/v1/chat")?.provider).toBe("groq");
    });

    it("classifies DeepSeek URLs", () => {
      expect(classifyByUrl("https://api.deepseek.com/v1/chat")?.provider).toBe("deepseek");
    });

    it("classifies Perplexity URLs", () => {
      expect(classifyByUrl("https://api.perplexity.ai/chat")?.provider).toBe("perplexity");
    });

    it("classifies Hugging Face URLs", () => {
      expect(classifyByUrl("https://api-inference.huggingface.co/models")?.provider).toBe("huggingface");
    });
  });

  it("returns null for unknown URLs", () => {
    expect(classifyByUrl("https://example.com/api")).toBeNull();
    expect(classifyByUrl("")).toBeNull();
  });
});

describe("classifyProvider", () => {
  it("classifies by model name with high confidence", () => {
    const result = classifyProvider({ modelName: "gpt-4-turbo" });
    expect(result.provider).toBe("openai");
    expect(result.confidence).toBe("high");
  });

  it("classifies by URL when model name is unknown", () => {
    const result = classifyProvider({
      modelName: "custom-model",
      url: "https://api.anthropic.com/v1/messages",
    });
    expect(result.provider).toBe("anthropic");
  });

  it("uses URL pattern for classification", () => {
    const result = classifyProvider({
      url: "https://api.mistral.ai/v1/chat/completions",
    });
    expect(result.provider).toBe("mistral");
  });

  it("returns unknown for unidentifiable requests", () => {
    const result = classifyProvider({
      modelName: "custom",
      url: "https://example.com/api",
    });
    expect(result.provider).toBe("unknown");
    expect(result.confidence).toBe("low");
  });
});

describe("getProviderInfo", () => {
  it("returns info for known providers", () => {
    const openaiInfo = getProviderInfo("openai");
    expect(openaiInfo.name).toBe("openai");
    expect(openaiInfo.displayName).toBe("OpenAI");
    expect(openaiInfo.category).toBe("major");

    const anthropicInfo = getProviderInfo("anthropic");
    expect(anthropicInfo.name).toBe("anthropic");
    expect(anthropicInfo.displayName).toBe("Anthropic");
    expect(anthropicInfo.category).toBe("major");
  });

  it("returns default info for unknown provider", () => {
    const unknownInfo = getProviderInfo("unknown");
    expect(unknownInfo.name).toBe("unknown");
    expect(unknownInfo.category).toBe("specialized");
    expect(unknownInfo.riskLevel).toBe("high");
  });
});

describe("isShadowAI", () => {
  it("returns false for major providers", () => {
    expect(isShadowAI("openai")).toBe(false);
    expect(isShadowAI("anthropic")).toBe(false);
    expect(isShadowAI("google")).toBe(false);
  });

  it("returns true for emerging providers", () => {
    expect(isShadowAI("deepseek")).toBe(true);
    expect(isShadowAI("moonshot")).toBe(true);
    expect(isShadowAI("zhipu")).toBe(true);
  });

  it("returns true for unknown providers", () => {
    expect(isShadowAI("unknown")).toBe(true);
  });
});
