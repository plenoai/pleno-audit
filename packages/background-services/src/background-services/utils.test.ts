import { describe, expect, it } from "vitest";
import { extractDomainFromUrl } from "./utils.js";

describe("extractDomainFromUrl", () => {
  it("標準的なHTTPS URLからホスト名を抽出する", () => {
    expect(extractDomainFromUrl("https://example.com/path")).toBe("example.com");
  });

  it("ポート付きURLからホスト名のみを抽出する", () => {
    expect(extractDomainFromUrl("https://example.com:8080/path")).toBe("example.com");
  });

  it("クエリパラメータ付きURLからホスト名を抽出する", () => {
    expect(extractDomainFromUrl("https://example.com/path?q=1")).toBe("example.com");
  });

  it("HTTP URLからホスト名を抽出する", () => {
    expect(extractDomainFromUrl("http://example.com/page")).toBe("example.com");
  });

  it("不正なURLに対して 'unknown' を返す", () => {
    expect(extractDomainFromUrl("not-a-url")).toBe("unknown");
  });

  it("空文字列に対して 'unknown' を返す", () => {
    expect(extractDomainFromUrl("")).toBe("unknown");
  });

  it("サブドメイン付きURLから完全なホスト名を抽出する", () => {
    expect(extractDomainFromUrl("https://sub.example.com")).toBe("sub.example.com");
  });
});
