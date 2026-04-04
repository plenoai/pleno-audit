import { describe, expect, it } from "vitest";
import { validateImportData, mergeServices, mergeConnections } from "./importer.js";
import type { DetectedService } from "../types/index.js";

describe("validateImportData", () => {
  it("有効なJSONをパースできる", () => {
    const data = JSON.stringify({
      services: [
        { domain: "example.com", detectedAt: 1000, hasLoginPage: false, privacyPolicyUrl: null, termsOfServiceUrl: null, cookies: [] },
      ],
    });
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data?.services).toHaveLength(1);
    expect(result.data?.services[0].domain).toBe("example.com");
  });

  it("不正なJSONをリジェクトする", () => {
    const result = validateImportData("not json");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("JSONの解析に失敗しました");
  });

  it("services配列がないデータをリジェクトする", () => {
    const result = validateImportData(JSON.stringify({ reports: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("services配列が見つかりません");
  });

  it("domainが空のserviceをスキップする", () => {
    const data = JSON.stringify({
      services: [
        { domain: "", detectedAt: 1000, cookies: [] },
        { domain: "valid.com", detectedAt: 1000, cookies: [] },
      ],
    });
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data?.services).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it("ISO形式のdetectedAtを数値に変換する", () => {
    const data = JSON.stringify({
      services: [
        { domain: "example.com", detectedAt: "2024-01-01T00:00:00.000Z", cookies: [] },
      ],
    });
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(typeof result.data?.services[0].detectedAt).toBe("number");
  });

  it("serviceConnectionsとextensionConnectionsをパースする", () => {
    const data = JSON.stringify({
      services: [{ domain: "a.com", detectedAt: 1000, cookies: [] }],
      serviceConnections: { "a.com": ["b.com"] },
      extensionConnections: { ext1: ["c.com"] },
    });
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data?.serviceConnections).toEqual({ "a.com": ["b.com"] });
    expect(result.data?.extensionConnections).toEqual({ ext1: ["c.com"] });
  });

  it("cookiesが欠落している場合はデフォルト空配列を設定する", () => {
    const data = JSON.stringify({
      services: [{ domain: "a.com", detectedAt: 1000 }],
    });
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data?.services[0].cookies).toEqual([]);
  });
});

describe("mergeServices", () => {
  const existing: Record<string, DetectedService> = {
    "a.com": {
      domain: "a.com",
      detectedAt: 1000,
      hasLoginPage: false,
      privacyPolicyUrl: null,
      termsOfServiceUrl: null,
      cookies: [{ name: "c1", domain: "a.com", httpOnly: false, secure: false, sameSite: "lax" as const, isSession: true }],
    },
  };

  it("新しいドメインを追加する", () => {
    const imported: DetectedService[] = [
      { domain: "b.com", detectedAt: 2000, hasLoginPage: true, privacyPolicyUrl: null, termsOfServiceUrl: null, cookies: [] },
    ];
    const merged = mergeServices(existing, imported);
    expect(Object.keys(merged)).toEqual(["a.com", "b.com"]);
  });

  it("既存ドメインをマージする", () => {
    const imported: DetectedService[] = [
      { domain: "a.com", detectedAt: 2000, hasLoginPage: true, privacyPolicyUrl: "https://a.com/privacy", termsOfServiceUrl: null, cookies: [] },
    ];
    const merged = mergeServices(existing, imported);
    expect(merged["a.com"].hasLoginPage).toBe(true);
    expect(merged["a.com"].privacyPolicyUrl).toBe("https://a.com/privacy");
  });

  it("cookieを重複なくマージする", () => {
    const imported: DetectedService[] = [
      {
        domain: "a.com",
        detectedAt: 2000,
        hasLoginPage: false,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
        cookies: [
          { name: "c1", domain: "a.com", httpOnly: false, secure: false, sameSite: "lax" as const, isSession: true },
          { name: "c2", domain: "a.com", httpOnly: true, secure: true, sameSite: "strict" as const, isSession: false },
        ],
      },
    ];
    const merged = mergeServices(existing, imported);
    expect(merged["a.com"].cookies).toHaveLength(2);
  });
});

describe("mergeConnections", () => {
  it("接続情報をマージする", () => {
    const existing = { "a.com": ["b.com"] };
    const imported = { "a.com": ["c.com"], "d.com": ["e.com"] };
    const merged = mergeConnections(existing, imported);
    expect(merged["a.com"]).toEqual(["b.com", "c.com"]);
    expect(merged["d.com"]).toEqual(["e.com"]);
  });

  it("重複を除去する", () => {
    const existing = { "a.com": ["b.com"] };
    const imported = { "a.com": ["b.com", "c.com"] };
    const merged = mergeConnections(existing, imported);
    expect(merged["a.com"]).toEqual(["b.com", "c.com"]);
  });
});
