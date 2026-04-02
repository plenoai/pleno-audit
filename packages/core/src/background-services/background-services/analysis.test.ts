import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DETECTION_CONFIG } from "../../extension-runtime/index.js";
import { createPageAnalysisHandler } from "./analysis.js";
import type { PageAnalysisDependencies } from "./analysis.js";
import type { PageAnalysis, StorageData } from "./types.js";

function createMockDeps(overrides?: Partial<PageAnalysisDependencies>): PageAnalysisDependencies {
  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    initStorage: vi.fn<() => Promise<StorageData>>().mockResolvedValue({
      services: {},
      cspConfig: {} as StorageData["cspConfig"],
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      notificationConfig: {} as StorageData["notificationConfig"],
      policyConfig: {} as StorageData["policyConfig"],
    }),
    updateService: vi.fn<(domain: string, update: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
    addCookieToService: vi.fn().mockResolvedValue(undefined),
    queryExistingCookies: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createBaseAnalysis(overrides?: Partial<PageAnalysis>): PageAnalysis {
  return {
    url: "https://example.com",
    domain: "example.com",
    timestamp: 1700000000000,
    login: { hasLoginForm: false, hasPasswordInput: false, isLoginUrl: false, formAction: null },
    privacy: { found: false, url: null, method: "url_pattern" },
    tos: { found: false, url: null, method: "url_pattern" },
    ...overrides,
  };
}

describe("createPageAnalysisHandler", () => {
  it("favicon・ログイン・プライバシーポリシー検出時にupdateServiceを1回だけ呼ぶ", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      faviconUrl: "https://example.com/favicon.ico",
      login: { hasLoginForm: true, hasPasswordInput: true, isLoginUrl: false, formAction: "/login" },
      privacy: { found: true, url: "https://example.com/privacy", method: "link_text" },
    }));

    expect(deps.updateService).toHaveBeenCalledTimes(1);
    expect(deps.updateService).toHaveBeenCalledWith("example.com", {
      faviconUrl: "https://example.com/favicon.ico",
      hasLoginPage: true,
      privacyPolicyUrl: "https://example.com/privacy",
    });
  });

  it("全検出結果が空の場合はupdateServiceを呼ばない", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis());

    expect(deps.updateService).not.toHaveBeenCalled();
  });

  it("faviconのみ検出時にupdateServiceを1回だけ呼ぶ", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({ faviconUrl: "https://example.com/icon.png" }));

    expect(deps.updateService).toHaveBeenCalledTimes(1);
    expect(deps.updateService).toHaveBeenCalledWith("example.com", {
      faviconUrl: "https://example.com/icon.png",
    });
  });

  it("ToS検出時にtermsOfServiceUrlがバッチに含まれる", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      tos: { found: true, url: "https://example.com/tos", method: "link_text" },
    }));

    expect(deps.updateService).toHaveBeenCalledTimes(1);
    expect(deps.updateService).toHaveBeenCalledWith("example.com", {
      termsOfServiceUrl: "https://example.com/tos",
    });
  });

  it("新規ドメインの場合にqueryExistingCookiesを呼ぶ", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    // services が空 → isNewDomain = true
    await handler(createBaseAnalysis({ domain: "new-site.com" }));

    expect(deps.queryExistingCookies).toHaveBeenCalledWith("new-site.com");
  });

  it("既知ドメインの場合にqueryExistingCookiesを呼ばない", async () => {
    const deps = createMockDeps({
      initStorage: vi.fn<() => Promise<StorageData>>().mockResolvedValue({
        services: { "example.com": {} as StorageData["services"][string] },
          cspConfig: {} as StorageData["cspConfig"],
        detectionConfig: DEFAULT_DETECTION_CONFIG,
        notificationConfig: {} as StorageData["notificationConfig"],
        policyConfig: {} as StorageData["policyConfig"],
      }),
    });
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({ domain: "example.com" }));

    expect(deps.queryExistingCookies).not.toHaveBeenCalled();
  });

  it("新規ドメインでcookieが見つかった場合にaddCookieToServiceを呼ぶ", async () => {
    const mockCookies = [
      { name: "session", value: "abc", domain: "new-site.com", path: "/", secure: true, httpOnly: true, sameSite: "lax" as const },
    ];
    const deps = createMockDeps({
      queryExistingCookies: vi.fn().mockResolvedValue(mockCookies),
    });
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({ domain: "new-site.com" }));

    // queryExistingCookiesはfireAndForgetなので微小待機
    await vi.waitFor(() => {
      expect(deps.addCookieToService).toHaveBeenCalledWith("new-site.com", mockCookies[0]);
    });
  });

  it("login/privacyは常に検出される", async () => {
    const deps = createMockDeps({
      initStorage: vi.fn<() => Promise<StorageData>>().mockResolvedValue({
        services: {},
          cspConfig: {} as StorageData["cspConfig"],
        detectionConfig: DEFAULT_DETECTION_CONFIG,
        notificationConfig: {} as StorageData["notificationConfig"],
        policyConfig: {} as StorageData["policyConfig"],
      }),
    });
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      faviconUrl: "https://example.com/favicon.ico",
      login: { hasLoginForm: true, hasPasswordInput: true, isLoginUrl: false, formAction: "/login" },
      privacy: { found: true, url: "https://example.com/privacy", method: "link_text" },
    }));

    expect(deps.updateService).toHaveBeenCalledTimes(1);
    expect(deps.updateService).toHaveBeenCalledWith("example.com", {
      faviconUrl: "https://example.com/favicon.ico",
      hasLoginPage: true,
      privacyPolicyUrl: "https://example.com/privacy",
    });
  });

});
