/**
 * Security Hooks のテスト
 *
 * export化された定数と検出ロジックの直接テスト。
 */
import { describe, it, expect, vi } from "vitest";
import {
  KNOWN_CDNS,
  SENSITIVE_TYPES,
  SENSITIVE_NAMES,
  CRYPTO_PATTERNS,
  SUSPICIOUS_EXTENSIONS,
  OAUTH_PATH_SEGMENTS,
  looksLikeOAuthCallback,
  hasSensitiveFields,
} from "./security-hooks.js";

// Minimal HTMLFormElement mock for hasSensitiveFields testing
function createMockForm(inputs: Array<{ type?: string; name?: string; id?: string; autocomplete?: string }>): HTMLFormElement {
  const inputElements = inputs.map(attrs => ({
    type: attrs.type || "",
    name: attrs.name || "",
    id: attrs.id || "",
    autocomplete: attrs.autocomplete || "",
  }));
  return {
    querySelectorAll: (_selector: string) => inputElements,
  } as unknown as HTMLFormElement;
}

describe("KNOWN_CDNS", () => {
  it("includes major CDN providers", () => {
    expect(KNOWN_CDNS).toContain("cdnjs.cloudflare.com");
    expect(KNOWN_CDNS).toContain("cdn.jsdelivr.net");
    expect(KNOWN_CDNS).toContain("unpkg.com");
    expect(KNOWN_CDNS).toContain("ajax.googleapis.com");
  });

  it("matches CDN subdomains via includes()", () => {
    const host = "cdn.jsdelivr.net";
    expect(KNOWN_CDNS.some(cdn => host.includes(cdn))).toBe(true);
  });

  it("does not match non-CDN domains", () => {
    expect(KNOWN_CDNS.some(cdn => "evil-cdn.example.com".includes(cdn))).toBe(false);
  });
});

describe("SENSITIVE_TYPES and SENSITIVE_NAMES", () => {
  it("covers credential field types", () => {
    expect(SENSITIVE_TYPES).toContain("password");
    expect(SENSITIVE_TYPES).toContain("email");
    expect(SENSITIVE_TYPES).toContain("tel");
  });

  it("covers credential field names", () => {
    for (const name of ["password", "token", "api_key", "cvv", "ssn", "otp", "credential"]) {
      expect(SENSITIVE_NAMES).toContain(name);
    }
  });

  it("uses substring matching for names", () => {
    expect(SENSITIVE_NAMES.some(p => "user_password_confirm".includes(p))).toBe(true);
  });

  it("does not false-positive on normal field names", () => {
    for (const name of ["city", "address", "phone"]) {
      expect(SENSITIVE_NAMES.some(p => name.includes(p))).toBe(false);
    }
  });
});

describe("CRYPTO_PATTERNS", () => {
  it("detects valid Bitcoin addresses", () => {
    expect(CRYPTO_PATTERNS.bitcoin.test("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
    expect(CRYPTO_PATTERNS.bitcoin.test("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe(true);
  });

  it("detects valid Ethereum addresses", () => {
    expect(CRYPTO_PATTERNS.ethereum.test("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08")).toBe(true);
  });

  it("detects valid Litecoin addresses", () => {
    expect(CRYPTO_PATTERNS.litecoin.test("LQTpSKPfbMv3KSVZ5L7Bq3VNxoAcq3MLD4")).toBe(true);
  });

  it("detects valid Ripple addresses", () => {
    expect(CRYPTO_PATTERNS.ripple.test("rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv")).toBe(true);
  });

  it("rejects non-crypto strings", () => {
    for (const str of ["hello world", "not-an-address", "12345", "0xGGGG"]) {
      for (const pattern of Object.values(CRYPTO_PATTERNS)) {
        expect(pattern.test(str)).toBe(false);
      }
    }
  });
});

describe("SUSPICIOUS_EXTENSIONS", () => {
  it("includes executable extensions", () => {
    expect(SUSPICIOUS_EXTENSIONS).toContain(".exe");
    expect(SUSPICIOUS_EXTENSIONS).toContain(".msi");
    expect(SUSPICIOUS_EXTENSIONS).toContain(".bat");
  });

  it("does not include safe extensions", () => {
    expect(SUSPICIOUS_EXTENSIONS).not.toContain(".pdf");
    expect(SUSPICIOUS_EXTENSIONS).not.toContain(".txt");
    expect(SUSPICIOUS_EXTENSIONS).not.toContain(".png");
  });

  it("handles double extension filenames", () => {
    const ext = "." + "document.pdf.exe".split(".").pop()!.toLowerCase();
    expect(SUSPICIOUS_EXTENSIONS.includes(ext)).toBe(true);
  });
});

describe("OAUTH_PATH_SEGMENTS", () => {
  it("includes standard OAuth path segments", () => {
    for (const seg of ["/callback", "/auth", "/oauth", "/authorize", "/sso", "/token"]) {
      expect(OAUTH_PATH_SEGMENTS).toContain(seg);
    }
  });
});

describe("looksLikeOAuthCallback", () => {
  it("detects OAuth 2.0 Authorization Code callback", () => {
    const url = new URL("https://secure.freee.co.jp/walletables/auth/netbk/callback?code=AAPF4FuzGkP31wgpJPNICDV7ArM8hss2&state=e57dff8188c04e94a7fd2b1c4279415f");
    expect(looksLikeOAuthCallback(url)).toBe(true);
  });

  it("detects callback with minimum code length (8 chars)", () => {
    const url = new URL("https://example.com/oauth/callback?code=12345678&state=abc");
    expect(looksLikeOAuthCallback(url)).toBe(true);
  });

  it("rejects short code (< 8 chars)", () => {
    const url = new URL("https://example.com/auth/callback?code=JP&state=abc");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("rejects missing state parameter", () => {
    const url = new URL("https://example.com/auth/callback?code=AAPF4FuzGkP31wgp");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("rejects missing code parameter", () => {
    const url = new URL("https://example.com/auth/callback?state=e57dff81");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("rejects URL without query params", () => {
    const url = new URL("https://example.com/some/page");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("rejects non-OAuth path with code+state", () => {
    const url = new URL("https://evil.com/search?code=AAPF4FuzGkP31wgp&state=abc");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("rejects attacker URL without OAuth path", () => {
    const url = new URL("https://evil.com/steal?code=AAPF4FuzGkP31wgp&state=abc");
    expect(looksLikeOAuthCallback(url)).toBe(false);
  });

  it("matches case-insensitively on path", () => {
    const url = new URL("https://example.com/OAuth/Callback?code=AAPF4FuzGkP31wgp&state=abc");
    expect(looksLikeOAuthCallback(url)).toBe(true);
  });
});

describe("hasSensitiveFields", () => {
  it("detects password input by type", () => {
    const form = createMockForm([{ type: "password", name: "pass" }]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(true);
    expect(result.fieldType).toBe("password");
  });

  it("detects email input by type", () => {
    const form = createMockForm([{ type: "email", name: "user_email" }]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(true);
    expect(result.fieldType).toBe("email");
  });

  it("detects sensitive field by name pattern", () => {
    const form = createMockForm([{ type: "text", name: "api_key_value" }]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(true);
    expect(result.fieldType).toBe("api_key");
  });

  it("detects sensitive field by id pattern", () => {
    const form = createMockForm([{ type: "text", id: "user_token" }]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(true);
    expect(result.fieldType).toBe("token");
  });

  it("detects sensitive field by autocomplete", () => {
    const form = createMockForm([{ type: "text", autocomplete: "cc-number" }]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(true);
  });

  it("returns false for form with no sensitive fields", () => {
    const form = createMockForm([
      { type: "text", name: "username" },
      { type: "text", name: "city" },
    ]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(false);
    expect(result.fieldType).toBeNull();
  });

  it("returns false for empty form", () => {
    const form = createMockForm([]);
    const result = hasSensitiveFields(form);
    expect(result.hasSensitive).toBe(false);
  });

  it("detects OTP field by name", () => {
    const form = createMockForm([{ type: "text", name: "otp_code" }]);
    expect(hasSensitiveFields(form).hasSensitive).toBe(true);
  });

  it("detects CVV field by name", () => {
    const form = createMockForm([{ type: "text", name: "cvv" }]);
    expect(hasSensitiveFields(form).hasSensitive).toBe(true);
  });

  it("detects 2FA/MFA by name", () => {
    const form = createMockForm([{ type: "text", name: "2fa_code" }]);
    expect(hasSensitiveFields(form).hasSensitive).toBe(true);
    const form2 = createMockForm([{ type: "text", name: "mfa_token" }]);
    expect(hasSensitiveFields(form2).hasSensitive).toBe(true);
  });
});
