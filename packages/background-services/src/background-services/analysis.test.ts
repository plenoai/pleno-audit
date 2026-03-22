import { describe, expect, it, vi } from "vitest";
import type { AlertManager } from "@pleno-audit/alerts";
import { DEFAULT_DETECTION_CONFIG } from "@pleno-audit/extension-runtime";
import { createPageAnalysisHandler } from "./analysis.js";
import type { PageAnalysisDependencies } from "./analysis.js";
import type { PageAnalysis, StorageData } from "./types.js";

function createMockDeps(overrides?: Partial<PageAnalysisDependencies>): PageAnalysisDependencies {
  const alertManager = {
    alertCompliance: vi.fn().mockResolvedValue(null),
  } as unknown as AlertManager;

  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getAlertManager: () => alertManager,
    initStorage: vi.fn<() => Promise<StorageData>>().mockResolvedValue({
      services: {},
      cspConfig: {} as StorageData["cspConfig"],
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      notificationConfig: {} as StorageData["notificationConfig"],
      policyConfig: {} as StorageData["policyConfig"],
    }),
    updateService: vi.fn<(domain: string, update: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
    addEvent: vi.fn().mockResolvedValue(undefined),
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

  it("ログイン検出でlogin_detectedイベントを追加する", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);
    const login = { hasLoginForm: true, hasPasswordInput: true, isLoginUrl: false, formAction: "/login" };

    await handler(createBaseAnalysis({ login }));

    expect(deps.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "login_detected", domain: "example.com", details: login }),
    );
  });

  it("プライバシーポリシー検出でprivacy_policy_foundイベントを追加する", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      privacy: { found: true, url: "https://example.com/privacy", method: "link_text" },
    }));

    expect(deps.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "privacy_policy_found",
        domain: "example.com",
        details: { url: "https://example.com/privacy", method: "link_text" },
      }),
    );
  });

  it("ToS検出でterms_of_service_foundイベントを追加する", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      tos: { found: true, url: "https://example.com/tos", method: "url_pattern" },
    }));

    expect(deps.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "terms_of_service_found",
        domain: "example.com",
        details: { url: "https://example.com/tos", method: "url_pattern" },
      }),
    );
  });

  it("cookiePolicy検出でcookie_policy_foundイベントを追加する", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      cookiePolicy: { found: true, url: "https://example.com/cookie-policy", method: "link_text" },
    }));

    expect(deps.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cookie_policy_found",
        domain: "example.com",
        details: { url: "https://example.com/cookie-policy", method: "link_text" },
      }),
    );
  });

  it("cookieBanner検出でcookie_banner_detectedイベントを追加する", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    await handler(createBaseAnalysis({
      cookieBanner: {
        found: true,
        selector: "#cookie-banner",
        hasAcceptButton: true,
        hasRejectButton: true,
        hasSettingsButton: false,
        isGDPRCompliant: true,
      },
    }));

    expect(deps.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cookie_banner_detected",
        domain: "example.com",
        details: {
          selector: "#cookie-banner",
          hasAcceptButton: true,
          hasRejectButton: true,
          hasSettingsButton: false,
          isGDPRCompliant: true,
        },
      }),
    );
  });

  it("違反がある場合にalertComplianceを呼ぶ", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    // ログインフォームありでプライバシーポリシーなし → 違反
    await handler(createBaseAnalysis({
      login: { hasLoginForm: true, hasPasswordInput: true, isLoginUrl: false, formAction: "/login" },
      privacy: { found: false, url: null, method: "url_pattern" },
    }));

    const alertManager = deps.getAlertManager();
    expect(alertManager.alertCompliance).toHaveBeenCalledWith(
      expect.objectContaining({
        pageDomain: "example.com",
        hasLoginForm: true,
        hasPrivacyPolicy: false,
      }),
    );
  });

  it("cookiePolicyなしの場合にalertComplianceを呼ぶ", async () => {
    const deps = createMockDeps();
    const handler = createPageAnalysisHandler(deps);

    // cookiePolicyがundefined → hasCookiePolicy=false → 違反
    await handler(createBaseAnalysis());

    const alertManager = deps.getAlertManager();
    expect(alertManager.alertCompliance).toHaveBeenCalledWith(
      expect.objectContaining({
        pageDomain: "example.com",
        hasCookiePolicy: false,
      }),
    );
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

  it("検出が無効化されている場合はupdateServiceに該当フィールドを含めない", async () => {
    const deps = createMockDeps({
      initStorage: vi.fn<() => Promise<StorageData>>().mockResolvedValue({
        services: {},
          cspConfig: {} as StorageData["cspConfig"],
        detectionConfig: { ...DEFAULT_DETECTION_CONFIG, enableLogin: false, enablePrivacy: false },
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

    // loginとprivacyは無効なのでfaviconUrlのみ
    expect(deps.updateService).toHaveBeenCalledTimes(1);
    expect(deps.updateService).toHaveBeenCalledWith("example.com", {
      faviconUrl: "https://example.com/favicon.ico",
    });
  });
});
