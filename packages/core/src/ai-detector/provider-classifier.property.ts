/**
 * Property-based tests for AI provider classifier
 *
 * fast-checkを使用した強化プロパティベーステスト
 * - 代数的プロパティ（冪等性、優先順位）
 * - エッジケース（未知のモデル、不正なURL）
 * - 真のランダム生成
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  classifyByModelName,
  classifyByUrl,
  classifyByResponseStructure,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
  type ExtendedProvider,
  PROVIDER_INFO,
} from "./provider-classifier.js";

const validProviders: ExtendedProvider[] = [
  "openai", "anthropic", "google", "azure", "cohere", "mistral", "meta",
  "together", "replicate", "huggingface", "perplexity", "groq",
  "deepseek", "moonshot", "zhipu", "baidu", "alibaba", "unknown",
];

const validMethods = ["model_name", "url_pattern", "response_structure", "heuristic"];
const validConfidences = ["high", "medium", "low"];

describe("provider classifier - property tests", () => {
  describe("classifyByModelName", () => {
    // undefinedはnull
    it("should return null for undefined", () => {
      expect(classifyByModelName(undefined)).toBeNull();
    });

    // 空文字列はnull
    it("should return null for empty string", () => {
      expect(classifyByModelName("")).toBeNull();
    });

    // 有効な分類または null
    it("should return null or valid classification for any string", () => {
      fc.assert(
        fc.property(fc.string(), (modelName) => {
          const result = classifyByModelName(modelName);
          if (result === null) return true;
          return (
            validProviders.includes(result.provider) &&
            result.method === "model_name" &&
            validConfidences.includes(result.confidence)
          );
        }),
        { numRuns: 1000 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (modelName) => {
          const r1 = classifyByModelName(modelName);
          const r2 = classifyByModelName(modelName);
          if (r1 === null && r2 === null) return true;
          if (r1 === null || r2 === null) return false;
          return r1.provider === r2.provider && r1.confidence === r2.confidence;
        }),
        { numRuns: 500 }
      );
    });

    // OpenAI モデル検出
    it("should classify gpt-4 variants as OpenAI with high confidence", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4-0125-preview", "gpt-3.5-turbo"),
          (modelName) => {
            const result = classifyByModelName(modelName);
            return result !== null && result.provider === "openai" && result.confidence === "high";
          }
        )
      );
    });

    // Anthropic モデル検出
    it("should classify claude variants as Anthropic with high confidence", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1", "claude-instant-1.2"),
          (modelName) => {
            const result = classifyByModelName(modelName);
            return result !== null && result.provider === "anthropic" && result.confidence === "high";
          }
        )
      );
    });

    // Google モデル検出
    it("should classify gemini variants as Google with high confidence", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("gemini-pro", "gemini-1.5-pro", "gemini-ultra", "palm-2"),
          (modelName) => {
            const result = classifyByModelName(modelName);
            return result !== null && result.provider === "google" && result.confidence === "high";
          }
        )
      );
    });

    // Meta モデル検出
    it("should classify llama variants as Meta", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("llama-2-70b", "llama-3-8b", "llama3-70b", "code-llama-34b"),
          (modelName) => {
            const result = classifyByModelName(modelName);
            return result !== null && result.provider === "meta";
          }
        )
      );
    });

    // Mistral モデル検出
    it("should classify mistral variants as Mistral", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("mistral-large", "mistral-medium", "mixtral-8x7b", "codestral-latest"),
          (modelName) => {
            const result = classifyByModelName(modelName);
            return result !== null && result.provider === "mistral";
          }
        )
      );
    });

    // 中国AIプロバイダー検出
    it("should classify Chinese AI models correctly", () => {
      const testCases = [
        { model: "deepseek-chat", provider: "deepseek" },
        { model: "moonshot-v1", provider: "moonshot" },
        { model: "glm-4", provider: "zhipu" },
        { model: "ernie-bot", provider: "baidu" },
        { model: "qwen-turbo", provider: "alibaba" },
      ];

      for (const { model, provider } of testCases) {
        const result = classifyByModelName(model);
        expect(result?.provider).toBe(provider);
      }
    });
  });

  describe("classifyByUrl", () => {
    // undefinedはnull
    it("should return null for undefined", () => {
      expect(classifyByUrl(undefined)).toBeNull();
    });

    // 有効な分類または null
    it("should return null or valid classification for any string", () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const result = classifyByUrl(url);
          if (result === null) return true;
          return (
            validProviders.includes(result.provider) &&
            result.method === "url_pattern" &&
            validConfidences.includes(result.confidence)
          );
        }),
        { numRuns: 1000 }
      );
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const r1 = classifyByUrl(url);
          const r2 = classifyByUrl(url);
          if (r1 === null && r2 === null) return true;
          if (r1 === null || r2 === null) return false;
          return r1.provider === r2.provider;
        }),
        { numRuns: 500 }
      );
    });

    // OpenAI URL検出
    it("should classify api.openai.com as OpenAI", () => {
      const urls = [
        "https://api.openai.com/v1/chat/completions",
        "https://api.openai.com/v1/completions",
        "https://api.openai.com/v1/embeddings",
      ];

      for (const url of urls) {
        const result = classifyByUrl(url);
        expect(result?.provider).toBe("openai");
        expect(result?.confidence).toBe("high");
      }
    });

    // Anthropic URL検出
    it("should classify api.anthropic.com as Anthropic", () => {
      const urls = [
        "https://api.anthropic.com/v1/messages",
        "https://api.anthropic.com/v1/complete",
      ];

      for (const url of urls) {
        const result = classifyByUrl(url);
        expect(result?.provider).toBe("anthropic");
      }
    });

    // Azure OpenAI URL検出
    it("should classify Azure OpenAI URLs", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{3,10}$/),
          (resourceName) => {
            const url = `https://${resourceName}.openai.azure.com/openai/deployments/gpt-4/chat/completions`;
            const result = classifyByUrl(url);
            return result !== null && result.provider === "azure";
          }
        )
      );
    });

    // 地域AIサービスURL検出
    it("should classify regional AI service URLs", () => {
      const testCases = [
        { url: "https://api.deepseek.com/v1/chat", provider: "deepseek" },
        { url: "https://api.moonshot.cn/v1/chat", provider: "moonshot" },
        { url: "https://open.bigmodel.cn/api/v4/chat", provider: "zhipu" },
        { url: "https://dashscope.aliyuncs.com/api/v1/services", provider: "alibaba" },
      ];

      for (const { url, provider } of testCases) {
        const result = classifyByUrl(url);
        expect(result?.provider).toBe(provider);
      }
    });
  });

  describe("classifyByResponseStructure", () => {
    // 不正なJSONはnull
    it("should return null for invalid JSON", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{5,20}$/), // 確実に不正なJSON
          (text) => {
            return classifyByResponseStructure(text) === null;
          }
        )
      );
    });

    // Anthropic SSE形式検出
    it("should detect Anthropic SSE format", () => {
      const sseContent = "event: content_block_delta\ndata: {\"type\":\"content_block_delta\"}";
      const result = classifyByResponseStructure(sseContent);
      expect(result?.provider).toBe("anthropic");
      expect(result?.method).toBe("response_structure");
    });

    // Google candidates構造検出
    it("should detect Google candidates structure", () => {
      const googleResponse = JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Hello" }] } }]
      });
      const result = classifyByResponseStructure(googleResponse);
      expect(result?.provider).toBe("google");
    });

    // OpenAI choices構造検出
    it("should detect OpenAI choices structure", () => {
      const openaiResponse = JSON.stringify({
        choices: [{ message: { content: "Hello" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 }
      });
      const result = classifyByResponseStructure(openaiResponse);
      expect(result?.provider).toBe("openai");
    });

    // Cohere構造検出
    it("should detect Cohere structure", () => {
      const cohereResponse = JSON.stringify({
        text: "Generated text",
        generation_id: "gen-123"
      });
      const result = classifyByResponseStructure(cohereResponse);
      expect(result?.provider).toBe("cohere");
    });
  });

  describe("classifyProvider", () => {
    // 常に分類を返す
    it("should always return a classification", () => {
      fc.assert(
        fc.property(
          fc.record({
            modelName: fc.option(fc.string(), { nil: undefined }),
            url: fc.option(fc.string(), { nil: undefined }),
            responseText: fc.option(fc.string(), { nil: undefined }),
          }),
          (options) => {
            const result = classifyProvider(options);
            return (
              validProviders.includes(result.provider) &&
              validMethods.includes(result.method) &&
              validConfidences.includes(result.confidence)
            );
          }
        ),
        { numRuns: 1000 }
      );
    });

    // 空オプションはunknown
    it("should return unknown for empty options", () => {
      const result = classifyProvider({});
      expect(result.provider).toBe("unknown");
      expect(result.confidence).toBe("low");
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          fc.record({
            modelName: fc.option(fc.string(), { nil: undefined }),
            url: fc.option(fc.string(), { nil: undefined }),
          }),
          (options) => {
            const r1 = classifyProvider(options);
            const r2 = classifyProvider(options);
            return r1.provider === r2.provider && r1.method === r2.method;
          }
        ),
        { numRuns: 500 }
      );
    });

    // 優先順位: model_name (high) > url (high) > response > model_name (medium) > url (medium)
    it("should prioritize high-confidence model name over URL", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("gpt-4", "claude-3-opus", "gemini-pro"),
          (modelName) => {
            const result = classifyProvider({
              modelName,
              url: "https://api.deepseek.com/v1/chat", // Different provider URL
            });
            return result.method === "model_name" && result.confidence === "high";
          }
        )
      );
    });

    // URLが使用される場合
    it("should use URL when model name doesn't match", () => {
      const result = classifyProvider({
        modelName: "unknown-custom-model",
        url: "https://api.openai.com/v1/chat",
      });
      expect(result.method).toBe("url_pattern");
      expect(result.provider).toBe("openai");
    });

    // レスポンス構造が使用される場合
    it("should use response structure when model and URL don't match", () => {
      const result = classifyProvider({
        modelName: "unknown",
        url: "https://custom-api.example.com",
        responseText: JSON.stringify({ candidates: [{ content: {} }] }),
      });
      expect(result.provider).toBe("google");
      expect(result.method).toBe("response_structure");
    });
  });

  describe("getProviderInfo", () => {
    // 全てのプロバイダーで有効な情報を返す
    it("should return valid info for all providers", () => {
      for (const provider of validProviders) {
        const info = getProviderInfo(provider);
        expect(info.name).toBeDefined();
        expect(info.displayName).toBeDefined();
        expect(["major", "enterprise", "open_source", "regional", "specialized"]).toContain(info.category);
        expect(["low", "medium", "high"]).toContain(info.riskLevel);
      }
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ExtendedProvider>(...validProviders),
          (provider) => {
            const i1 = getProviderInfo(provider);
            const i2 = getProviderInfo(provider);
            return i1.name === i2.name && i1.displayName === i2.displayName;
          }
        )
      );
    });
  });

  describe("isShadowAI", () => {
    // unknownはShadow AI
    it("should return true for unknown provider", () => {
      expect(isShadowAI("unknown")).toBe(true);
    });

    // 地域特化型はShadow AI
    it("should return true for regional providers", () => {
      const regionalProviders: ExtendedProvider[] = ["deepseek", "moonshot", "zhipu", "baidu", "alibaba"];
      for (const provider of regionalProviders) {
        expect(isShadowAI(provider)).toBe(true);
      }
    });

    // 主要プロバイダーはShadow AIではない
    it("should return false for major providers", () => {
      const majorProviders: ExtendedProvider[] = ["openai", "anthropic", "google"];
      for (const provider of majorProviders) {
        expect(isShadowAI(provider)).toBe(false);
      }
    });

    // 冪等性
    it("should be idempotent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ExtendedProvider>(...validProviders),
          (provider) => {
            const first = isShadowAI(provider);
            const second = isShadowAI(provider);
            return first === second;
          }
        )
      );
    });

    // PROVIDER_INFOと整合性がある
    it("should be consistent with PROVIDER_INFO", () => {
      for (const provider of validProviders) {
        const info = PROVIDER_INFO[provider];
        const shadow = isShadowAI(provider);

        // unknown、regional、medium/highリスクはShadow AI
        if (provider === "unknown") {
          expect(shadow).toBe(true);
        } else if (info.category === "regional") {
          expect(shadow).toBe(true);
        } else if (info.riskLevel === "high" || info.riskLevel === "medium") {
          expect(shadow).toBe(true);
        } else {
          expect(shadow).toBe(false);
        }
      }
    });
  });
});
