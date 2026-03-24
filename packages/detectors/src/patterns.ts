/**
 * @fileoverview CASB Detection Domain Knowledge
 *
 * このファイルはCASB（Cloud Access Security Broker）における
 * サービス検出のためのドメイン知識を定義する。
 *
 * ドメインサブセクション:
 * 1. Authentication Detection（認証検出）- Shadow IT検出用
 * 2. Privacy Policy Detection（プライバシーポリシー検出）- コンプライアンス監視用
 * 3. Terms of Service Detection（利用規約検出）- リスク評価用
 * 4. Session Detection（セッション検出）- アクセス追跡用
 */

// ============================================================================
// 1. Authentication Detection（認証検出）
// ----------------------------------------------------------------------------
// Shadow IT検出のコア機能。ログインページの存在は、そのサービスが
// ユーザー認証を必要とする＝データを保存/処理する可能性を示す。
// ============================================================================

/** ログインページURL判定パターン */
export const LOGIN_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/auth/i,
  /\/authenticate/i,
  /\/session\/new/i,
  // Passwordless & OAuth patterns
  /\/oauth/i,
  /\/sso/i,
  /\/saml/i,
  /\/oidc/i,
  /\/oauth\/callback/i,
  /\/auth\/callback/i,
  /\/sso\/callback/i,
  /\/authorize/i,
];

/** ソーシャルログインボタンテキスト判定パターン（多言語対応） */
export const SOCIAL_LOGIN_TEXT_PATTERNS = [
  // English
  /sign\s*in\s*with/i,
  /continue\s*with/i,
  /log\s*in\s*with/i,
  // Japanese
  /でログイン/,
  /で続行/,
  /でサインイン/,
  // Generic patterns
  /oauth/i,
  /sso/i,
];

// ============================================================================
// 2. Privacy Policy Detection（プライバシーポリシー検出）
// ----------------------------------------------------------------------------
// コンプライアンス監視機能。GDPR、CCPA等の規制対応状況を評価するために
// プライバシーポリシーの存在と内容を検出する。多言語対応。
// ============================================================================

/** プライバシーポリシーURL判定パターン（多言語対応） */
export const PRIVACY_URL_PATTERNS = [
  /\/privacy[-_]?policy/i,
  /\/privacy/i,
  /\/legal\/privacy/i,
  /\/terms\/privacy/i,
  /\/about\/privacy/i,
  /\/privacypolicy/i,
  // German
  /\/datenschutz/i,
  // Japanese (decoded)
  /プライバシー/,
];

/** プライバシーポリシーリンクテキスト判定パターン（多言語対応） */
export const PRIVACY_TEXT_PATTERNS = [
  /privacy\s*policy/i,
  /privacy\s*notice/i,
  /privacy/i,
  /プライバシー\s*ポリシー/,
  /プライバシー/,
  /個人情報\s*保護/,
  /個人情報の取り扱い/,
  /個人情報について/,
  // German
  /datenschutz/i,
  // Korean
  /개인정보/,
  // Chinese
  /隐私/,
  /隱私/,
];

/** JSON-LDメタデータのプライバシーポリシーキー */
export const JSONLD_PRIVACY_KEYS = ["privacyPolicy", "privacyUrl"];

/** link[rel]属性のプライバシーポリシー値 */
export const LINK_REL_PRIVACY_VALUES = ["privacy-policy", "privacy"];

/** OGメタタグのプライバシーポリシーパターン */
export const OG_PRIVACY_PATTERNS = [/privacy/i, /datenschutz/i];

/** フッター領域セレクタ（ポリシーリンク検索用） */
export const FOOTER_SELECTORS = [
  "footer a",
  '[class*="footer"] a',
  '[id*="footer"] a',
  '[role="contentinfo"] a',
  '[class*="legal"] a',
  '[class*="bottom"] a',
];

// ============================================================================
// 3. Terms of Service Detection（利用規約検出）
// ----------------------------------------------------------------------------
// リスク評価機能。利用規約の存在と内容を検出し、データ利用ポリシー、
// 責任範囲、知的財産権等のリスク要因を特定する。多言語対応。
// ============================================================================

/** 利用規約URL判定パターン（多言語対応） */
export const TOS_URL_PATTERNS = [
  // Basic patterns
  /\/terms[-_]?of[-_]?service/i,
  /\/terms[-_]?of[-_]?use/i,
  /\/terms[-_]?and[-_]?conditions/i,
  /\/terms/i,
  /\/legal\/terms/i,
  /\/tos/i,
  /\/eula/i,
  // Additional patterns
  /\/user[-_]?agreement/i,
  /\/service[-_]?agreement/i,
  /\/legal\/tos/i,
  /\/legal\/user[-_]?agreement/i,
  /\/policies\/terms/i,
  // German
  /\/agb/i,
  /\/nutzungsbedingungen/i,
  // French
  /\/conditions[-_]?utilisation/i,
  /\/cgu/i,
  // Spanish
  /\/terminos/i,
  /\/condiciones/i,
  // Italian
  /\/termini[-_]?servizio/i,
  // Japanese (URL encoded)
  /\/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84/i,
];

/** 利用規約リンクテキスト判定パターン（多言語対応） */
export const TOS_TEXT_PATTERNS = [
  // English
  /terms\s*of\s*service/i,
  /terms\s*of\s*use/i,
  /terms\s*(&|and)\s*conditions/i,
  /user\s*agreement/i,
  /service\s*agreement/i,
  /end\s*user\s*license\s*agreement/i,
  /eula/i,
  // Japanese
  /利用\s*規約/,
  /ご利用\s*規約/,
  /サービス\s*利用\s*規約/,
  /サービス規約/,
  /ご利用条件/,
  // German
  /allgemeine\s*gesch.ftsbedingungen/i,
  /agb/i,
  /nutzungsbedingungen/i,
  // French
  /conditions\s*(g.n.rales\s*)?d['']utilisation/i,
  /cgu/i,
  // Spanish
  /t.rminos\s*(y\s*condiciones|de\s*servicio|de\s*uso)/i,
  // Italian
  /termini\s*(di\s*servizio|e\s*condizioni)/i,
  // Chinese (Simplified & Traditional)
  /服务\s*条款/,
  /使用\s*条款/,
  /服務\s*條款/,
  // Korean
  /이용\s*약관/,
  /서비스\s*약관/,
];

/** JSON-LDメタデータの利用規約キー */
export const TOS_JSONLD_KEYS = ["termsOfService", "termsUrl"];

/** link[rel]属性の利用規約値 */
export const TOS_LINK_REL_VALUES = ["terms-of-service", "terms", "tos"];

/** OGメタタグの利用規約パターン */
export const TOS_OG_PATTERNS = [/terms/i, /tos/i, /agb/i];

// ============================================================================
// 4. Cookie Policy Detection（クッキーポリシー検出）
// ----------------------------------------------------------------------------
// GDPR/CCPA等のコンプライアンス監視機能。クッキーポリシーの存在と
// クッキー同意バナーの有無を検出する。多言語対応。
// ============================================================================

/** クッキーポリシーURL判定パターン（多言語対応） */
export const COOKIE_POLICY_URL_PATTERNS = [
  // Basic patterns
  /\/cookie[-_]?policy/i,
  /\/cookies[-_]?policy/i,
  /\/cookie[-_]?notice/i,
  /\/cookies/i,
  /\/legal\/cookies/i,
  /\/policies\/cookies/i,
  // German
  /\/cookie[-_]?richtlinie/i,
  // French
  /\/politique[-_]?cookies/i,
  // Spanish
  /\/politica[-_]?cookies/i,
  // Japanese (URL encoded)
  /\/%E3%82%AF%E3%83%83%E3%82%AD%E3%83%BC/i,
];

/** クッキーポリシーリンクテキスト判定パターン（多言語対応） */
export const COOKIE_POLICY_TEXT_PATTERNS = [
  // English
  /cookie\s*policy/i,
  /cookie\s*notice/i,
  /cookie\s*settings/i,
  /cookie\s*preferences/i,
  /manage\s*cookies/i,
  /about\s*cookies/i,
  // Japanese
  /クッキー\s*ポリシー/,
  /クッキー\s*設定/,
  /Cookie\s*ポリシー/i,
  // German
  /cookie[-_]?richtlinie/i,
  // French
  /politique\s*(des\s*)?cookies/i,
  // Spanish
  /pol[íi]tica\s*(de\s*)?cookies/i,
  // Chinese
  /Cookie\s*政策/i,
  /Cookie\s*設置/i,
  // Korean
  /쿠키\s*정책/,
];

/** JSON-LDメタデータのクッキーポリシーキー */
export const COOKIE_JSONLD_KEYS = ["cookiePolicy", "cookiePolicyUrl"];

/** link[rel]属性のクッキーポリシー値 */
export const COOKIE_LINK_REL_VALUES = ["cookie-policy", "cookies"];

/** OGメタタグのクッキーポリシーパターン */
export const COOKIE_OG_PATTERNS = [/cookie/i];

/** クッキー同意バナー検出セレクタ */
export const COOKIE_BANNER_SELECTORS = [
  // Common consent banner IDs
  '[id*="cookie-consent"]',
  '[id*="cookie-banner"]',
  '[id*="cookie-notice"]',
  '[id*="gdpr"]',
  '[id*="consent"]',
  // Common consent banner classes
  '[class*="cookie-consent"]',
  '[class*="cookie-banner"]',
  '[class*="cookie-notice"]',
  '[class*="cookie-popup"]',
  '[class*="gdpr"]',
  '[class*="consent-banner"]',
  '[class*="consent-popup"]',
  // Common cookie management platforms
  '[id="CybotCookiebotDialog"]', // Cookiebot
  '[id="onetrust-consent-sdk"]', // OneTrust
  '[class*="cc-banner"]', // Cookie Consent
  '[class*="osano"]', // Osano
  '[id="truste-consent-track"]', // TrustArc
  '[id="usercentrics"]', // Usercentrics
  // ARIA role patterns
  '[role="dialog"][aria-label*="cookie" i]',
  '[role="dialog"][aria-label*="consent" i]',
];

/** クッキー同意ボタン検出パターン */
export const COOKIE_CONSENT_BUTTON_PATTERNS = [
  /accept\s*(all\s*)?cookies/i,
  /agree/i,
  /got\s*it/i,
  /ok/i,
  /すべて\s*受け入れる/,
  /同意/,
  /accepter/i,
  /akzeptieren/i,
  /aceptar/i,
];

// ============================================================================
// 5. Session Detection（セッション検出）
// ----------------------------------------------------------------------------
// アクセス追跡機能。セッションCookieの検出により、ユーザーの認証状態と
// サービス利用状況を追跡する。Shadow IT利用頻度の可視化に使用。
// ============================================================================

/** セッションCookie名判定パターン */
export const SESSION_COOKIE_PATTERNS = [
  /^sess/i,
  /session/i,
  /^sid$/i,
  /^auth/i,
  /^token/i,
  /^jwt/i,
  /^access[-_]?token/i,
  /^refresh[-_]?token/i,
  /_session$/i,
];

// ============================================================================
// Detection Helper Functions（検出ヘルパー関数）
// ----------------------------------------------------------------------------
// パターンマッチングのラッパー関数。各ドメインサブセクションの
// パターンを使用して、URL/テキスト/Cookie名を判定する。
// ============================================================================

/** ログインページURLか判定 */
export function isLoginUrl(url: string): boolean {
  return LOGIN_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/** プライバシーポリシーURLか判定 */
export function isPrivacyUrl(url: string): boolean {
  return PRIVACY_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/** プライバシーポリシーリンクテキストか判定 */
export function isPrivacyText(text: string): boolean {
  return PRIVACY_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

/** セッションCookieか判定 */
export function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE_PATTERNS.some((pattern) => pattern.test(name));
}

/** 利用規約URLか判定（URLエンコード対応） */
export function isTosUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url);
    return TOS_URL_PATTERNS.some(
      (pattern) => pattern.test(url) || pattern.test(decoded)
    );
  } catch {
    return TOS_URL_PATTERNS.some((pattern) => pattern.test(url));
  }
}

/** 利用規約リンクテキストか判定 */
export function isTosText(text: string): boolean {
  return TOS_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

/** クッキーポリシーURLか判定（URLエンコード対応） */
export function isCookiePolicyUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url);
    return COOKIE_POLICY_URL_PATTERNS.some(
      (pattern) => pattern.test(url) || pattern.test(decoded)
    );
  } catch {
    return COOKIE_POLICY_URL_PATTERNS.some((pattern) => pattern.test(url));
  }
}

/** クッキーポリシーリンクテキストか判定 */
export function isCookiePolicyText(text: string): boolean {
  return COOKIE_POLICY_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

/** クッキー同意ボタンテキストか判定 */
export function isCookieConsentButton(text: string): boolean {
  return COOKIE_CONSENT_BUTTON_PATTERNS.some((pattern) => pattern.test(text));
}
