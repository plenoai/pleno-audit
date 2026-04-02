import { describe, it, expect, vi } from "vitest";
import { createTosFinder } from "./tos-finder.js";
import type { DOMAdapter } from "./types.js";

interface MockElement {
  textContent?: string;
  href?: string;
  getAttribute?: (name: string) => string | null;
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

describe("createTosFinder", () => {
  describe("URL pattern detection", () => {
    const tosPaths = [
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
    ];

    tosPaths.forEach((path) => {
      it(`detects ${path} as ToS URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const finder = createTosFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
        expect(result.method).toBe("url_pattern");
      });
    });

    it("detects German AGB URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.de",
          pathname: "/agb",
          href: "https://example.de/agb",
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("detects French CGU URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.fr",
          pathname: "/cgu",
          href: "https://example.fr/cgu",
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("returns not_found for non-ToS URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/about",
          href: "https://example.com/about",
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
      expect(result.method).toBe("not_found");
    });
  });

  describe("link[rel] detection", () => {
    it("detects terms-of-service link rel", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="terms-of-service"]': {
            getAttribute: (name: string) =>
              name === "href" ? "/terms" : null,
          },
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_rel");
    });

    it("detects tos link rel", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="tos"]': {
            getAttribute: (name: string) =>
              name === "href" ? "/tos" : null,
          },
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_rel");
    });
  });

  describe("JSON-LD detection", () => {
    it("detects termsOfService in JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                "@context": "https://schema.org",
                termsOfService: "https://example.com/terms",
              }),
            },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
    });

    it("detects termsUrl in JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                termsUrl: "https://example.com/tos",
              }),
            },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
    });
  });

  describe("OG Meta detection", () => {
    it("detects og:url with terms pattern", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'meta[property="og:url"]': {
            getAttribute: (name: string) =>
              name === "content" ? "https://example.com/terms" : null,
          },
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("og_meta");
    });
  });

  describe("footer link detection", () => {
    it("detects ToS link in footer by text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Terms of Service", href: "https://example.com/terms" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_text");
    });

    it("detects Japanese ToS link text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "利用規約", href: "https://example.jp/terms" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("detects ご利用規約 Japanese text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "ご利用規約", href: "https://example.jp/terms" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("detects German AGB text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "AGB", href: "https://example.de/agb" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });
  });

  describe("privacy exclusion", () => {
    it("excludes privacy links when searching for ToS", () => {
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
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("excludes Japanese privacy links", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "プライバシーポリシー", href: "https://example.jp/privacy" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });

    it("finds ToS when both ToS and privacy links exist", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Privacy Policy", href: "https://example.com/privacy" },
            { textContent: "Terms of Service", href: "https://example.com/terms" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.url).toBe("https://example.com/terms");
    });
  });

  describe("multi-language support", () => {
    const languages = [
      { lang: "French", text: "Conditions d'utilisation" },
      { lang: "Spanish", text: "Términos de servicio" },
      { lang: "Chinese Simplified", text: "服务条款" },
      { lang: "Chinese Traditional", text: "服務條款" },
      { lang: "Korean", text: "이용약관" },
    ];

    languages.forEach(({ lang, text }) => {
      it(`detects ${lang} ToS text: ${text}`, () => {
        const dom = createMockDOMAdapter({
          allElements: {
            "footer a": [
              { textContent: text, href: "https://example.com/terms" },
            ],
          },
        });
        const finder = createTosFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
      });
    });
  });

  describe("edge cases", () => {
    it("handles empty DOM", () => {
      const dom = createMockDOMAdapter({});
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
      expect(result.url).toBeNull();
    });

    it("handles invalid JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            { textContent: "{ invalid json }" },
          ],
        },
      });
      const finder = createTosFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });
  });
});
