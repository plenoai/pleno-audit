/**
 * SSOManager Unit Tests
 *
 * テスト対象: 純粋なロジック部分
 * - セッション有効期限判定
 * - 設定バリデーション
 * - ステータス計算ロジック
 *
 * テスト対象外（外部依存・E2Eでテスト）:
 * - chrome.identity.launchWebAuthFlow
 * - chrome.storage.*
 * - fetch API
 * - 実際の認証フロー
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("@libztbs/extension-runtime", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
  getBrowserAPI: () => chrome,
  hasIdentityAPI: () => !!chrome.identity,
  getSessionStorage: vi.fn().mockResolvedValue(null),
  setSessionStorage: vi.fn().mockResolvedValue(undefined),
  removeSessionStorage: vi.fn().mockResolvedValue(undefined),
}));

// Mock chrome API - 最小限のモック
const mockChrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  identity: {
    getRedirectURL: vi.fn().mockReturnValue("https://extension.chromiumapp.org/callback"),
    launchWebAuthFlow: vi.fn(),
  },
};
vi.stubGlobal("chrome", mockChrome);

// Mock fetch
vi.stubGlobal("fetch", vi.fn());

import { createSSOManager, type SSOSession } from "./sso-manager.js";

const FIXED_NOW = new Date("2025-03-15T12:00:00Z").getTime();

describe("SSOManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: FIXED_NOW });
    mockChrome.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 設定バリデーションテスト
   * テスト対象: setConfig() のバリデーションロジック
   * 検証内容: OIDC/SAMLの必須フィールドチェック
   */
  describe("config validation", () => {
    it("rejects OIDC config without clientId", async () => {
      const manager = await createSSOManager();
      const result = await manager.setConfig({
        provider: "oidc",
        clientId: "", // 空
        authority: "https://auth.example.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects OIDC config without authority", async () => {
      const manager = await createSSOManager();
      const result = await manager.setConfig({
        provider: "oidc",
        clientId: "test-client",
        authority: "", // 空
      });
      expect(result.success).toBe(false);
    });

    it("rejects SAML config without entityId", async () => {
      const manager = await createSSOManager();
      const result = await manager.setConfig({
        provider: "saml",
        entityId: "", // 空
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid OIDC config", async () => {
      const manager = await createSSOManager();
      const result = await manager.setConfig({
        provider: "oidc",
        clientId: "test-client",
        authority: "https://auth.example.com",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid SAML config", async () => {
      const manager = await createSSOManager();
      const result = await manager.setConfig({
        provider: "saml",
        entityId: "https://sp.example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  /**
   * セッション有効期限判定テスト
   * テスト対象: getSession() の期限チェックロジック
   * 検証内容: 期限切れセッションはnullを返す
   */
  describe("session expiration logic", () => {
    it("returns null for expired session", async () => {
      const expiredSession: SSOSession = {
        provider: "oidc",
        accessToken: "expired-token",
        expiresAt: Date.now() - 1000, // 1秒前に期限切れ
      };
      mockChrome.storage.local.get.mockResolvedValue({ ssoSession: expiredSession });

      const manager = await createSSOManager();
      const session = await manager.getSession();

      expect(session).toBeNull();
    });

    it("returns session for non-expired token", async () => {
      const validSession: SSOSession = {
        provider: "oidc",
        accessToken: "valid-token",
        expiresAt: Date.now() + 3600000, // 1時間後
      };
      mockChrome.storage.local.get.mockResolvedValue({ ssoSession: validSession });

      const manager = await createSSOManager();
      const session = await manager.getSession();

      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("valid-token");
    });

    it("returns session when expiresAt is undefined", async () => {
      const sessionNoExpiry: SSOSession = {
        provider: "oidc",
        accessToken: "no-expiry-token",
        // expiresAt undefined
      };
      mockChrome.storage.local.get.mockResolvedValue({ ssoSession: sessionNoExpiry });

      const manager = await createSSOManager();
      const session = await manager.getSession();

      expect(session).not.toBeNull();
    });
  });

  /**
   * ステータス計算テスト
   * テスト対象: getStatus() の計算ロジック
   * 検証内容: enabled/isAuthenticated の組み合わせ
   */
  describe("status calculation", () => {
    it("returns disabled when not configured", async () => {
      const manager = await createSSOManager();
      const status = await manager.getStatus();

      expect(status.enabled).toBe(false);
      expect(status.isAuthenticated).toBe(false);
    });

    it("returns enabled but not authenticated when configured without session", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: {
          provider: "oidc",
          clientId: "test",
          authority: "https://auth.example.com",
        },
      });

      const manager = await createSSOManager();
      const status = await manager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.provider).toBe("oidc");
      expect(status.isAuthenticated).toBe(false);
    });

    it("returns authenticated with valid session", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: {
          provider: "oidc",
          clientId: "test",
          authority: "https://auth.example.com",
        },
        ssoSession: {
          provider: "oidc",
          accessToken: "token",
          userEmail: "user@example.com",
          expiresAt: Date.now() + 3600000,
        },
      });

      const manager = await createSSOManager();
      const status = await manager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.isAuthenticated).toBe(true);
      expect(status.userEmail).toBe("user@example.com");
    });

    it("returns not authenticated when session is expired", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: {
          provider: "oidc",
          clientId: "test",
          authority: "https://auth.example.com",
        },
        ssoSession: {
          provider: "oidc",
          accessToken: "token",
          expiresAt: Date.now() - 1000, // 期限切れ
        },
      });

      const manager = await createSSOManager();
      const status = await manager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.isAuthenticated).toBe(false);
    });
  });

  /**
   * プロバイダー判定テスト
   * テスト対象: getProvider() / isConfigured()
   */
  describe("provider state", () => {
    it("returns null provider when not configured", async () => {
      const manager = await createSSOManager();
      expect(manager.getProvider()).toBeNull();
      expect(manager.isConfigured()).toBe(false);
    });

    it("returns correct provider after config", async () => {
      const manager = await createSSOManager();
      await manager.setConfig({
        provider: "oidc",
        clientId: "test",
        authority: "https://auth.example.com",
      });

      expect(manager.getProvider()).toBe("oidc");
      expect(manager.isConfigured()).toBe(true);
    });
  });

  /**
   * 認証フロー前提条件テスト
   * テスト対象: startOIDCAuth() / startSAMLAuth() のエラーハンドリング
   * 検証内容: 設定未完了時の適切なエラー
   */
  describe("auth flow preconditions", () => {
    it("throws when starting OIDC auth without config", async () => {
      const manager = await createSSOManager();
      await expect(manager.startOIDCAuth()).rejects.toThrow("OIDC config not set");
    });

    it("throws when starting OIDC auth with SAML config", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: { provider: "saml", entityId: "test" },
      });
      const manager = await createSSOManager();
      await expect(manager.startOIDCAuth()).rejects.toThrow("OIDC config not set");
    });

    it("throws when starting SAML auth without config", async () => {
      const manager = await createSSOManager();
      await expect(manager.startSAMLAuth()).rejects.toThrow("SAML config not set");
    });

    it("throws when starting SAML auth without entryPoint", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: { provider: "saml", entityId: "test" }, // entryPointなし
      });
      const manager = await createSSOManager();
      await expect(manager.startSAMLAuth()).rejects.toThrow("SAML entry point not configured");
    });
  });

  /**
   * トークンリフレッシュ前提条件テスト
   * テスト対象: refreshToken() のガード条件
   */
  describe("token refresh preconditions", () => {
    it("returns null when no refresh token", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: { provider: "oidc", clientId: "test", authority: "https://auth.example.com" },
        ssoSession: { provider: "oidc", accessToken: "token" }, // refreshTokenなし
      });

      const manager = await createSSOManager();
      const result = await manager.refreshToken();

      expect(result).toBeNull();
    });

    it("returns null for SAML provider (no refresh support)", async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        ssoConfig: { provider: "saml", entityId: "test" },
        ssoSession: { provider: "saml", accessToken: "token", refreshToken: "refresh" },
      });

      const manager = await createSSOManager();
      const result = await manager.refreshToken();

      expect(result).toBeNull();
    });
  });

  /**
   * セッション/設定クリアテスト
   * テスト対象: clearSession() / disableSSO()
   */
  describe("cleanup operations", () => {
    it("clears session", async () => {
      const manager = await createSSOManager();
      await manager.setSession({
        provider: "oidc",
        accessToken: "token",
      });

      const result = await manager.clearSession();

      expect(result.success).toBe(true);
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(["ssoSession"]);
    });

    it("disables SSO completely", async () => {
      const manager = await createSSOManager();
      await manager.setConfig({
        provider: "oidc",
        clientId: "test",
        authority: "https://auth.example.com",
      });

      const result = await manager.disableSSO();

      expect(result.success).toBe(true);
      expect(manager.isConfigured()).toBe(false);
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(["ssoConfig", "ssoSession"]);
    });
  });
});

/**
 * PKCE/JWT/SAML Response検証ロジックのテスト
 *
 * これらはprivateメソッドですが、重要なセキュリティロジックのため
 * 同等のロジックを独立した関数として実装し、テストします。
 *
 * 本番コードでは、これらの関数を別ファイル(sso-utils.ts等)に分離し、
 * SSOManagerから利用する設計が推奨されます。
 */
describe("SSO Security Logic (standalone)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  /**
   * PKCE code_verifier検証
   * RFC 7636: 43-128文字、[A-Za-z0-9-._~]のみ
   */
  describe("PKCE code_verifier format", () => {
    function generateCodeVerifier(): string {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return base64UrlEncode(array);
    }

    function base64UrlEncode(array: Uint8Array): string {
      const base64 = btoa(String.fromCharCode(...array));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    it("generates valid length (43 characters for 32 bytes)", () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(43);
    });

    it("contains only URL-safe characters", () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  /**
   * JWT claims検証ロジック
   */
  describe("JWT validation logic", () => {
    function decodeJWT(token: string): { sub?: string; email?: string; exp?: number; iat?: number; nonce?: string; iss?: string; aud?: string | string[] } {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");
      const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base64Payload));
    }

    function validateJWTClaims(
      claims: { exp?: number; iat?: number; nonce?: string; iss?: string; aud?: string | string[] },
      options: { expectedNonce?: string; expectedIssuer?: string; expectedAudience?: string }
    ): string | null {
      const now = Math.floor(Date.now() / 1000);

      if (claims.exp && claims.exp < now - 300) {
        return "Token has expired";
      }
      if (claims.iat && claims.iat > now + 300) {
        return "Token issued in the future";
      }
      if (options.expectedNonce && claims.nonce !== options.expectedNonce) {
        return "Nonce mismatch";
      }
      if (options.expectedIssuer && claims.iss && !claims.iss.startsWith(options.expectedIssuer)) {
        return "Invalid issuer";
      }
      if (options.expectedAudience && claims.aud) {
        const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (!audList.includes(options.expectedAudience)) {
          return "Invalid audience";
        }
      }
      return null;
    }

    function createTestJWT(claims: Record<string, unknown>): string {
      const header = { alg: "RS256", typ: "JWT" };
      const payload = {
        iss: "https://auth.example.com",
        aud: "test-client",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        ...claims,
      };
      const base64Header = btoa(JSON.stringify(header)).replace(/=/g, "");
      const base64Payload = btoa(JSON.stringify(payload)).replace(/=/g, "");
      return `${base64Header}.${base64Payload}.mock-signature`;
    }

    it("decodes valid JWT payload", () => {
      const jwt = createTestJWT({ sub: "user123", email: "user@example.com" });
      const claims = decodeJWT(jwt);

      expect(claims.sub).toBe("user123");
      expect(claims.email).toBe("user@example.com");
    });

    it("throws on invalid JWT format", () => {
      expect(() => decodeJWT("not-a-jwt")).toThrow("Invalid JWT format");
      expect(() => decodeJWT("only.two")).toThrow("Invalid JWT format");
    });

    it("detects expired token", () => {
      const expiredClaims = { exp: Math.floor(Date.now() / 1000) - 600 }; // 10分前
      const error = validateJWTClaims(expiredClaims, {});
      expect(error).toBe("Token has expired");
    });

    it("allows token within clock skew (5 min)", () => {
      const recentlyExpired = { exp: Math.floor(Date.now() / 1000) - 200 }; // 3分20秒前
      const error = validateJWTClaims(recentlyExpired, {});
      expect(error).toBeNull();
    });

    it("detects token issued in future", () => {
      const futureClaims = { iat: Math.floor(Date.now() / 1000) + 600 }; // 10分後
      const error = validateJWTClaims(futureClaims, {});
      expect(error).toBe("Token issued in the future");
    });

    it("detects nonce mismatch", () => {
      const claims = { nonce: "wrong-nonce" };
      const error = validateJWTClaims(claims, { expectedNonce: "correct-nonce" });
      expect(error).toBe("Nonce mismatch");
    });

    it("detects invalid issuer", () => {
      const claims = { iss: "https://evil.com" };
      const error = validateJWTClaims(claims, { expectedIssuer: "https://auth.example.com" });
      expect(error).toBe("Invalid issuer");
    });

    it("detects invalid audience", () => {
      const claims = { aud: "other-client" };
      const error = validateJWTClaims(claims, { expectedAudience: "my-client" });
      expect(error).toBe("Invalid audience");
    });

    it("handles array audience", () => {
      const claims = { aud: ["client-a", "client-b"] };
      const error = validateJWTClaims(claims, { expectedAudience: "client-b" });
      expect(error).toBeNull();
    });
  });

  /**
   * SAML Response検証ロジック
   */
  describe("SAML response validation logic", () => {
    function validateSAMLTimestamps(
      notBefore: string | undefined,
      notOnOrAfter: string | undefined
    ): string | null {
      const now = Date.now();
      const clockSkew = 5 * 60 * 1000; // 5分

      if (notBefore) {
        const notBeforeTime = new Date(notBefore).getTime();
        if (notBeforeTime > now + clockSkew) {
          return "SAML assertion not yet valid";
        }
      }

      if (notOnOrAfter) {
        const notOnOrAfterTime = new Date(notOnOrAfter).getTime();
        if (notOnOrAfterTime < now - clockSkew) {
          return "SAML assertion has expired";
        }
      }

      return null;
    }

    function extractSAMLNameID(samlResponse: string): string | null {
      const decoded = atob(samlResponse);
      const match = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);
      return match?.[1] ?? null;
    }

    it("validates NotBefore timestamp", () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10分後
      const error = validateSAMLTimestamps(futureTime, undefined);
      expect(error).toBe("SAML assertion not yet valid");
    });

    it("allows NotBefore within clock skew", () => {
      const slightlyFuture = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3分後
      const error = validateSAMLTimestamps(slightlyFuture, undefined);
      expect(error).toBeNull();
    });

    it("validates NotOnOrAfter timestamp", () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10分前
      const error = validateSAMLTimestamps(undefined, pastTime);
      expect(error).toBe("SAML assertion has expired");
    });

    it("allows NotOnOrAfter within clock skew", () => {
      const recentlyExpired = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3分前
      const error = validateSAMLTimestamps(undefined, recentlyExpired);
      expect(error).toBeNull();
    });

    it("extracts NameID from SAML response", () => {
      const samlResponse = btoa(`<samlp:Response><saml:NameID>user@example.com</saml:NameID></samlp:Response>`);
      const nameId = extractSAMLNameID(samlResponse);
      expect(nameId).toBe("user@example.com");
    });

    it("returns null when NameID not found", () => {
      const samlResponse = btoa(`<samlp:Response><Other>data</Other></samlp:Response>`);
      const nameId = extractSAMLNameID(samlResponse);
      expect(nameId).toBeNull();
    });
  });
});
