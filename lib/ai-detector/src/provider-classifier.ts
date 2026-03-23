/**
 * @fileoverview AI Provider Classifier
 *
 * 未知のAIサービスを自動分類し、プロバイダーを推定する。
 * Shadow AI検出強化の一環として、より多くのプロバイダーをサポート。
 */

import type { InferredProvider } from "./types.js";

// ============================================================================
// Extended Provider Type
// ============================================================================

/**
 * 拡張AIプロバイダー（既存+新規）
 */
export type ExtendedProvider =
  | InferredProvider
  | "azure" // Azure OpenAI
  | "cohere" // Cohere
  | "mistral" // Mistral AI
  | "meta" // Meta Llama
  | "together" // Together.ai
  | "replicate" // Replicate
  | "huggingface" // Hugging Face
  | "perplexity" // Perplexity
  | "groq" // Groq
  | "deepseek" // DeepSeek
  | "moonshot" // Moonshot AI
  | "zhipu" // Zhipu AI (智谱)
  | "baidu" // Baidu ERNIE
  | "alibaba"; // Alibaba Qwen

/**
 * プロバイダー分類結果
 */
export interface ProviderClassification {
  provider: ExtendedProvider;
  confidence: "high" | "medium" | "low";
  method: "model_name" | "url_pattern" | "response_structure" | "heuristic";
  details?: string;
}

// ============================================================================
// Model Name Patterns
// ============================================================================

/**
 * モデル名パターンとプロバイダーのマッピング
 */
const MODEL_NAME_PATTERNS: Array<{
  pattern: RegExp;
  provider: ExtendedProvider;
  confidence: "high" | "medium";
}> = [
  // OpenAI
  { pattern: /^gpt-4/i, provider: "openai", confidence: "high" },
  { pattern: /^gpt-3\.5/i, provider: "openai", confidence: "high" },
  { pattern: /^o1-/i, provider: "openai", confidence: "high" },
  { pattern: /^text-davinci/i, provider: "openai", confidence: "high" },
  { pattern: /^text-embedding/i, provider: "openai", confidence: "high" },
  { pattern: /^dall-e/i, provider: "openai", confidence: "high" },
  { pattern: /^whisper/i, provider: "openai", confidence: "medium" },

  // Anthropic
  { pattern: /^claude-3/i, provider: "anthropic", confidence: "high" },
  { pattern: /^claude-2/i, provider: "anthropic", confidence: "high" },
  { pattern: /^claude-instant/i, provider: "anthropic", confidence: "high" },

  // Google
  { pattern: /^gemini-/i, provider: "google", confidence: "high" },
  { pattern: /^palm-/i, provider: "google", confidence: "high" },
  { pattern: /^text-bison/i, provider: "google", confidence: "high" },
  { pattern: /^chat-bison/i, provider: "google", confidence: "high" },

  // Azure OpenAI (deploymentベースのモデル名)
  { pattern: /^azure[-_]?/i, provider: "azure", confidence: "medium" },

  // Cohere
  { pattern: /^command(-|$)/i, provider: "cohere", confidence: "high" },
  { pattern: /^embed(-|$)/i, provider: "cohere", confidence: "medium" },

  // Mistral
  { pattern: /^mistral(-|$)/i, provider: "mistral", confidence: "high" },
  { pattern: /^mixtral/i, provider: "mistral", confidence: "high" },
  { pattern: /^codestral/i, provider: "mistral", confidence: "high" },

  // Meta
  { pattern: /^llama(-|$)/i, provider: "meta", confidence: "high" },
  { pattern: /^llama-?2/i, provider: "meta", confidence: "high" },
  { pattern: /^llama-?3/i, provider: "meta", confidence: "high" },
  { pattern: /^code-?llama/i, provider: "meta", confidence: "high" },

  // Perplexity
  { pattern: /^pplx-/i, provider: "perplexity", confidence: "high" },
  { pattern: /^sonar-/i, provider: "perplexity", confidence: "high" },

  // Groq
  { pattern: /^groq-/i, provider: "groq", confidence: "high" },

  // DeepSeek
  { pattern: /^deepseek/i, provider: "deepseek", confidence: "high" },

  // Moonshot
  { pattern: /^moonshot/i, provider: "moonshot", confidence: "high" },

  // Zhipu AI (ChatGLM)
  { pattern: /^glm-/i, provider: "zhipu", confidence: "high" },
  { pattern: /^chatglm/i, provider: "zhipu", confidence: "high" },

  // Baidu ERNIE
  { pattern: /^ernie/i, provider: "baidu", confidence: "high" },

  // Alibaba Qwen
  { pattern: /^qwen/i, provider: "alibaba", confidence: "high" },
];

/**
 * モデル名からプロバイダーを推定
 */
export function classifyByModelName(
  modelName: string | undefined
): ProviderClassification | null {
  if (!modelName) return null;

  for (const { pattern, provider, confidence } of MODEL_NAME_PATTERNS) {
    if (pattern.test(modelName)) {
      return {
        provider,
        confidence,
        method: "model_name",
        details: `Model: ${modelName}`,
      };
    }
  }

  return null;
}

// ============================================================================
// URL Pattern Classification
// ============================================================================

/**
 * 既知のAIサービスドメインパターン
 * ADR-011に従い、補助的な確信度向上のみに使用
 */
const KNOWN_AI_DOMAINS: Array<{
  pattern: RegExp;
  provider: ExtendedProvider;
  confidence: "high" | "medium";
}> = [
  // OpenAI
  {
    pattern: /(?:^|:\/\/|@)api\.openai\.com(?:\/|$)/i,
    provider: "openai",
    confidence: "high",
  },
  {
    pattern: /(?:^|:\/\/|@)chatgpt\.com\/backend-api(?:\/|$)/i,
    provider: "openai",
    confidence: "high",
  },

  // Anthropic
  {
    pattern: /(?:^|:\/\/|@)api\.anthropic\.com(?:\/|$)/i,
    provider: "anthropic",
    confidence: "high",
  },
  { pattern: /(?:^|:\/\/|@)claude\.ai\/api(?:\/|$)/i, provider: "anthropic", confidence: "high" },

  // Google
  {
    pattern: /(?:^|:\/\/|@)generativelanguage\.googleapis\.com(?:\/|$)/i,
    provider: "google",
    confidence: "high",
  },
  {
    pattern: /(?:^|:\/\/|@)aiplatform\.googleapis\.com(?:\/|$)/i,
    provider: "google",
    confidence: "high",
  },

  // Azure OpenAI
  {
    pattern: /(?:^|:\/\/|@)[^\/]*\.openai\.azure\.com(?:\/|$)/i,
    provider: "azure",
    confidence: "high",
  },
  {
    pattern: /(?:^|:\/\/|@)[^\/]*\.cognitiveservices\.azure\.com\/.*openai/i,
    provider: "azure",
    confidence: "high",
  },

  // Cohere
  { pattern: /(?:^|:\/\/|@)api\.cohere\.(?:ai|com)(?:\/|$)/i, provider: "cohere", confidence: "high" },

  // Mistral
  { pattern: /(?:^|:\/\/|@)api\.mistral\.ai(?:\/|$)/i, provider: "mistral", confidence: "high" },

  // Together.ai
  {
    pattern: /(?:^|:\/\/|@)api\.together\.(?:xyz|ai)(?:\/|$)/i,
    provider: "together",
    confidence: "high",
  },

  // Replicate
  { pattern: /(?:^|:\/\/|@)api\.replicate\.com(?:\/|$)/i, provider: "replicate", confidence: "high" },

  // Hugging Face
  {
    pattern: /(?:^|:\/\/|@)api-inference\.huggingface\.co(?:\/|$)/i,
    provider: "huggingface",
    confidence: "high",
  },
  {
    pattern: /(?:^|:\/\/|@)huggingface\.co\/api(?:\/|$)/i,
    provider: "huggingface",
    confidence: "medium",
  },

  // Perplexity
  {
    pattern: /(?:^|:\/\/|@)api\.perplexity\.ai(?:\/|$)/i,
    provider: "perplexity",
    confidence: "high",
  },

  // Groq
  { pattern: /(?:^|:\/\/|@)api\.groq\.com(?:\/|$)/i, provider: "groq", confidence: "high" },

  // DeepSeek
  { pattern: /(?:^|:\/\/|@)api\.deepseek\.com(?:\/|$)/i, provider: "deepseek", confidence: "high" },

  // Moonshot
  {
    pattern: /(?:^|:\/\/|@)api\.moonshot\.cn(?:\/|$)/i,
    provider: "moonshot",
    confidence: "high",
  },

  // Zhipu AI
  { pattern: /(?:^|:\/\/|@)open\.bigmodel\.cn(?:\/|$)/i, provider: "zhipu", confidence: "high" },

  // Baidu
  {
    pattern: /(?:^|:\/\/|@)aip\.baidubce\.com(?:\/|$)/i,
    provider: "baidu",
    confidence: "high",
  },

  // Alibaba
  {
    pattern: /(?:^|:\/\/|@)dashscope\.aliyuncs\.com(?:\/|$)/i,
    provider: "alibaba",
    confidence: "high",
  },
];

/**
 * URLからプロバイダーを推定
 */
export function classifyByUrl(
  url: string | undefined
): ProviderClassification | null {
  if (!url) return null;

  for (const { pattern, provider, confidence } of KNOWN_AI_DOMAINS) {
    if (pattern.test(url)) {
      return {
        provider,
        confidence,
        method: "url_pattern",
        details: `URL matched: ${pattern.source}`,
      };
    }
  }

  return null;
}

// ============================================================================
// Response Structure Classification
// ============================================================================

/**
 * レスポンス構造からプロバイダーを推定（既存ロジックの拡張）
 */
export function classifyByResponseStructure(
  text: string
): ProviderClassification | null {
  try {
    // ストリーミング判定
    if (text.includes("event: content_block_delta")) {
      return {
        provider: "anthropic",
        confidence: "high",
        method: "response_structure",
        details: "Anthropic SSE format detected",
      };
    }

    const obj = JSON.parse(
      text.startsWith("data: ") ? text.split("\n")[0].slice(6) : text
    );

    // Anthropic: content配列 + type: "text"
    if (obj.content && Array.isArray(obj.content) && obj.content[0]?.text) {
      return {
        provider: "anthropic",
        confidence: "high",
        method: "response_structure",
        details: "content[] structure",
      };
    }

    // Google Gemini: candidates配列
    if (obj.candidates && Array.isArray(obj.candidates)) {
      return {
        provider: "google",
        confidence: "high",
        method: "response_structure",
        details: "candidates[] structure",
      };
    }

    // Cohere特有の構造
    if (obj.text && obj.generation_id) {
      return {
        provider: "cohere",
        confidence: "high",
        method: "response_structure",
        details: "Cohere generation response",
      };
    }

    // OpenAI互換: choices配列（多くのプロバイダーがOpenAI互換）
    if (obj.choices && Array.isArray(obj.choices)) {
      // usage情報から詳細判定を試みる
      if (obj.usage?.input_tokens !== undefined) {
        // input_tokens はAnthropicスタイル
        return {
          provider: "anthropic",
          confidence: "medium",
          method: "response_structure",
          details: "OpenAI-compatible with input_tokens",
        };
      }

      return {
        provider: "openai",
        confidence: "medium",
        method: "response_structure",
        details: "choices[] structure (OpenAI-compatible)",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Combined Classification
// ============================================================================

/**
 * 複数の手法を組み合わせてプロバイダーを分類
 */
export function classifyProvider(options: {
  modelName?: string;
  url?: string;
  responseText?: string;
}): ProviderClassification {
  const { modelName, url, responseText } = options;

  // 1. モデル名による判定（最も確実）
  const modelClassification = classifyByModelName(modelName);
  if (modelClassification && modelClassification.confidence === "high") {
    return modelClassification;
  }

  // 2. URLによる判定
  const urlClassification = classifyByUrl(url);
  if (urlClassification && urlClassification.confidence === "high") {
    return urlClassification;
  }

  // 3. レスポンス構造による判定
  if (responseText) {
    const responseClassification = classifyByResponseStructure(responseText);
    if (responseClassification) {
      return responseClassification;
    }
  }

  // 4. 中程度の確信度でもあれば使用
  if (modelClassification) {
    return modelClassification;
  }
  if (urlClassification) {
    return urlClassification;
  }

  // 5. 不明
  return {
    provider: "unknown",
    confidence: "low",
    method: "heuristic",
    details: "No matching patterns found",
  };
}

// ============================================================================
// Provider Metadata
// ============================================================================

/**
 * プロバイダーの詳細情報
 */
export interface ProviderInfo {
  name: string;
  displayName: string;
  category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
  riskLevel: "low" | "medium" | "high";
  description: string;
}

/**
 * プロバイダー情報マップ
 */
export const PROVIDER_INFO: Record<ExtendedProvider, ProviderInfo> = {
  openai: {
    name: "openai",
    displayName: "OpenAI",
    category: "major",
    riskLevel: "low",
    description: "ChatGPT、GPT-4などの主要AIサービス",
  },
  anthropic: {
    name: "anthropic",
    displayName: "Anthropic",
    category: "major",
    riskLevel: "low",
    description: "Claudeシリーズを提供するAI安全研究企業",
  },
  google: {
    name: "google",
    displayName: "Google AI",
    category: "major",
    riskLevel: "low",
    description: "Gemini、PaLMなどのGoogle AIサービス",
  },
  azure: {
    name: "azure",
    displayName: "Azure OpenAI",
    category: "enterprise",
    riskLevel: "low",
    description: "Microsoft AzureでホストされるOpenAIモデル",
  },
  cohere: {
    name: "cohere",
    displayName: "Cohere",
    category: "enterprise",
    riskLevel: "low",
    description: "エンタープライズ向けNLPプラットフォーム",
  },
  mistral: {
    name: "mistral",
    displayName: "Mistral AI",
    category: "major",
    riskLevel: "low",
    description: "欧州発のオープンウェイトAIモデル",
  },
  meta: {
    name: "meta",
    displayName: "Meta AI",
    category: "open_source",
    riskLevel: "low",
    description: "Llamaシリーズのオープンソースモデル",
  },
  together: {
    name: "together",
    displayName: "Together.ai",
    category: "specialized",
    riskLevel: "medium",
    description: "オープンソースモデルのホスティングサービス",
  },
  replicate: {
    name: "replicate",
    displayName: "Replicate",
    category: "specialized",
    riskLevel: "medium",
    description: "モデルランタイムプラットフォーム",
  },
  huggingface: {
    name: "huggingface",
    displayName: "Hugging Face",
    category: "open_source",
    riskLevel: "low",
    description: "AIモデルのオープンプラットフォーム",
  },
  perplexity: {
    name: "perplexity",
    displayName: "Perplexity AI",
    category: "specialized",
    riskLevel: "low",
    description: "AI検索エンジン",
  },
  groq: {
    name: "groq",
    displayName: "Groq",
    category: "specialized",
    riskLevel: "low",
    description: "高速AI推論プラットフォーム",
  },
  deepseek: {
    name: "deepseek",
    displayName: "DeepSeek",
    category: "regional",
    riskLevel: "medium",
    description: "中国発のAIモデル",
  },
  moonshot: {
    name: "moonshot",
    displayName: "Moonshot AI",
    category: "regional",
    riskLevel: "medium",
    description: "中国のAIスタートアップ",
  },
  zhipu: {
    name: "zhipu",
    displayName: "智谱AI (Zhipu)",
    category: "regional",
    riskLevel: "medium",
    description: "ChatGLMを提供する中国AI企業",
  },
  baidu: {
    name: "baidu",
    displayName: "百度 (Baidu)",
    category: "regional",
    riskLevel: "medium",
    description: "ERNIE/文心一言を提供する中国テック企業",
  },
  alibaba: {
    name: "alibaba",
    displayName: "阿里巴巴 (Alibaba)",
    category: "regional",
    riskLevel: "medium",
    description: "Qwen/通義千問を提供する中国テック企業",
  },
  unknown: {
    name: "unknown",
    displayName: "未知のAIサービス",
    category: "specialized",
    riskLevel: "high",
    description: "分類できないAIサービス（Shadow AI）",
  },
};

/**
 * プロバイダー情報を取得
 */
export function getProviderInfo(provider: ExtendedProvider): ProviderInfo {
  return PROVIDER_INFO[provider] || PROVIDER_INFO.unknown;
}

/**
 * Shadow AIかどうかを判定
 * - unknown
 * - regional（地域特化型）
 * - riskLevel: high/medium
 */
export function isShadowAI(provider: ExtendedProvider): boolean {
  if (provider === "unknown") return true;

  const info = PROVIDER_INFO[provider];
  if (!info) return true;

  // 地域特化型はShadow AIとしてマーク
  if (info.category === "regional") return true;

  // リスクレベルがmedium以上はShadow AI候補
  if (info.riskLevel === "high" || info.riskLevel === "medium") return true;

  return false;
}
