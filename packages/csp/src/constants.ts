/**
 * @fileoverview Browser Security Domain: CSP Constants
 *
 * CSP（Content Security Policy）監査のためのドメイン知識を定義する。
 * CSPはブラウザのセキュリティ機構であり、SASE/CASBの概念には含まれない。
 */

import type { CSPConfig } from "./types.js";

// ============================================================================
// CSP Directive Mapping（CSPディレクティブマッピング）
// ----------------------------------------------------------------------------
// ネットワークリクエストの種類からCSPディレクティブへのマッピング。
// ブラウザが発行するリクエストタイプを適切なCSPルールに対応付ける。
// ============================================================================

/**
 * リクエストタイプ → CSPディレクティブ マッピング
 *
 * 使用例: ネットワークリクエストを収集し、CSPポリシーを自動生成する際に
 * どのディレクティブに割り当てるかを決定する。
 */
export const INITIATOR_TO_DIRECTIVE: Record<string, string> = {
  fetch: "connect-src",
  xhr: "connect-src",
  websocket: "connect-src",
  beacon: "connect-src",
  script: "script-src",
  style: "style-src",
  img: "img-src",
  font: "font-src",
  media: "media-src",
  object: "object-src",
  frame: "frame-src",
  iframe: "frame-src",
  worker: "worker-src",
  manifest: "manifest-src",
};

// ============================================================================
// CSP Security Levels（CSPセキュリティレベル）
// ----------------------------------------------------------------------------
// CSPポリシー生成時に考慮すべきディレクティブの分類。
// ============================================================================

/**
 * 厳格モード対象ディレクティブ
 * - これらのディレクティブは 'unsafe-inline' や 'unsafe-eval' を避けるべき
 */
export const STRICT_DIRECTIVES = ["script-src", "style-src", "default-src"];

/**
 * 必須ディレクティブ
 * - 最低限のCSPポリシーで必ず定義すべきディレクティブ
 * - OWASP推奨に基づく
 */
export const REQUIRED_DIRECTIVES = [
  "default-src",
  "script-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
];

// ============================================================================
// CSP Collection Configuration（CSP収集設定）
// ----------------------------------------------------------------------------
// CSP違反とネットワークリクエストの収集に関するデフォルト設定。
// ============================================================================

/** CSP収集のデフォルト設定 */
export const DEFAULT_CSP_CONFIG: CSPConfig = {
  enabled: true,
  collectNetworkRequests: true,
  collectCSPViolations: true,
  maxStoredReports: 1000,
};
