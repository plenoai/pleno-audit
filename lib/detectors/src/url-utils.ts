/**
 * @fileoverview Infrastructure Layer: URL Utilities
 *
 * ドメインに依存しない技術インフラ層。
 * URL処理に関する共通ユーティリティを提供する。
 *
 * 使用箇所:
 * - lib/detectors: ポリシーURL検出時のURL正規化
 * - app/audit-extension: コンテンツスクリプトでのURL解析
 *
 * 設計原則:
 * - 純粋関数のみ（副作用なし）
 * - エラー耐性（不正なURLでもクラッシュしない）
 * - ドメインロジックを含まない
 */

// ============================================================================
// URL Decoding（URLデコード）
// ============================================================================

/**
 * 安全なURLデコード
 * - 不正なエンコーディングでも例外を投げない
 * - 日本語等のエンコードされたURLを処理可能
 */
export function decodeUrlSafe(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

// ============================================================================
// URL Parsing（URL解析）
// ============================================================================

/**
 * URLからパス部分を抽出
 * - パターンマッチングに使用
 */
export function getPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * URLからオリジン（スキーム + ホスト + ポート）を抽出
 * - ドメイン識別に使用
 */
export function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ============================================================================
// URL Resolution（URL解決）
// ============================================================================

/**
 * 相対URLを絶対URLに解決
 * - href属性の相対パスを完全なURLに変換
 */
export function resolveUrl(href: string, baseOrigin: string): string {
  return new URL(href, baseOrigin).href;
}
