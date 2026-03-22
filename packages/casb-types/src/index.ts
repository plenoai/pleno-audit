/**
 * @fileoverview CASB Domain Types
 *
 * Cloud Access Security Broker (CASB) ドメインの型定義。
 * SaaSサービスの可視化とリスク評価を担う。
 */

import type {
  CSPViolationDetails,
  NetworkRequestDetails,
} from "@pleno-audit/csp";
import type {
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  InferredProvider,
  ExtendedProvider,
} from "@pleno-audit/ai-detector";
import type { TyposquatDetectedDetails } from "@pleno-audit/typosquat";

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
// Event Sourcing (イベントソーシング)
// ----------------------------------------------------------------------------
// サービス利用に関するイベントを時系列で記録する。
// 監査ログ、コンプライアンスレポート、リスク分析の基盤となる。
// ============================================================================

/** ログイン検出イベントの詳細 */
export interface LoginDetectedDetails {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

/** プライバシーポリシー発見イベントの詳細 */
export interface PrivacyPolicyFoundDetails {
  url: string;
  method: string;
}

/** 利用規約発見イベントの詳細 */
export interface TosFoundDetails {
  url: string;
  method: string;
}

/** クッキーポリシー発見イベントの詳細 */
export interface CookiePolicyFoundDetails {
  url: string;
  method: string;
}

/** クッキーバナー検出イベントの詳細 */
export interface CookieBannerDetectedDetails {
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

/** Cookie設定イベントの詳細 */
export interface CookieSetDetails {
  name: string;
  isSession: boolean;
}

/** NRD検出イベントの詳細 */
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

/** 拡張機能リクエストイベントの詳細 */
export interface ExtensionRequestDetails {
  extensionId: string;
  extensionName: string;
  url: string;
  method: string;
  resourceType: string;
  statusCode?: number;
}

/** AI機密情報検出イベントの詳細 */
export interface AISensitiveDataDetectedDetails {
  provider: string;
  model?: string;
  classifications: string[];
  highestRisk: string | null;
  detectionCount: number;
  riskScore: number;
  riskLevel: string;
}

/**
 * イベントログ基底型
 * - Discriminated Union パターンで型安全なイベント処理を実現
 */
export type EventLogBase<T extends string, D> = {
  id: string;
  type: T;
  domain: string;
  timestamp: number;
  details: D;
};

/**
 * CASBイベントログ
 * - login_detected: Shadow IT検出
 * - privacy_policy_found: コンプライアンス監視
 * - terms_of_service_found: リスク評価
 * - cookie_policy_found: クッキーポリシー検出
 * - cookie_banner_detected: クッキーバナー検出
 * - cookie_set: セッション追跡
 * - csp_violation: セキュリティ監査
 * - network_request: トラフィック分析
 * - ai_prompt_sent: AIプロンプト送信
 * - ai_response_received: AIレスポンス受信
 * - nrd_detected: NRD判定検出
 * - typosquat_detected: タイポスクワッティング検出
 * - extension_request: 拡張機能のネットワークリクエスト
 * - ai_sensitive_data_detected: AI機密情報検出
 */
export type EventLog =
  | EventLogBase<"login_detected", LoginDetectedDetails>
  | EventLogBase<"privacy_policy_found", PrivacyPolicyFoundDetails>
  | EventLogBase<"terms_of_service_found", TosFoundDetails>
  | EventLogBase<"cookie_policy_found", CookiePolicyFoundDetails>
  | EventLogBase<"cookie_banner_detected", CookieBannerDetectedDetails>
  | EventLogBase<"cookie_set", CookieSetDetails>
  | EventLogBase<"csp_violation", CSPViolationDetails>
  | EventLogBase<"network_request", NetworkRequestDetails>
  | EventLogBase<"ai_prompt_sent", AIPromptSentDetails>
  | EventLogBase<"ai_response_received", AIResponseReceivedDetails>
  | EventLogBase<"nrd_detected", NRDDetectedDetails>
  | EventLogBase<"typosquat_detected", TyposquatDetectedDetails>
  | EventLogBase<"extension_request", ExtensionRequestDetails>
  | EventLogBase<"ai_sensitive_data_detected", AISensitiveDataDetectedDetails>;

export type EventLogType = EventLog["type"];
