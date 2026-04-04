import { describe, it, expect, vi } from "vitest";
import { createPrivacyFinder } from "./privacy-finder.js";
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

describe("createPrivacyFinder", () => {
  describe("URL pattern detection", () => {
    const privacyPaths = [
      "/privacy",
      "/privacy-policy",
      "/privacy_policy",
      "/privacypolicy",
      "/legal/privacy",
      "/terms/privacy",
      "/about/privacy",
    ];

    privacyPaths.forEach((path) => {
      it(`detects ${path} as privacy URL`, () => {
        const dom = createMockDOMAdapter({
          location: {
            origin: "https://example.com",
            pathname: path,
            href: `https://example.com${path}`,
          },
        });
        const finder = createPrivacyFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
        expect(result.method).toBe("url_pattern");
      });
    });

    it("detects German datenschutz URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.de",
          pathname: "/datenschutz",
          href: "https://example.de/datenschutz",
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("url_pattern");
    });

    it("returns not_found for non-privacy URL", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/about",
          href: "https://example.com/about",
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
      expect(result.method).toBe("not_found");
    });
  });

  describe("link[rel] detection", () => {
    it("detects privacy-policy link rel", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="privacy-policy"]': {
            getAttribute: (name: string) =>
              name === "href" ? "/privacy" : null,
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_rel");
      expect(result.url).toBe("https://example.com/privacy");
    });

    it("detects privacy link rel", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="privacy"]': {
            getAttribute: (name: string) =>
              name === "href" ? "https://example.com/privacy-policy" : null,
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_rel");
    });
  });

  describe("JSON-LD detection", () => {
    it("detects privacyPolicy in JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                "@context": "https://schema.org",
                privacyPolicy: "https://example.com/privacy",
              }),
            },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
      expect(result.url).toBe("https://example.com/privacy");
    });

    it("detects privacyUrl in JSON-LD", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                privacyUrl: "https://example.com/privacy-policy",
              }),
            },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
    });

    it("detects privacy in @graph array", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                "@graph": [
                  { "@type": "Organization" },
                  { privacyPolicy: "https://example.com/privacy" },
                ],
              }),
            },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("json_ld");
    });

    it("handles invalid JSON-LD gracefully", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          'script[type="application/ld+json"]': [
            { textContent: "{ invalid json }" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });
  });

  describe("OG Meta detection", () => {
    it("detects og:url with privacy pattern", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'meta[property="og:url"]': {
            getAttribute: (name: string) =>
              name === "content" ? "https://example.com/privacy" : null,
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("og_meta");
      expect(result.url).toBe("https://example.com/privacy");
    });

    it("detects og:url with datenschutz pattern", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'meta[property="og:url"]': {
            getAttribute: (name: string) =>
              name === "content" ? "https://example.de/datenschutz" : null,
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("og_meta");
    });

    it("ignores og:url without privacy pattern", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'meta[property="og:url"]': {
            getAttribute: (name: string) =>
              name === "content" ? "https://example.com/about" : null,
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
    });
  });

  describe("footer link detection", () => {
    it("detects privacy link in footer by text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Privacy Policy", href: "https://example.com/privacy" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_text");
    });

    it("detects privacy link in footer by URL pattern", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "Legal", href: "https://example.com/privacy-policy" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("detects Japanese privacy link text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "プライバシーポリシー", href: "https://example.jp/privacy" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_text");
    });

    it("detects 個人情報保護 Japanese text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "footer a": [
            { textContent: "個人情報保護", href: "https://example.jp/kojin" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });
  });

  describe("all links scan", () => {
    it("finds privacy link in page body", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "a[href]": [
            { textContent: "About", href: "https://example.com/about" },
            { textContent: "Privacy", href: "https://example.com/privacy" },
            { textContent: "Contact", href: "https://example.com/contact" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
      expect(result.method).toBe("link_text");
    });

    it("finds privacy link by URL in body", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "a[href]": [
            { textContent: "Legal", href: "https://example.com/legal/privacy" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });
  });

  describe("multi-language support", () => {
    const languages = [
      { lang: "German", text: "Datenschutz", path: "/datenschutz" },
      { lang: "Korean", text: "개인정보", path: "/privacy" },
      { lang: "Chinese Simplified", text: "隐私", path: "/privacy" },
      { lang: "Chinese Traditional", text: "隱私", path: "/privacy" },
    ];

    languages.forEach(({ lang, text }) => {
      it(`detects ${lang} privacy text: ${text}`, () => {
        const dom = createMockDOMAdapter({
          allElements: {
            "footer a": [
              { textContent: text, href: "https://example.com/privacy" },
            ],
          },
        });
        const finder = createPrivacyFinder(dom);
        const result = finder();

        expect(result.found).toBe(true);
      });
    });
  });

  describe("detection priority", () => {
    it("prioritizes URL pattern over link_rel", () => {
      const dom = createMockDOMAdapter({
        location: {
          origin: "https://example.com",
          pathname: "/privacy",
          href: "https://example.com/privacy",
        },
        elements: {
          'link[rel="privacy-policy"]': {
            getAttribute: () => "/other-privacy",
          },
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.method).toBe("url_pattern");
    });

    it("prioritizes link_rel over json_ld", () => {
      const dom = createMockDOMAdapter({
        elements: {
          'link[rel="privacy-policy"]': {
            getAttribute: () => "/privacy-from-link",
          },
        },
        allElements: {
          'script[type="application/ld+json"]': [
            {
              textContent: JSON.stringify({
                privacyPolicy: "https://example.com/privacy-from-jsonld",
              }),
            },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.method).toBe("link_rel");
    });
  });

  describe("edge cases", () => {
    it("handles empty DOM", () => {
      const dom = createMockDOMAdapter({});
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(false);
      expect(result.url).toBeNull();
      expect(result.method).toBe("not_found");
    });

    it("handles links with no href", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "a[href]": [
            { textContent: "Privacy", href: undefined },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });

    it("handles links with empty text", () => {
      const dom = createMockDOMAdapter({
        allElements: {
          "a[href]": [
            { textContent: "", href: "https://example.com/privacy" },
          ],
        },
      });
      const finder = createPrivacyFinder(dom);
      const result = finder();

      expect(result.found).toBe(true);
    });
  });
});
