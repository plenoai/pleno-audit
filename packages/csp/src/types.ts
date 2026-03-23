/**
 * @fileoverview Browser Security Domain: CSP Types
 *
 * Content Security Policy (CSP) の監査機能に関する型定義。
 * CSPはブラウザのセキュリティ機構であり、SASE/CASBの概念には含まれない。
 */

// ============================================================================
// CSP Violation & Network Request
// ============================================================================

/**
 * CSP違反レポート
 * - ブラウザが検出したCSP違反イベントを記録
 * - disposition: enforce（ブロック）またはreport（レポートのみ）
 */
export interface CSPViolation {
  type: "csp-violation";
  timestamp: string;
  pageUrl: string;
  directive: string;
  blockedURL: string;
  domain: string;
  disposition: "enforce" | "report";
  originalPolicy?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
}

/**
 * ネットワークリクエスト記録
 * - CSPポリシー生成のためのリクエスト情報
 * - initiator: リクエスト発生元の種別
 */
export interface NetworkRequest {
  type: "network-request";
  timestamp: string;
  pageUrl: string;
  url: string;
  method: string;
  initiator:
    | "fetch"
    | "xhr"
    | "websocket"
    | "beacon"
    | "script"
    | "img"
    | "style"
    | "frame"
    | "font"
    | "media";
  domain: string;
  resourceType?: string;
}

/** CSPレポート（違反 or ネットワークリクエスト） */
export type CSPReport = CSPViolation | NetworkRequest;

// ============================================================================
// CSP Policy Generation
// ============================================================================

/**
 * 生成されたCSPポリシー
 * - policy: ディレクティブ → ソースリストのマップ
 * - policyString: HTTP ヘッダー形式の文字列
 * - recommendations: セキュリティ改善提案
 */
export interface GeneratedCSPPolicy {
  policy: Record<string, string[]>;
  policyString: string;
  statistics: CSPStatistics;
  recommendations: SecurityRecommendation[];
}

/** CSP統計情報 */
export interface CSPStatistics {
  totalReports: number;
  cspViolations: number;
  networkRequests: number;
  uniqueDomains: string[];
  byDirective: Record<string, number>;
  byDomain: Record<string, number>;
}

/**
 * セキュリティ推奨事項
 * - severity: リスクレベル（critical > high > medium > low）
 */
export interface SecurityRecommendation {
  severity: "critical" | "high" | "medium" | "low";
  directive: string;
  message: string;
  suggestion: string;
}

// ============================================================================
// CSP Configuration
// ============================================================================

/** CSP収集設定 */
export interface CSPConfig {
  enabled: boolean;
  collectNetworkRequests: boolean;
  collectCSPViolations: boolean;
  maxStoredReports: number;
}

/** CSPポリシー生成オプション */
export interface CSPGenerationOptions {
  strictMode: boolean;
  includeNonce: boolean;
  includeReportUri: boolean;
  reportUri: string;
  defaultSrc: string;
}

// ============================================================================
// CSP Detection Details
// ============================================================================

/** CSP違反の詳細 */
export interface CSPViolationDetails {
  directive: string;
  blockedURL: string;
  disposition: "enforce" | "report";
  pageUrl?: string;
  originalPolicy?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
}

/** ネットワークリクエストの詳細 */
export interface NetworkRequestDetails {
  url: string;
  method: string;
  initiator: string;
  pageUrl?: string;
  resourceType?: string;
}
