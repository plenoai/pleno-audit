import { describe, it, expect } from "vitest";
import {
  decodeUrlSafe,
  getPathFromUrl,
  extractOrigin,
  resolveUrl,
} from "./url-utils.js";

describe("decodeUrlSafe", () => {
  it("decodes URL-encoded string", () => {
    expect(decodeUrlSafe("%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC"))
      .toBe("プライバシー");
  });

  it("decodes space as %20", () => {
    expect(decodeUrlSafe("hello%20world")).toBe("hello world");
  });

  it("decodes plus sign literally", () => {
    expect(decodeUrlSafe("hello+world")).toBe("hello+world");
  });

  it("returns original string for invalid encoding", () => {
    expect(decodeUrlSafe("%E3%83")).toBe("%E3%83");
  });

  it("returns original string for non-encoded input", () => {
    expect(decodeUrlSafe("plain text")).toBe("plain text");
  });

  it("handles empty string", () => {
    expect(decodeUrlSafe("")).toBe("");
  });

  it("decodes multiple encoded characters", () => {
    expect(decodeUrlSafe("%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84"))
      .toBe("利用規約");
  });

  it("handles mixed encoded and plain text", () => {
    expect(decodeUrlSafe("path/%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC"))
      .toBe("path/プライバシー");
  });
});

describe("getPathFromUrl", () => {
  it("extracts pathname from full URL", () => {
    expect(getPathFromUrl("https://example.com/privacy")).toBe("/privacy");
  });

  it("extracts pathname with query string", () => {
    expect(getPathFromUrl("https://example.com/privacy?lang=ja")).toBe("/privacy");
  });

  it("extracts pathname with hash", () => {
    expect(getPathFromUrl("https://example.com/privacy#section")).toBe("/privacy");
  });

  it("extracts root path", () => {
    expect(getPathFromUrl("https://example.com/")).toBe("/");
  });

  it("extracts nested path", () => {
    expect(getPathFromUrl("https://example.com/legal/privacy/policy"))
      .toBe("/legal/privacy/policy");
  });

  it("returns input for invalid URL", () => {
    expect(getPathFromUrl("not a url")).toBe("not a url");
  });

  it("handles relative path input", () => {
    expect(getPathFromUrl("/privacy")).toBe("/privacy");
  });

  it("handles URL with port", () => {
    expect(getPathFromUrl("https://example.com:8080/privacy")).toBe("/privacy");
  });
});

describe("extractOrigin", () => {
  it("extracts origin from full URL", () => {
    expect(extractOrigin("https://example.com/privacy")).toBe("https://example.com");
  });

  it("extracts origin with port", () => {
    expect(extractOrigin("https://example.com:8080/privacy"))
      .toBe("https://example.com:8080");
  });

  it("extracts origin from URL with subdomain", () => {
    expect(extractOrigin("https://sub.example.com/path"))
      .toBe("https://sub.example.com");
  });

  it("extracts http origin", () => {
    expect(extractOrigin("http://example.com/")).toBe("http://example.com");
  });

  it("returns null for invalid URL", () => {
    expect(extractOrigin("not a url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractOrigin("")).toBeNull();
  });

  it("returns null for relative path", () => {
    expect(extractOrigin("/privacy")).toBeNull();
  });

  it("extracts origin with default port omitted", () => {
    expect(extractOrigin("https://example.com:443/path")).toBe("https://example.com");
  });
});

describe("resolveUrl", () => {
  it("resolves absolute path", () => {
    expect(resolveUrl("/privacy", "https://example.com"))
      .toBe("https://example.com/privacy");
  });

  it("resolves relative path", () => {
    expect(resolveUrl("privacy", "https://example.com/legal/"))
      .toBe("https://example.com/legal/privacy");
  });

  it("resolves full URL (ignores base)", () => {
    expect(resolveUrl("https://other.com/path", "https://example.com"))
      .toBe("https://other.com/path");
  });

  it("resolves path with query string", () => {
    expect(resolveUrl("/privacy?lang=ja", "https://example.com"))
      .toBe("https://example.com/privacy?lang=ja");
  });

  it("resolves path with hash", () => {
    expect(resolveUrl("/privacy#section", "https://example.com"))
      .toBe("https://example.com/privacy#section");
  });

  it("handles base with trailing slash", () => {
    expect(resolveUrl("privacy", "https://example.com/legal/"))
      .toBe("https://example.com/legal/privacy");
  });

  it("handles base without trailing slash", () => {
    expect(resolveUrl("privacy", "https://example.com/legal"))
      .toBe("https://example.com/privacy");
  });

  it("resolves protocol-relative URL", () => {
    expect(resolveUrl("//other.com/path", "https://example.com"))
      .toBe("https://other.com/path");
  });

  it("resolves dot notation path", () => {
    expect(resolveUrl("../privacy", "https://example.com/legal/terms/"))
      .toBe("https://example.com/legal/privacy");
  });
});
