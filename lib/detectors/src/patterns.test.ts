import { describe, it, expect } from "vitest";
import {
  isLoginUrl,
  isPrivacyUrl,
  isPrivacyText,
  isSessionCookie,
  isTosUrl,
  isTosText,
  isCookiePolicyUrl,
  isCookiePolicyText,
  isCookieConsentButton,
  LOGIN_URL_PATTERNS,
  PRIVACY_URL_PATTERNS,
  PRIVACY_TEXT_PATTERNS,
  TOS_URL_PATTERNS,
  TOS_TEXT_PATTERNS,
  COOKIE_POLICY_URL_PATTERNS,
  SESSION_COOKIE_PATTERNS,
} from "./patterns.js";

describe("isLoginUrl", () => {
  const validLoginUrls = [
    "/login",
    "/signin",
    "/sign-in",
    "/auth",
    "/authenticate",
    "/session/new",
    "/user/login",
    "/account/signin",
  ];

  validLoginUrls.forEach((url) => {
    it(`returns true for ${url}`, () => {
      expect(isLoginUrl(url)).toBe(true);
    });
  });

  const invalidLoginUrls = [
    "/about",
    "/home",
    "/products",
    "/logout",
    "/register",
  ];

  invalidLoginUrls.forEach((url) => {
    it(`returns false for ${url}`, () => {
      expect(isLoginUrl(url)).toBe(false);
    });
  });

  it("is case insensitive", () => {
    expect(isLoginUrl("/LOGIN")).toBe(true);
    expect(isLoginUrl("/SignIn")).toBe(true);
  });
});

describe("isPrivacyUrl", () => {
  const validUrls = [
    "/privacy",
    "/privacy-policy",
    "/privacy_policy",
    "/privacypolicy",
    "/legal/privacy",
    "/terms/privacy",
    "/about/privacy",
    "/datenschutz", // German
  ];

  validUrls.forEach((url) => {
    it(`returns true for ${url}`, () => {
      expect(isPrivacyUrl(url)).toBe(true);
    });
  });

  const invalidUrls = [
    "/about",
    "/terms",
    "/contact",
  ];

  invalidUrls.forEach((url) => {
    it(`returns false for ${url}`, () => {
      expect(isPrivacyUrl(url)).toBe(false);
    });
  });

  it("detects Japanese privacy URL", () => {
    expect(isPrivacyUrl("/プライバシー")).toBe(true);
  });
});

describe("isPrivacyText", () => {
  const validTexts = [
    "Privacy Policy",
    "privacy policy",
    "Privacy Notice",
    "privacy",
    "プライバシーポリシー",
    "プライバシー",
    "個人情報保護",
    "個人情報の取り扱い",
    "Datenschutz", // German
    "개인정보", // Korean
    "隐私", // Chinese Simplified
    "隱私", // Chinese Traditional
  ];

  validTexts.forEach((text) => {
    it(`returns true for "${text}"`, () => {
      expect(isPrivacyText(text)).toBe(true);
    });
  });

  const invalidTexts = [
    "Terms of Service",
    "About Us",
    "Contact",
  ];

  invalidTexts.forEach((text) => {
    it(`returns false for "${text}"`, () => {
      expect(isPrivacyText(text)).toBe(false);
    });
  });
});

describe("isSessionCookie", () => {
  const sessionCookies = [
    "session",
    "sess_id",
    "session_token",
    "sid",
    "auth_token",
    "auth",
    "token",
    "jwt",
    "access_token",
    "refresh_token",
    "user_session",
  ];

  sessionCookies.forEach((name) => {
    it(`returns true for "${name}"`, () => {
      expect(isSessionCookie(name)).toBe(true);
    });
  });

  const nonSessionCookies = [
    "analytics",
    "tracking_id",
    "preferences",
    "language",
    "theme",
  ];

  nonSessionCookies.forEach((name) => {
    it(`returns false for "${name}"`, () => {
      expect(isSessionCookie(name)).toBe(false);
    });
  });
});

describe("isTosUrl", () => {
  const validUrls = [
    "/terms",
    "/terms-of-service",
    "/terms_of_service",
    "/terms-of-use",
    "/terms-and-conditions",
    "/tos",
    "/eula",
    "/legal/terms",
    "/user-agreement",
    "/service-agreement",
    "/agb", // German
    "/nutzungsbedingungen", // German
    "/cgu", // French
    "/terminos", // Spanish
  ];

  validUrls.forEach((url) => {
    it(`returns true for ${url}`, () => {
      expect(isTosUrl(url)).toBe(true);
    });
  });

  const invalidUrls = [
    "/about",
    "/privacy",
    "/contact",
  ];

  invalidUrls.forEach((url) => {
    it(`returns false for ${url}`, () => {
      expect(isTosUrl(url)).toBe(false);
    });
  });

  it("handles URL encoded Japanese", () => {
    expect(isTosUrl("/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84")).toBe(true);
  });

  it("handles invalid URL encoding gracefully", () => {
    expect(isTosUrl("/terms%E3")).toBe(true); // Still matches /terms
  });
});

describe("isTosText", () => {
  const validTexts = [
    "Terms of Service",
    "terms of service",
    "Terms of Use",
    "Terms & Conditions",
    "Terms and Conditions",
    "User Agreement",
    "Service Agreement",
    "EULA",
    "End User License Agreement",
    "利用規約",
    "ご利用規約",
    "サービス利用規約",
    "AGB", // German
    "Nutzungsbedingungen", // German
    "CGU", // French
    "Términos de servicio", // Spanish
    "服务条款", // Chinese Simplified
    "服務條款", // Chinese Traditional
    "이용약관", // Korean
  ];

  validTexts.forEach((text) => {
    it(`returns true for "${text}"`, () => {
      expect(isTosText(text)).toBe(true);
    });
  });

  const invalidTexts = [
    "Privacy Policy",
    "About Us",
    "Contact",
  ];

  invalidTexts.forEach((text) => {
    it(`returns false for "${text}"`, () => {
      expect(isTosText(text)).toBe(false);
    });
  });
});

describe("isCookiePolicyUrl", () => {
  const validUrls = [
    "/cookie-policy",
    "/cookies-policy",
    "/cookie-notice",
    "/cookies",
    "/legal/cookies",
    "/policies/cookies",
    "/cookie-richtlinie", // German
    "/politique-cookies", // French
    "/politica-cookies", // Spanish
  ];

  validUrls.forEach((url) => {
    it(`returns true for ${url}`, () => {
      expect(isCookiePolicyUrl(url)).toBe(true);
    });
  });

  const invalidUrls = [
    "/privacy",
    "/terms",
    "/about",
  ];

  invalidUrls.forEach((url) => {
    it(`returns false for ${url}`, () => {
      expect(isCookiePolicyUrl(url)).toBe(false);
    });
  });

  it("handles URL encoded Japanese", () => {
    expect(isCookiePolicyUrl("/%E3%82%AF%E3%83%83%E3%82%AD%E3%83%BC")).toBe(true);
  });
});

describe("isCookiePolicyText", () => {
  const validTexts = [
    "Cookie Policy",
    "cookie policy",
    "Cookie Notice",
    "Cookie Settings",
    "Cookie Preferences",
    "Manage Cookies",
    "クッキーポリシー",
    "クッキー設定",
    "Cookie-Richtlinie", // German
    "Politique des cookies", // French
    "Política de cookies", // Spanish
    "쿠키 정책", // Korean
  ];

  validTexts.forEach((text) => {
    it(`returns true for "${text}"`, () => {
      expect(isCookiePolicyText(text)).toBe(true);
    });
  });

  const invalidTexts = [
    "Privacy Policy",
    "Terms of Service",
  ];

  invalidTexts.forEach((text) => {
    it(`returns false for "${text}"`, () => {
      expect(isCookiePolicyText(text)).toBe(false);
    });
  });
});

describe("isCookieConsentButton", () => {
  const validTexts = [
    "Accept all cookies",
    "Accept cookies",
    "I agree",
    "Agree",
    "Got it",
    "OK",
    "同意",
    "すべて受け入れる",
    "Accepter", // French
    "Akzeptieren", // German
    "Aceptar", // Spanish
  ];

  validTexts.forEach((text) => {
    it(`returns true for "${text}"`, () => {
      expect(isCookieConsentButton(text)).toBe(true);
    });
  });

  const invalidTexts = [
    "Learn More",
    "Close",
    "Reject",
    "Settings",
  ];

  invalidTexts.forEach((text) => {
    it(`returns false for "${text}"`, () => {
      expect(isCookieConsentButton(text)).toBe(false);
    });
  });
});

describe("Pattern arrays", () => {
  it("LOGIN_URL_PATTERNS has patterns", () => {
    expect(LOGIN_URL_PATTERNS.length).toBeGreaterThan(0);
  });

  it("PRIVACY_URL_PATTERNS has patterns", () => {
    expect(PRIVACY_URL_PATTERNS.length).toBeGreaterThan(0);
  });

  it("PRIVACY_TEXT_PATTERNS has patterns", () => {
    expect(PRIVACY_TEXT_PATTERNS.length).toBeGreaterThan(0);
  });

  it("TOS_URL_PATTERNS has patterns", () => {
    expect(TOS_URL_PATTERNS.length).toBeGreaterThan(0);
  });

  it("TOS_TEXT_PATTERNS has patterns", () => {
    expect(TOS_TEXT_PATTERNS.length).toBeGreaterThan(0);
  });

  it("COOKIE_POLICY_URL_PATTERNS has patterns", () => {
    expect(COOKIE_POLICY_URL_PATTERNS.length).toBeGreaterThan(0);
  });

  it("SESSION_COOKIE_PATTERNS has patterns", () => {
    expect(SESSION_COOKIE_PATTERNS.length).toBeGreaterThan(0);
  });
});
