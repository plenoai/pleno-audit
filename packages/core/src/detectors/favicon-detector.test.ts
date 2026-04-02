import { describe, it, expect } from "vitest";
import {
  findFaviconUrl,
  findFavicons,
  type FaviconRequest,
} from "./favicon-detector.js";

describe("findFaviconUrl", () => {
  describe("ico files", () => {
    it("detects favicon.ico", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon.ico", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.ico"
      );
    });

    it("detects any .ico file", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icons/site.ico", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icons/site.ico"
      );
    });
  });

  describe("png favicon patterns", () => {
    it("detects favicon.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.png"
      );
    });

    it("detects favicon-32x32.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon-32x32.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon-32x32.png"
      );
    });

    it("detects apple-touch-icon.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/apple-touch-icon.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/apple-touch-icon.png"
      );
    });

    it("detects apple-touch-icon-180x180.png", () => {
      const requests: FaviconRequest[] = [
        {
          url: "https://example.com/apple-touch-icon-180x180.png",
          domain: "example.com",
        },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/apple-touch-icon-180x180.png"
      );
    });

    it("detects icon.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icon.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icon.png"
      );
    });

    it("detects icon-192.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icon-192.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icon-192.png"
      );
    });

    it("detects icon-192x192.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icon-192x192.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icon-192x192.png"
      );
    });

    it("detects android-chrome-192x192.png", () => {
      const requests: FaviconRequest[] = [
        {
          url: "https://example.com/android-chrome-192x192.png",
          domain: "example.com",
        },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/android-chrome-192x192.png"
      );
    });
  });

  describe("svg favicon patterns", () => {
    it("detects favicon.svg", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon.svg", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.svg"
      );
    });

    it("detects icons/logo.svg", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icons/logo.svg", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icons/logo.svg"
      );
    });
  });

  describe("icons directory patterns", () => {
    it("detects /icons/icon.png", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icons/icon.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icons/icon.png"
      );
    });

    it("detects /icon/favicon.ico", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/icon/favicon.ico", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/icon/favicon.ico"
      );
    });
  });

  describe("domain matching", () => {
    it("matches request domain", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon.ico", domain: "example.com" },
        { url: "https://other.com/favicon.ico", domain: "other.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.ico"
      );
    });

    it("matches page URL domain", () => {
      const requests: FaviconRequest[] = [
        {
          url: "https://cdn.example.com/favicon.ico",
          domain: "cdn.example.com",
          pageUrl: "https://example.com/page",
        },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://cdn.example.com/favicon.ico"
      );
    });

    it("does not match different domain", () => {
      const requests: FaviconRequest[] = [
        { url: "https://other.com/favicon.ico", domain: "other.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("returns undefined for empty requests", () => {
      expect(findFaviconUrl("example.com", [])).toBeUndefined();
    });

    it("returns undefined when no favicon found", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/image.jpg", domain: "example.com" },
        { url: "https://example.com/script.js", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBeUndefined();
    });

    it("returns first matching favicon", () => {
      const requests: FaviconRequest[] = [
        { url: "https://example.com/favicon.ico", domain: "example.com" },
        { url: "https://example.com/favicon.png", domain: "example.com" },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.ico"
      );
    });

    it("handles invalid URL in pageUrl", () => {
      const requests: FaviconRequest[] = [
        {
          url: "https://example.com/favicon.ico",
          domain: "example.com",
          pageUrl: "invalid-url",
        },
      ];

      expect(findFaviconUrl("example.com", requests)).toBe(
        "https://example.com/favicon.ico"
      );
    });
  });
});

describe("findFavicons", () => {
  it("finds favicons for multiple domains", () => {
    const requests: FaviconRequest[] = [
      { url: "https://example.com/favicon.ico", domain: "example.com" },
      { url: "https://other.com/favicon.png", domain: "other.com" },
      { url: "https://third.com/icon.ico", domain: "third.com" },
    ];

    const result = findFavicons(
      ["example.com", "other.com", "third.com"],
      requests
    );

    expect(result.get("example.com")).toBe("https://example.com/favicon.ico");
    expect(result.get("other.com")).toBe("https://other.com/favicon.png");
    expect(result.get("third.com")).toBe("https://third.com/icon.ico");
  });

  it("returns empty map for empty domains", () => {
    const requests: FaviconRequest[] = [
      { url: "https://example.com/favicon.ico", domain: "example.com" },
    ];

    const result = findFavicons([], requests);
    expect(result.size).toBe(0);
  });

  it("returns empty map for empty requests", () => {
    const result = findFavicons(["example.com", "other.com"], []);
    expect(result.size).toBe(0);
  });

  it("only includes domains with found favicons", () => {
    const requests: FaviconRequest[] = [
      { url: "https://example.com/favicon.ico", domain: "example.com" },
      { url: "https://other.com/image.jpg", domain: "other.com" },
    ];

    const result = findFavicons(["example.com", "other.com"], requests);

    expect(result.size).toBe(1);
    expect(result.has("example.com")).toBe(true);
    expect(result.has("other.com")).toBe(false);
  });

  it("handles duplicate domains in input", () => {
    const requests: FaviconRequest[] = [
      { url: "https://example.com/favicon.ico", domain: "example.com" },
    ];

    const result = findFavicons(["example.com", "example.com"], requests);

    expect(result.size).toBe(1);
    expect(result.get("example.com")).toBe("https://example.com/favicon.ico");
  });
});
