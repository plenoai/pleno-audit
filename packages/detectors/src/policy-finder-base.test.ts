import { describe, it, expect, vi } from "vitest";
import {
  isUrlWithDecode,
  findFromLinkRel,
  findFromJsonLd,
  findFromOgMeta,
  createPolicyFinder,
  type PolicyFinderConfig,
} from "./policy-finder-base.js";
import type { DOMAdapter } from "./types.js";

function createMockDom(overrides: Partial<DOMAdapter> = {}): DOMAdapter {
  return {
    querySelector: vi.fn().mockReturnValue(null),
    querySelectorAll: vi.fn().mockReturnValue([]),
    getLocation: vi.fn().mockReturnValue({
      href: "https://example.com/page",
      pathname: "/page",
      origin: "https://example.com",
    }),
    ...overrides,
  };
}

describe("isUrlWithDecode", () => {
  const isTargetUrl = (url: string) => url.includes("privacy");
  const isTargetText = (text: string) => text.includes("プライバシー");

  it("matches plain URL", () => {
    expect(isUrlWithDecode("/privacy", isTargetUrl, isTargetText)).toBe(true);
  });

  it("matches URL with query string", () => {
    expect(isUrlWithDecode("/privacy?lang=ja", isTargetUrl, isTargetText)).toBe(true);
  });

  it("matches encoded URL", () => {
    // プライバシー URL-encoded
    const encoded = "/%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC";
    expect(isUrlWithDecode(encoded, isTargetUrl, isTargetText)).toBe(true);
  });

  it("returns false for non-matching URL", () => {
    expect(isUrlWithDecode("/about", isTargetUrl, isTargetText)).toBe(false);
  });

  it("respects shouldExclude", () => {
    const shouldExclude = (text: string) => text.includes("terms");
    expect(
      isUrlWithDecode("/privacy-terms", isTargetUrl, isTargetText, shouldExclude)
    ).toBe(false);
  });

  it("handles full URL", () => {
    expect(
      isUrlWithDecode("https://example.com/privacy", isTargetUrl, isTargetText)
    ).toBe(true);
  });
});

describe("findFromLinkRel", () => {
  it("finds link with matching rel", () => {
    const mockLink = {
      getAttribute: vi.fn().mockReturnValue("/privacy-policy"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === 'link[rel="privacy-policy"]') {
          return mockLink;
        }
        return null;
      }),
    });

    const result = findFromLinkRel(dom, ["privacy-policy"]);
    expect(result).toBe("https://example.com/privacy-policy");
  });

  it("tries multiple rel values", () => {
    const mockLink = {
      getAttribute: vi.fn().mockReturnValue("/policy"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === 'link[rel="alternate-privacy"]') {
          return mockLink;
        }
        return null;
      }),
    });

    const result = findFromLinkRel(dom, ["privacy-policy", "alternate-privacy"]);
    expect(result).toBe("https://example.com/policy");
  });

  it("returns null when no link found", () => {
    const dom = createMockDom();
    expect(findFromLinkRel(dom, ["privacy-policy"])).toBeNull();
  });

  it("returns null when link has no href", () => {
    const mockLink = {
      getAttribute: vi.fn().mockReturnValue(null),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockReturnValue(mockLink),
    });

    expect(findFromLinkRel(dom, ["privacy-policy"])).toBeNull();
  });
});

describe("findFromJsonLd", () => {
  it("finds URL from JSON-LD", () => {
    const mockScript = {
      textContent: JSON.stringify({
        "@type": "WebPage",
        privacyPolicyUrl: "https://example.com/privacy",
      }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    const result = findFromJsonLd(dom, ["privacyPolicyUrl"]);
    expect(result).toBe("https://example.com/privacy");
  });

  it("finds URL from @graph array", () => {
    const mockScript = {
      textContent: JSON.stringify({
        "@graph": [
          { "@type": "Organization" },
          { "@type": "WebPage", termsUrl: "https://example.com/terms" },
        ],
      }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    const result = findFromJsonLd(dom, ["termsUrl"]);
    expect(result).toBe("https://example.com/terms");
  });

  it("tries multiple keys", () => {
    const mockScript = {
      textContent: JSON.stringify({
        alternatePrivacy: "https://example.com/alt-privacy",
      }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    const result = findFromJsonLd(dom, ["privacyUrl", "alternatePrivacy"]);
    expect(result).toBe("https://example.com/alt-privacy");
  });

  it("returns null when no matching key", () => {
    const mockScript = {
      textContent: JSON.stringify({ "@type": "WebPage" }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    expect(findFromJsonLd(dom, ["privacyUrl"])).toBeNull();
  });

  it("handles invalid JSON gracefully", () => {
    const mockScript = {
      textContent: "not valid json",
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    expect(findFromJsonLd(dom, ["privacyUrl"])).toBeNull();
  });

  it("returns null when no scripts", () => {
    const dom = createMockDom();
    expect(findFromJsonLd(dom, ["privacyUrl"])).toBeNull();
  });

  it("ignores non-string values", () => {
    const mockScript = {
      textContent: JSON.stringify({
        privacyUrl: { nested: "value" },
      }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockScript]),
    });

    expect(findFromJsonLd(dom, ["privacyUrl"])).toBeNull();
  });
});

describe("findFromOgMeta", () => {
  it("finds URL matching pattern", () => {
    const mockMeta = {
      getAttribute: vi.fn().mockReturnValue("https://example.com/privacy"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockReturnValue(mockMeta),
    });

    const result = findFromOgMeta(dom, [/privacy/i]);
    expect(result).toBe("https://example.com/privacy");
  });

  it("returns null when URL doesn't match patterns", () => {
    const mockMeta = {
      getAttribute: vi.fn().mockReturnValue("https://example.com/about"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockReturnValue(mockMeta),
    });

    expect(findFromOgMeta(dom, [/privacy/i])).toBeNull();
  });

  it("returns null when no og:url meta", () => {
    const dom = createMockDom();
    expect(findFromOgMeta(dom, [/privacy/i])).toBeNull();
  });

  it("tries multiple patterns", () => {
    const mockMeta = {
      getAttribute: vi.fn().mockReturnValue("https://example.com/terms"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockReturnValue(mockMeta),
    });

    const result = findFromOgMeta(dom, [/privacy/i, /terms/i]);
    expect(result).toBe("https://example.com/terms");
  });
});

describe("createPolicyFinder", () => {
  const defaultConfig: PolicyFinderConfig = {
    isTargetUrl: (url) => url.includes("privacy"),
    isTargetText: (text) => /privacy/i.test(text),
    linkRelValues: ["privacy-policy"],
    jsonLdKeys: ["privacyPolicyUrl"],
    ogPatterns: [/privacy/i],
  };

  it("detects from current URL", () => {
    const dom = createMockDom({
      getLocation: vi.fn().mockReturnValue({
        href: "https://example.com/privacy",
        pathname: "/privacy",
        origin: "https://example.com",
      }),
    });

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(true);
    expect(result.url).toBe("https://example.com/privacy");
    expect(result.method).toBe("url_pattern");
  });

  it("detects from link[rel]", () => {
    const mockLink = {
      getAttribute: vi.fn().mockReturnValue("/privacy-policy"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === 'link[rel="privacy-policy"]') {
          return mockLink;
        }
        return null;
      }),
    });

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(true);
    expect(result.method).toBe("link_rel");
  });

  it("detects from JSON-LD", () => {
    const mockScript = {
      textContent: JSON.stringify({
        privacyPolicyUrl: "https://example.com/privacy",
      }),
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockImplementation((selector) => {
        if (selector === 'script[type="application/ld+json"]') {
          return [mockScript];
        }
        return [];
      }),
    });

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(true);
    expect(result.method).toBe("json_ld");
  });

  it("detects from og:url meta", () => {
    const mockMeta = {
      getAttribute: vi.fn().mockReturnValue("https://example.com/privacy"),
    };
    const dom = createMockDom({
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === 'meta[property="og:url"]') {
          return mockMeta;
        }
        return null;
      }),
    });

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(true);
    expect(result.method).toBe("og_meta");
  });

  it("detects from footer link text", () => {
    const mockLink = {
      textContent: "Privacy Policy",
      href: "https://example.com/privacy-page",
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockImplementation((selector) => {
        if (selector.includes("footer")) {
          return [mockLink];
        }
        return [];
      }),
    });

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(true);
    expect(result.method).toBe("link_text");
  });

  it("respects shouldExclude", () => {
    const configWithExclude: PolicyFinderConfig = {
      ...defaultConfig,
      shouldExclude: (text) => text.includes("Cookie"),
    };

    const mockLink = {
      textContent: "Cookie Privacy",
      href: "https://example.com/cookie-privacy",
    };
    const dom = createMockDom({
      querySelectorAll: vi.fn().mockReturnValue([mockLink]),
    });

    const finder = createPolicyFinder(dom, configWithExclude);
    const result = finder();

    expect(result.found).toBe(false);
  });

  it("returns not_found when nothing matches", () => {
    const dom = createMockDom();

    const finder = createPolicyFinder(dom, defaultConfig);
    const result = finder();

    expect(result.found).toBe(false);
    expect(result.url).toBeNull();
    expect(result.method).toBe("not_found");
  });
});
