import { describe, it, expect, vi } from "vitest";
import { createCookiePolicyFinder, createCookieBannerFinder } from "./cookie-finder.js";
import type { DOMAdapter } from "./types.js";

interface MockElement {
  textContent?: string;
  href?: string;
  style?: { display?: string; visibility?: string; opacity?: string };
  getAttribute?: (name: string) => string | null;
  querySelectorAll?: (selector: string) => MockElement[];
}

function createMockDOMAdapter(options: {
  location?: { origin: string; pathname: string; href: string };
  elements?: Record<string, MockElement | null>;
  allElements?: Record<string, MockElement[]>;
}): DOMAdapter {
  const {
    location = { origin: "https://example.com", pathname: "/", href: "https://example.com/" },
    elements = {},
    allElements = {},
  } = options;

  return {
    querySelector: vi.fn((selector: string) => elements[selector] || null),
    querySelectorAll: vi.fn((selector: string) => {
      return (allElements[selector] || []) as unknown as NodeListOf<Element>;
    }),
    getLocation: vi.fn(() => location),
  };
}

describe("createCookiePolicyFinder", () => {
  describe("URL pattern detection", () => {
    const cookiePaths = [
      "/cookie-policy",
      "/cookies-policy",
      "/cookie-notice",
      "/cookies",
      "/legal/cookies",
      "/policies/cookies",
    ];

    cookiePaths.forEach((path) => {
      it(`detects ${path} as cookie policy URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const finder = createCookiePolicyFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
        expect(result.method).toBe("url_pattern");
      });
    });

    it("returns not_found for non-cookie URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/about",
          href: "https://example.com/about",
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });
  });

  describe("link[rel] detection", () => {
    it("detects cookie-policy link rel", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="cookie-policy"]': {
            getAttribute: (name: string) =>
              name === "href" ? "/cookies" : null,
          },
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_rel");
    });
  });

  describe("JSON-LD detection", () => {
    it("detects cookiePolicy in JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                cookiePolicy: "https://example.com/cookies",
              }),
            },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
    });
  });

  describe("footer link detection", () => {
    it("detects cookie policy link in footer by text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Cookie Policy", href: "https://example.com/cookies" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_text");
    });

    it("detects Japanese cookie policy text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "クッキーポリシー", href: "https://example.jp/cookies" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("detects cookie settings text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Cookie Settings", href: "https://example.com/cookies" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });
  });

  describe("exclusion of other policies", () => {
    it("excludes privacy links when searching for cookie policy", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Privacy Policy", href: "https://example.com/privacy" },
          ],
          "a[href]": [
            { textContent: "Privacy Policy", href: "https://example.com/privacy" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("excludes ToS links when searching for cookie policy", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Terms of Service", href: "https://example.com/terms" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("finds cookie policy when multiple policy links exist", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Privacy Policy", href: "https://example.com/privacy" },
            { textContent: "Cookie Policy", href: "https://example.com/cookies" },
            { textContent: "Terms of Service", href: "https://example.com/terms" },
          ],
        },
      });
      const finder = createCookiePolicyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.url).toBe("https://example.com/cookies");
    });
  });

  describe("multi-language support", () => {
    const languages = [
      { lang: "German", text: "Cookie-Richtlinie" },
      { lang: "French", text: "Politique des cookies" },
      { lang: "Spanish", text: "Política de cookies" },
      { lang: "Korean", text: "쿠키 정책" },
    ];

    languages.forEach(({ lang, text }) => {
      it(`detects ${lang} cookie policy text: ${text}`, () => {
        const dom = createMockDOMAdapter({
          allElements: {
            "footer a": [
              { textContent: text, href: "https://example.com/cookies" },
            ],
          },
        });
        const finder = createCookiePolicyFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
      });
    });
  });
});

describe("createCookieBannerFinder", () => {
  describe("banner detection", () => {
    it("detects cookie consent banner", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept all cookies" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.hasAcceptButton).toBe(true);
    });

    it("detects Cookiebot banner", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept" },
          { textContent: "Decline" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id="CybotCookiebotDialog"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.selector).toBe('[id="CybotCookiebotDialog"]');
    });

    it("detects OneTrust banner", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept All" },
          { textContent: "Cookie Settings" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id="onetrust-consent-sdk"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("returns false for hidden banner", () => {
      const mockBanner = {
        style: { display: "none" },
        querySelectorAll: () => [],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("returns false for banner with visibility hidden", () => {
      const mockBanner = {
        style: { visibility: "hidden" },
        querySelectorAll: () => [],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("returns false when no banner found", () => {
      const dom = createMockDOMAdapter({});
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
      expect(result.selector).toBeNull();
    });
  });

  describe("button detection", () => {
    it("detects accept button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept all cookies" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasAcceptButton).toBe(true);
    });

    it("detects reject button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Reject all" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasRejectButton).toBe(true);
    });

    it("detects settings button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Cookie Settings" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasSettingsButton).toBe(true);
    });

    it("detects Japanese accept button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "同意する" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasAcceptButton).toBe(true);
    });

    it("detects Japanese reject button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "拒否" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasRejectButton).toBe(true);
    });

    it("detects Japanese settings button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "設定" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.hasSettingsButton).toBe(true);
    });
  });

  describe("GDPR compliance check", () => {
    it("is GDPR compliant with accept and reject buttons", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept all cookies" },
          { textContent: "Reject all" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.isGDPRCompliant).toBe(true);
    });

    it("is GDPR compliant with accept and settings buttons", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "I agree" },
          { textContent: "Customize settings" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.isGDPRCompliant).toBe(true);
    });

    it("is not GDPR compliant with only accept button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Accept cookies" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.isGDPRCompliant).toBe(false);
    });

    it("is not GDPR compliant without accept button", () => {
      const mockBanner = {
        style: {},
        querySelectorAll: () => [
          { textContent: "Close" },
        ],
      };
      const dom = createMockDOMAdapter({
        elements: {
          '[id*="cookie-consent"]': mockBanner,
        },
      });
      const finder = createCookieBannerFinder(dom);
      const result = finder();

      expect(result.isGDPRCompliant).toBe(false);
    });
  });
});
