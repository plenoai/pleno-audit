/**
 * @fileoverview Security Detection Patterns
 *
 * ブラウザセキュリティ検出に使用するパターン定数の正規ソース。
 * main-worldフック（public/api-hooks.js等）でも同等のパターンが使用されるが、
 * main-worldスクリプトはESモジュールimportが不可のため、そちらはインライン定義となる。
 * パターンの追加・変更時は両方を更新すること。
 */

// ============================================================================
// Credential Theft Detection
// ============================================================================

/** 機密入力フィールドのtype属性 */
export const SENSITIVE_INPUT_TYPES = [
  "password",
  "email",
  "tel",
  "credit-card",
] as const;

/** 機密入力フィールドのname/id属性パターン */
export const SENSITIVE_FIELD_NAMES = [
  "password", "passwd", "pwd", "pass", "secret",
  "token", "api_key", "apikey",
  "credit", "card", "cvv", "ssn",
  "otp", "pin", "auth", "credential",
  "2fa", "mfa",
] as const;

/**
 * フォーム内に機密フィールドが含まれるか判定
 */
export function hasSensitiveField(
  inputs: { type: string; name: string; id: string; autocomplete: string }[],
): { hasSensitive: boolean; fieldType: string | null } {
  for (const input of inputs) {
    const type = input.type.toLowerCase();
    const name = input.name.toLowerCase();
    const id = input.id.toLowerCase();
    const autocomplete = input.autocomplete.toLowerCase();

    if ((SENSITIVE_INPUT_TYPES as readonly string[]).includes(type)) {
      return { hasSensitive: true, fieldType: type };
    }
    for (const pattern of SENSITIVE_FIELD_NAMES) {
      if (name.includes(pattern) || id.includes(pattern)) {
        return { hasSensitive: true, fieldType: pattern };
      }
    }
    if (autocomplete.includes("password") || autocomplete.includes("cc-")) {
      return { hasSensitive: true, fieldType: autocomplete };
    }
  }
  return { hasSensitive: false, fieldType: null };
}

// ============================================================================
// Cryptocurrency Address Detection
// ============================================================================

/** 暗号通貨アドレスの正規表現パターン */
export const CRYPTO_ADDRESS_PATTERNS: Record<string, RegExp> = {
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
  ripple: /^r[0-9a-zA-Z]{24,34}$/,
};

/**
 * テキストが暗号通貨アドレスに一致するか判定
 */
export function detectCryptoAddress(text: string): { match: boolean; type: string | null } {
  for (const [type, pattern] of Object.entries(CRYPTO_ADDRESS_PATTERNS)) {
    if (pattern.test(text)) {
      return { match: true, type };
    }
  }
  return { match: false, type: null };
}

// ============================================================================
// XSS Detection
// ============================================================================

/** XSSインジェクションパターン */
export const XSS_PATTERNS: RegExp[] = [
  /<script[^>]*>[^<]+/i,
  /javascript:\s*[^"'\s]/i,
  /on(error|load)\s*=\s*["'][^"']*eval/i,
  /<iframe[^>]*src\s*=\s*["']?javascript:/i,
];

/**
 * テキストにXSSパターンが含まれるか判定
 */
export function containsXSSPattern(value: string): boolean {
  return XSS_PATTERNS.some((p) => p.test(value));
}

// ============================================================================
// Suspicious Download Detection
// ============================================================================

/** 危険なファイル拡張子 */
export const SUSPICIOUS_FILE_EXTENSIONS = [
  ".exe", ".msi", ".bat", ".ps1", ".cmd",
  ".scr", ".vbs", ".js", ".jar", ".dll",
] as const;

/**
 * ファイル名が危険な拡張子を持つか判定
 */
export function isSuspiciousFileExtension(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return (SUSPICIOUS_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

// ============================================================================
// Supply Chain Risk Detection
// ============================================================================

/** 既知のCDNドメイン */
export const KNOWN_CDN_DOMAINS = [
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "ajax.googleapis.com",
  "code.jquery.com",
  "stackpath.bootstrapcdn.com",
  "maxcdn.bootstrapcdn.com",
  "cdn.bootcdn.net",
  "lib.baomitu.com",
  "cdn.staticfile.org",
] as const;

/**
 * ホスト名が既知のCDNか判定
 */
export function isKnownCDN(hostname: string): boolean {
  return KNOWN_CDN_DOMAINS.some((cdn) => hostname.includes(cdn));
}
