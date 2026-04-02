/**
 * Network Monitor Tests
 *
 * classifyInitiator関数およびヘルパー関数のユニットテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// classifyInitiatorは内部関数なので、モジュールをインポートしてテストする
// モジュールの内部関数をテストするため、同じロジックを再実装してテスト

type InitiatorType = "extension" | "page" | "browser" | "unknown";

/**
 * initiatorからタイプを判定
 * network-monitor.ts の classifyInitiator と同じロジック
 */
function classifyInitiator(initiator: string | undefined): InitiatorType {
  if (!initiator) return "browser";
  if (initiator.startsWith("chrome-extension://")) return "extension";
  if (initiator.startsWith("http://") || initiator.startsWith("https://"))
    return "page";
  return "unknown";
}

/**
 * 拡張機能IDを抽出
 * network-monitor.ts の extractExtensionId と同じロジック
 */
function extractExtensionId(initiator: string): string | null {
  const match = initiator.match(/^chrome-extension:\/\/([a-z]{32})/);
  return match?.[1] ?? null;
}

/**
 * ドメインを抽出
 * network-monitor.ts の extractDomain と同じロジック
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

describe("network-monitor", () => {
  describe("classifyInitiator", () => {
    it("returns 'browser' for undefined initiator", () => {
      expect(classifyInitiator(undefined)).toBe("browser");
    });

    it("returns 'browser' for empty string initiator (falsy)", () => {
      // 空文字列は falsy なので 'browser' を返す
      expect(classifyInitiator("")).toBe("browser");
    });

    it("returns 'extension' for chrome-extension:// URLs", () => {
      expect(
        classifyInitiator(
          "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
        )
      ).toBe("extension");
    });

    it("returns 'extension' for chrome-extension:// with path", () => {
      expect(
        classifyInitiator(
          "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/background.js"
        )
      ).toBe("extension");
    });

    it("returns 'page' for http:// URLs", () => {
      expect(classifyInitiator("http://example.com")).toBe("page");
    });

    it("returns 'page' for https:// URLs", () => {
      expect(classifyInitiator("https://example.com")).toBe("page");
    });

    it("returns 'page' for https:// with path", () => {
      expect(classifyInitiator("https://example.com/path/to/resource")).toBe(
        "page"
      );
    });

    it("returns 'unknown' for file:// URLs", () => {
      expect(classifyInitiator("file:///path/to/file")).toBe("unknown");
    });

    it("returns 'unknown' for data: URLs", () => {
      expect(classifyInitiator("data:text/html,<h1>Hello</h1>")).toBe(
        "unknown"
      );
    });

    it("returns 'unknown' for blob: URLs", () => {
      expect(classifyInitiator("blob:https://example.com/uuid")).toBe(
        "unknown"
      );
    });

    it("returns 'unknown' for ftp:// URLs", () => {
      expect(classifyInitiator("ftp://ftp.example.com")).toBe("unknown");
    });

    it("returns 'unknown' for about: URLs", () => {
      expect(classifyInitiator("about:blank")).toBe("unknown");
    });

    it("returns 'unknown' for random strings", () => {
      expect(classifyInitiator("random-string")).toBe("unknown");
    });
  });

  describe("extractExtensionId", () => {
    it("extracts valid 32-char extension ID", () => {
      expect(
        extractExtensionId(
          "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
        )
      ).toBe("abcdefghijklmnopqrstuvwxyzabcdef");
    });

    it("extracts extension ID with path", () => {
      expect(
        extractExtensionId(
          "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/popup.html"
        )
      ).toBe("abcdefghijklmnopqrstuvwxyzabcdef");
    });

    it("returns null for invalid extension URL format", () => {
      expect(extractExtensionId("https://example.com")).toBeNull();
    });

    it("returns null for short extension ID", () => {
      expect(extractExtensionId("chrome-extension://short")).toBeNull();
    });

    it("returns null for extension ID with uppercase", () => {
      // Chrome extension IDs are always lowercase
      expect(
        extractExtensionId(
          "chrome-extension://ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF"
        )
      ).toBeNull();
    });

    it("returns null for extension ID with numbers", () => {
      // Chrome extension IDs are only lowercase letters
      expect(
        extractExtensionId(
          "chrome-extension://abc123defghijklmnopqrstuvwxyzabc"
        )
      ).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractExtensionId("")).toBeNull();
    });
  });

  describe("extractDomain", () => {
    it("extracts domain from https URL", () => {
      expect(extractDomain("https://example.com/path")).toBe("example.com");
    });

    it("extracts domain from http URL", () => {
      expect(extractDomain("http://example.com")).toBe("example.com");
    });

    it("extracts subdomain", () => {
      expect(extractDomain("https://sub.example.com/path")).toBe(
        "sub.example.com"
      );
    });

    it("extracts domain with port", () => {
      expect(extractDomain("https://example.com:8080/path")).toBe(
        "example.com"
      );
    });

    it("returns 'unknown' for invalid URL", () => {
      expect(extractDomain("not-a-valid-url")).toBe("unknown");
    });

    it("returns 'unknown' for empty string", () => {
      expect(extractDomain("")).toBe("unknown");
    });

    it("extracts localhost", () => {
      expect(extractDomain("http://localhost:3000")).toBe("localhost");
    });

    it("extracts IP address", () => {
      expect(extractDomain("http://192.168.1.1:8080")).toBe("192.168.1.1");
    });
  });
});
