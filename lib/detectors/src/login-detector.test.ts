import { describe, it, expect, vi } from "vitest";
import { createLoginDetector } from "./login-detector.js";
import type { DOMAdapter } from "./types.js";

function createMockDOMAdapter(options: {
  passwordInputs?: Array<{ closest: (selector: string) => unknown }>;
  location?: { origin: string; pathname: string; href: string };
  socialLoginButtons?: Array<{ textContent: string }>;
  webAuthnElements?: Element[];
}): DOMAdapter {
  const {
    passwordInputs = [],
    location = { origin: "https://example.com", pathname: "/", href: "https://example.com/" },
    socialLoginButtons = [],
    webAuthnElements = [],
  } = options;

  return {
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn((selector: string) => {
      if (selector.includes('input[type="password"]')) {
        return passwordInputs as unknown as NodeListOf<Element>;
      }
      if (selector.includes('button') || selector.includes('[role="button"]')) {
        return socialLoginButtons as unknown as NodeListOf<Element>;
      }
      if (selector.includes('webauthn') || selector.includes('passkey')) {
        return webAuthnElements as unknown as NodeListOf<Element>;
      }
      return [] as unknown as NodeListOf<Element>;
    }),
    getLocation: vi.fn(() => location),
  };
}

describe("createLoginDetector", () => {
  describe("detectLoginPage", () => {
    it("returns all false for page without password input", () => {
      const dom = createMockDOMAdapter({});
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(false);
      expect(result.hasLoginForm).toBe(false);
      expect(result.isLoginUrl).toBe(false);
      expect(result.formAction).toBeNull();
    });

    it("detects password input", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => null }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(false);
    });

    it("detects login form with password input", () => {
      const mockForm = { action: "https://example.com/auth" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
      expect(result.formAction).toBe("https://example.com/auth");
    });

    it("handles form without action attribute", () => {
      const mockForm = { action: "" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasLoginForm).toBe(true);
      expect(result.formAction).toBeNull();
    });

    it("detects login URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects signin URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/signin",
          href: "https://example.com/signin",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects auth URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/auth",
          href: "https://example.com/auth",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects account URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/account/login",
          href: "https://example.com/account/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("does not detect non-login URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/about",
          href: "https://example.com/about",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(false);
    });

    it("handles multiple password inputs", () => {
      const mockForm = { action: "https://example.com/register" };
      const dom = createMockDOMAdapter({
        passwordInputs: [
          { closest: () => mockForm },
          { closest: () => mockForm },
        ],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
    });

    it("combines password input and login URL detection", () => {
      const mockForm = { action: "https://example.com/auth/submit" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasLoginForm).toBe(true);
      expect(result.isLoginUrl).toBe(true);
      expect(result.formAction).toBe("https://example.com/auth/submit");
    });
  });

  describe("isLoginPage", () => {
    it("returns false for regular page", () => {
      const dom = createMockDOMAdapter({});
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(false);
    });

    it("returns true when password input exists", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => null }],
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns true when URL indicates login", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns true when both password input and login URL exist", () => {
      const mockForm = { action: "https://example.com/auth" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
        location: {
          origin: "https://example.com",
          pathname: "/signin",
          href: "https://example.com/signin",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("returns false for page with form but no password", () => {
      const dom = createMockDOMAdapter({
        passwordInputs: [],
        location: {
          origin: "https://example.com",
          pathname: "/contact",
          href: "https://example.com/contact",
        },
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(false);
    });
  });

  describe("URL pattern detection", () => {
    const loginPaths = [
      "/login",
      "/signin",
      "/sign-in",
      "/auth",
      "/authenticate",
      "/account/login",
      "/user/login",
      "/members/signin",
    ];

    loginPaths.forEach((path) => {
      it(`detects ${path} as login URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const detector = createLoginDetector(dom);
        const result = detector.detectLoginPage();

        expect(result.isLoginUrl).toBe(true);
      });
    });

    const nonLoginPaths = [
      "/",
      "/home",
      "/about",
      "/products",
      "/contact",
      "/blog",
      "/pricing",
    ];

    nonLoginPaths.forEach((path) => {
      it(`does not detect ${path} as login URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const detector = createLoginDetector(dom);
        const result = detector.detectLoginPage();

        expect(result.isLoginUrl).toBe(false);
      });
    });
  });

  describe("Passwordless authentication detection", () => {
    it("detects OAuth URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/oauth",
          href: "https://example.com/oauth",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects SSO URL pattern", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/sso",
          href: "https://example.com/sso",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.isLoginUrl).toBe(true);
    });

    it("detects social login button with 'Sign in with' text", () => {
      const dom = createMockDOMAdapter({
        socialLoginButtons: [
          { textContent: "Sign in with Google" },
        ],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasSocialLogin).toBe(true);
    });

    it("detects social login button with 'Continue with' text", () => {
      const dom = createMockDOMAdapter({
        socialLoginButtons: [
          { textContent: "Continue with Apple" },
        ],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasSocialLogin).toBe(true);
    });

    it("detects social login with Japanese text", () => {
      const dom = createMockDOMAdapter({
        socialLoginButtons: [
          { textContent: "Googleでログイン" },
        ],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasSocialLogin).toBe(true);
    });

    it("detects WebAuthn support", () => {
      const mockElement = {} as Element;
      const dom = createMockDOMAdapter({
        webAuthnElements: [mockElement],
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasWebAuthn).toBe(true);
    });

    it("isLoginPage returns true with social login", () => {
      const dom = createMockDOMAdapter({
        socialLoginButtons: [
          { textContent: "Sign in with GitHub" },
        ],
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("isLoginPage returns true with WebAuthn", () => {
      const mockElement = {} as Element;
      const dom = createMockDOMAdapter({
        webAuthnElements: [mockElement],
      });
      const detector = createLoginDetector(dom);

      expect(detector.isLoginPage()).toBe(true);
    });

    it("combines traditional and passwordless detection", () => {
      const mockForm = { action: "https://example.com/auth" };
      const dom = createMockDOMAdapter({
        passwordInputs: [{ closest: () => mockForm }],
        socialLoginButtons: [
          { textContent: "Sign in with Google" },
        ],
        location: {
          origin: "https://example.com",
          pathname: "/login",
          href: "https://example.com/login",
        },
      });
      const detector = createLoginDetector(dom);
      const result = detector.detectLoginPage();

      expect(result.hasPasswordInput).toBe(true);
      expect(result.hasSocialLogin).toBe(true);
      expect(result.isLoginUrl).toBe(true);
    });
  });
});
