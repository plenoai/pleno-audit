/**
 * @fileoverview Zero Trust Browser Security — Core Types
 *
 * libztbsの基盤型定義。全パッケージはこのパッケージの型に依存可能。
 * このパッケージ自体はゼロ依存。
 */

// ============================================================================
// AI Provider Types
// ============================================================================

/** 推定されたAIプロバイダー */
export type InferredProvider =
  | "openai" // ChatGPT, API
  | "anthropic" // Claude
  | "google" // Gemini
  | "unknown"; // 汎用検出

/** 拡張AIプロバイダー（既存+新規） */
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

// ============================================================================
// SaaS Visibility (サービス可視性)
// ----------------------------------------------------------------------------
// Shadow ITの検出と可視化を担う。組織が把握していないSaaSサービスの利用を
// 検出し、リスク評価のための情報を収集する。
// ============================================================================

/**
 * 検出されたSaaSサービス
 * - domain: サービスの識別子（FQDN）
 * - hasLoginPage: 認証機能の有無（Shadow IT判定に使用）
 * - privacyPolicyUrl: コンプライアンス評価用
 * - termsOfServiceUrl: リスク評価用
 * - cookies: セッション追跡情報
 * - nrdResult: NRD判定結果
 */
export interface DetectedService {
  domain: string;
  detectedAt: number;
  hasLoginPage: boolean;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  faviconUrl?: string | null;
  cookies: CookieInfo[];
  nrdResult?: {
    isNRD: boolean;
    confidence: "high" | "medium" | "low" | "unknown";
    domainAge: number | null;
    checkedAt: number;
  };
  typosquatResult?: {
    isTyposquat: boolean;
    confidence: "high" | "medium" | "low" | "none";
    totalScore: number;
    checkedAt: number;
  };
  /** ネットワーク通信で検出された機密データの種類（email, credit_card等） */
  sensitiveDataDetected?: string[];
  aiDetected?: {
    hasAIActivity: boolean;
    lastActivityAt: number;
    providers: (InferredProvider | ExtendedProvider)[];
    /** 機密情報が検出されたか */
    hasSensitiveData?: boolean;
    /** 検出された機密情報の種類 */
    sensitiveDataTypes?: string[];
    /** 最大リスクレベル */
    riskLevel?: "critical" | "high" | "medium" | "low" | "info";
    /** Shadow AIが検出されたか（未承認AIサービス） */
    hasShadowAI?: boolean;
    /** 検出されたShadow AIプロバイダー */
    shadowAIProviders?: ExtendedProvider[];
  };
}

/**
 * Cookie情報
 * - isSession: セッションCookieか否か（認証状態の追跡に使用）
 */
export interface CookieInfo {
  name: string;
  domain: string;
  detectedAt: number;
  isSession: boolean;
}

// ============================================================================
// Detection Details (検出結果の詳細型)
// ============================================================================

/** ログイン検出の詳細 */
export interface LoginDetectedDetails {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

/** プライバシーポリシー発見の詳細 */
export interface PrivacyPolicyFoundDetails {
  url: string;
  method: string;
}

/** 利用規約発見の詳細 */
export interface TosFoundDetails {
  url: string;
  method: string;
}

/** クッキーポリシー発見の詳細 */
export interface CookiePolicyFoundDetails {
  url: string;
  method: string;
}

/** クッキーバナー検出の詳細 */
export interface CookieBannerDetectedDetails {
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

/** Cookie設定の詳細 */
export interface CookieSetDetails {
  name: string;
  isSession: boolean;
}

/** NRD検出の詳細 */
export interface NRDDetectedDetails {
  isNRD: boolean;
  confidence: "high" | "medium" | "low" | "unknown";
  registrationDate: string | null;
  domainAge: number | null;
  method: "rdap" | "suspicious" | "cache" | "error";
  suspiciousScore: number;
  isDDNS: boolean;
  ddnsProvider: string | null;
}

/** 拡張機能リクエストの詳細 */
export interface ExtensionRequestDetails {
  extensionId: string;
  extensionName: string;
  url: string;
  method: string;
  resourceType: string;
  statusCode?: number;
}

/** AI機密情報検出の詳細 */
export interface AISensitiveDataDetectedDetails {
  provider: string;
  model?: string;
  classifications: string[];
  highestRisk: string | null;
  detectionCount: number;
  riskScore: number;
  riskLevel: string;
}

// ============================================================================
// Service Aggregation (サービス集約)
// ============================================================================

/** サービスに付与されるタグ */
export type ServiceTag =
  | { type: "nrd"; domainAge: number | null; confidence: string }
  | { type: "typosquat"; score: number; confidence: string }
  | { type: "ai" }
  | { type: "login" }
  | { type: "privacy"; url: string }
  | { type: "tos"; url: string }
  | { type: "cookie"; count: number };

/** 通信先情報 */
export interface ConnectionInfo {
  domain: string;
  requestCount: number;
}

/** サービスのソース（ドメインまたは拡張機能） */
export type ServiceSource =
  | { type: "domain"; domain: string; service: DetectedService }
  | { type: "extension"; extensionId: string; extensionName: string; icon?: string };

/** 統合サービスモデル */
export interface UnifiedService {
  id: string;
  source: ServiceSource;
  connections: ConnectionInfo[];
  tags: ServiceTag[];
  lastActivity: number;
  faviconUrl?: string;
}

/** ソートタイプ */
export type SortType = "activity" | "connections" | "name";

