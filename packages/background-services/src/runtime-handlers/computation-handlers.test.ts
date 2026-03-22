import { describe, expect, it, vi, beforeEach } from "vitest";
import { createComputationHandlers } from "./computation-handlers.js";
import type { RuntimeHandlerDependencies } from "./types.js";
import type { DetectedService } from "@pleno-audit/casb-types";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";

// analyzePromptは実モジュールを使う（純関数のため）

// ---------------------------------------------------------------------------
// テストデータファクトリ
// ---------------------------------------------------------------------------

function createService(overrides: Partial<DetectedService> = {}): DetectedService {
  return {
    domain: "example.com",
    detectedAt: 1700000000000,
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
    ...overrides,
  };
}

function createViolation(overrides: Partial<CSPViolation> = {}): CSPViolation {
  return {
    type: "csp-violation",
    timestamp: "2024-01-01T00:00:00.000Z",
    pageUrl: "https://example.com/page",
    directive: "script-src",
    blockedURL: "https://evil.com/script.js",
    domain: "example.com",
    disposition: "enforce",
    ...overrides,
  };
}

function createNetworkRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    type: "network-request",
    timestamp: "2024-01-01T00:00:00.000Z",
    pageUrl: "https://example.com/page",
    url: "https://cdn.example.com/resource.js",
    method: "GET",
    initiator: "fetch",
    domain: "cdn.example.com",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// モック依存関係
// ---------------------------------------------------------------------------

function createMockDeps(): Pick<
  RuntimeHandlerDependencies,
  | "logger"
  | "getServices"
  | "getCSPReports"
  | "getNetworkRequests"
  | "getAIPrompts"
  | "getDoHRequests"
  | "getExtensionStats"
  | "getKnownExtensions"
  | "getServiceConnections"
> {
  return {
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getServices: vi.fn<() => Promise<DetectedService[]>>().mockResolvedValue([]),
    getCSPReports: vi.fn().mockResolvedValue({ reports: [] }),
    getNetworkRequests: vi.fn().mockResolvedValue({ requests: [] }),
    getAIPrompts: vi.fn().mockResolvedValue([]),
    getDoHRequests: vi.fn().mockResolvedValue({ requests: [] }),
    getExtensionStats: vi.fn().mockResolvedValue(null),
    getKnownExtensions: vi.fn().mockReturnValue({}),
    getServiceConnections: vi.fn().mockResolvedValue({}),
  };
}

describe("createComputationHandlers", () => {
  it("GET_POPUP_EVENTSとGET_AGGREGATED_SERVICESのエントリを返す", () => {
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);

    expect(entries).toHaveLength(2);
    expect(entries[0][0]).toBe("GET_POPUP_EVENTS");
    expect(entries[1][0]).toBe("GET_AGGREGATED_SERVICES");
  });

  it("各エントリにexecuteとfallbackを持つ", () => {
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);

    for (const [, handler] of entries) {
      expect(handler.execute).toBeTypeOf("function");
      expect(handler.fallback).toBeTypeOf("function");
    }
  });
});

// ===========================================================================
// GET_POPUP_EVENTS
// ===========================================================================

describe("GET_POPUP_EVENTS", () => {
  let deps: ReturnType<typeof createMockDeps>;
  let execute: () => Promise<{ events: unknown[]; counts: Record<string, number>; total: number }>;
  let fallback: () => unknown;

  beforeEach(() => {
    deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const popupEntry = entries.find(([name]) => name === "GET_POPUP_EVENTS")!;
    execute = popupEntry[1].execute as typeof execute;
    fallback = popupEntry[1].fallback;
  });

  it("全データソースを呼び出す", async () => {
    await execute();

    expect(deps.getServices).toHaveBeenCalledOnce();
    expect(deps.getCSPReports).toHaveBeenCalledWith({ type: "csp-violation", limit: 500 });
    expect(deps.getNetworkRequests).toHaveBeenCalledWith({ limit: 500 });
    expect(deps.getAIPrompts).toHaveBeenCalledOnce();
    expect(deps.getDoHRequests).toHaveBeenCalledWith({ limit: 100 });
  });

  it("データがない場合、空のeventsとcountsを返す", async () => {
    const result = await execute();

    expect(result).toEqual({ events: [], counts: {}, total: 0 });
  });

  it("fallbackは空のevents/counts/totalを返す", () => {
    expect(fallback()).toEqual({ events: [], counts: {}, total: 0 });
  });

  // -------------------------------------------------------------------------
  // NRD イベント変換
  // -------------------------------------------------------------------------

  describe("NRDサービスのイベント変換", () => {
    it("domainAge < 7のNRDをcriticalとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "new-domain.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 3, checkedAt: 1700000001000 },
        }),
      ]);

      const result = await execute();

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        id: "nrd-new-domain.com",
        category: "nrd",
        severity: "critical",
        title: "new-domain.com",
        domain: "new-domain.com",
        timestamp: 1700000001000,
      });
      expect(result.counts).toEqual({ critical: 1 });
    });

    it("domainAge >= 7のNRDをhighとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "week-old.com",
          nrdResult: { isNRD: true, confidence: "medium", domainAge: 14, checkedAt: 1700000002000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0]).toMatchObject({ severity: "high" });
    });

    it("domainAgeがnullのNRDをhighとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "unknown-age.com",
          nrdResult: { isNRD: true, confidence: "low", domainAge: null, checkedAt: 1700000003000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0]).toMatchObject({ severity: "high" });
    });

    it("isNRD: falseのサービスはイベントに変換しない", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "safe.com",
          nrdResult: { isNRD: false, confidence: "high", domainAge: 365, checkedAt: 1700000004000 },
        }),
      ]);

      const result = await execute();

      expect(result.events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Typosquat イベント変換
  // -------------------------------------------------------------------------

  describe("typosquatサービスのイベント変換", () => {
    it("score >= 70をcriticalとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "g00gle.com",
          typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 85, checkedAt: 1700000010000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0]).toMatchObject({
        id: "typosquat-g00gle.com",
        category: "typosquat",
        severity: "critical",
        timestamp: 1700000010000,
      });
    });

    it("score 40-69をhighとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "gogle.com",
          typosquatResult: { isTyposquat: true, confidence: "medium", totalScore: 50, checkedAt: 1700000011000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0]).toMatchObject({ severity: "high" });
    });

    it("score < 40をmediumとして返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "goggle.com",
          typosquatResult: { isTyposquat: true, confidence: "low", totalScore: 25, checkedAt: 1700000012000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0]).toMatchObject({ severity: "medium" });
    });

    it("isTyposquat: falseのサービスはイベントに変換しない", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "legit.com",
          typosquatResult: { isTyposquat: false, confidence: "none", totalScore: 5, checkedAt: 1700000013000 },
        }),
      ]);

      const result = await execute();

      expect(result.events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AIプロンプトイベント変換
  // -------------------------------------------------------------------------

  describe("AIプロンプトのイベント変換", () => {
    it("機密情報を含むプロンプトをai_sensitiveイベントに変換する", async () => {
      (deps.getAIPrompts as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "prompt-1",
          timestamp: 1700000020000,
          pageUrl: "https://chat.openai.com",
          apiEndpoint: "https://api.openai.com/v1/chat/completions",
          method: "POST",
          prompt: {
            messages: [{ role: "user", content: "My credit card number is 4111-1111-1111-1111 and SSN is 123-45-6789" }],
          },
          provider: "openai",
        },
      ]);

      const result = await execute();

      const aiEvent = result.events.find((e: { id: string }) => e.id === "ai-prompt-1");
      expect(aiEvent).toBeDefined();
      expect(aiEvent).toMatchObject({
        category: "ai_sensitive",
        domain: "api.openai.com",
        timestamp: 1700000020000,
      });
    });

    it("機密情報のないプロンプトはイベントに変換しない", async () => {
      (deps.getAIPrompts as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "prompt-2",
          timestamp: 1700000021000,
          pageUrl: "https://chat.openai.com",
          apiEndpoint: "https://api.openai.com/v1/chat/completions",
          method: "POST",
          prompt: { messages: [{ role: "user", content: "Hello, how are you?" }] },
          provider: "openai",
        },
      ]);

      const result = await execute();

      const aiEvent = result.events.find((e: { id: string }) => e.id === "ai-prompt-2");
      expect(aiEvent).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // CSP違反イベント変換
  // -------------------------------------------------------------------------

  describe("CSP違反のイベント変換", () => {
    it("script-srcディレクティブ違反をhighとして返す", async () => {
      (deps.getCSPReports as ReturnType<typeof vi.fn>).mockResolvedValue({
        reports: [
          createViolation({
            directive: "script-src",
            pageUrl: "https://example.com/page",
            blockedURL: "https://evil.com/script.js",
            timestamp: "2024-01-15T10:00:00.000Z",
          }),
        ],
      });

      const result = await execute();

      const cspEvent = result.events.find((e: { category: string }) => e.category === "csp_violation");
      expect(cspEvent).toBeDefined();
      expect(cspEvent).toMatchObject({
        category: "csp_violation",
        severity: "high",
        title: "script-src",
        domain: "example.com",
      });
    });

    it("default-srcディレクティブ違反をhighとして返す", async () => {
      (deps.getCSPReports as ReturnType<typeof vi.fn>).mockResolvedValue({
        reports: [createViolation({ directive: "default-src" })],
      });

      const result = await execute();

      const cspEvent = result.events.find((e: { category: string }) => e.category === "csp_violation");
      expect(cspEvent).toMatchObject({ severity: "high" });
    });

    it("img-srcなどのディレクティブ違反をmediumとして返す", async () => {
      (deps.getCSPReports as ReturnType<typeof vi.fn>).mockResolvedValue({
        reports: [createViolation({ directive: "img-src" })],
      });

      const result = await execute();

      const cspEvent = result.events.find((e: { category: string }) => e.category === "csp_violation");
      expect(cspEvent).toMatchObject({ severity: "medium" });
    });

    it("配列形式のviolationsResultにも対応する", async () => {
      (deps.getCSPReports as ReturnType<typeof vi.fn>).mockResolvedValue([
        createViolation({ directive: "script-src" }),
      ]);

      const result = await execute();

      const cspEvent = result.events.find((e: { category: string }) => e.category === "csp_violation");
      expect(cspEvent).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // DoHリクエストイベント変換
  // -------------------------------------------------------------------------

  describe("DoHリクエストのイベント変換", () => {
    it("blockedなDoHリクエストをhighとして返す", async () => {
      (deps.getDoHRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
        requests: [{ id: "doh-1", domain: "dns.google", timestamp: 1700000030000, blocked: true }],
      });

      const result = await execute();

      const dohEvent = result.events.find((e: { id: string }) => e.id === "doh-doh-1");
      expect(dohEvent).toMatchObject({
        category: "shadow_ai",
        severity: "high",
        title: "dns.google",
        domain: "dns.google",
      });
    });

    it("非blockedのDoHリクエストをmediumとして返す", async () => {
      (deps.getDoHRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
        requests: [{ id: "doh-2", domain: "cloudflare-dns.com", timestamp: 1700000031000, blocked: false }],
      });

      const result = await execute();

      const dohEvent = result.events.find((e: { id: string }) => e.id === "doh-doh-2");
      expect(dohEvent).toMatchObject({ severity: "medium" });
    });
  });

  // -------------------------------------------------------------------------
  // ネットワークリクエストイベント変換
  // -------------------------------------------------------------------------

  describe("ネットワークリクエストのイベント変換", () => {
    it("ネットワークリクエストをinfoイベントとして返す", async () => {
      (deps.getNetworkRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
        requests: [
          createNetworkRequest({
            url: "https://api.example.com/data",
            method: "POST",
            timestamp: "2024-01-15T12:00:00.000Z",
          }),
        ],
      });

      const result = await execute();

      const netEvent = result.events.find((e: { category: string }) => e.category === "network");
      expect(netEvent).toBeDefined();
      expect(netEvent).toMatchObject({
        severity: "info",
        title: "POST api.example.com",
        domain: "api.example.com",
      });
    });

    it("配列形式のnetworkResultにも対応する", async () => {
      (deps.getNetworkRequests as ReturnType<typeof vi.fn>).mockResolvedValue([
        createNetworkRequest({ url: "https://cdn.example.com/file.js", method: "GET" }),
      ]);

      const result = await execute();

      const netEvent = result.events.find((e: { category: string }) => e.category === "network");
      expect(netEvent).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // ソート・集計
  // -------------------------------------------------------------------------

  describe("イベントのソートと集計", () => {
    it("タイムスタンプ降順でソートされる", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "old-nrd.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 1, checkedAt: 1700000000000 },
        }),
        createService({
          domain: "new-nrd.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 2, checkedAt: 1700000005000 },
        }),
      ]);

      const result = await execute();

      expect(result.events[0].timestamp).toBeGreaterThanOrEqual(result.events[1].timestamp);
    });

    it("severityごとのカウントを正しく集計する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "critical-nrd.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 1, checkedAt: 1700000000000 },
        }),
        createService({
          domain: "high-nrd.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 30, checkedAt: 1700000001000 },
        }),
      ]);
      (deps.getCSPReports as ReturnType<typeof vi.fn>).mockResolvedValue({
        reports: [createViolation({ directive: "img-src" })],
      });

      const result = await execute();

      expect(result.counts.critical).toBe(1);
      expect(result.counts.high).toBe(1);
      expect(result.counts.medium).toBe(1);
      expect(result.total).toBe(result.events.length);
    });

    it("totalはイベント数と一致する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "a.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 1, checkedAt: 1700000000000 },
          typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 80, checkedAt: 1700000001000 },
        }),
      ]);

      const result = await execute();

      // NRD + typosquat = 2 events
      expect(result.total).toBe(2);
      expect(result.events).toHaveLength(2);
    });
  });
});

// ===========================================================================
// GET_AGGREGATED_SERVICES
// ===========================================================================

describe("GET_AGGREGATED_SERVICES", () => {
  let deps: ReturnType<typeof createMockDeps>;
  let execute: () => Promise<unknown[]>;
  let fallback: () => unknown;

  beforeEach(() => {
    deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const aggregatedEntry = entries.find(([name]) => name === "GET_AGGREGATED_SERVICES")!;
    execute = aggregatedEntry[1].execute as typeof execute;
    fallback = aggregatedEntry[1].fallback;
  });

  it("fallbackは空配列を返す", () => {
    expect(fallback()).toEqual([]);
  });

  it("データがない場合は空配列を返す", async () => {
    const result = await execute();

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // ドメインサービス
  // -------------------------------------------------------------------------

  describe("ドメインサービスの変換", () => {
    it("サービスをUnifiedService形式で返す", async () => {
      const service = createService({ domain: "example.com", detectedAt: 1700000050000 });
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([service]);

      const result = (await execute()) as Array<{
        id: string;
        source: { type: string; domain: string; service: DetectedService };
        connections: unknown[];
        tags: unknown[];
        lastActivity: number;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "domain:example.com",
        source: { type: "domain", domain: "example.com", service },
        lastActivity: 1700000050000,
      });
    });

    it("サービスにfaviconUrlが設定されていればそれを使用する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com", faviconUrl: "https://example.com/favicon.ico" }),
      ]);

      const result = (await execute()) as Array<{ faviconUrl?: string }>;

      expect(result[0].faviconUrl).toBe("https://example.com/favicon.ico");
    });
  });

  // -------------------------------------------------------------------------
  // extractTags
  // -------------------------------------------------------------------------

  describe("extractTags", () => {
    it("NRDサービスにnrdタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "nrd.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 5, checkedAt: 1700000060000 },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string; domainAge?: number; confidence?: string }> }>;

      expect(result[0].tags).toContainEqual({
        type: "nrd",
        domainAge: 5,
        confidence: "high",
      });
    });

    it("typosquatサービスにtyposquatタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "typo.com",
          typosquatResult: { isTyposquat: true, confidence: "high", totalScore: 75, checkedAt: 1700000061000 },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string; score?: number; confidence?: string }> }>;

      expect(result[0].tags).toContainEqual({
        type: "typosquat",
        score: 75,
        confidence: "high",
      });
    });

    it("AI検出サービスにaiタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "ai-service.com",
          aiDetected: { hasAIActivity: true, lastActivityAt: 1700000062000, providers: [] },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string }> }>;

      expect(result[0].tags).toContainEqual({ type: "ai" });
    });

    it("ログインページのあるサービスにloginタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "login-service.com", hasLoginPage: true }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string }> }>;

      expect(result[0].tags).toContainEqual({ type: "login" });
    });

    it("プライバシーポリシーURLがあるサービスにprivacyタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "privacy-service.com",
          privacyPolicyUrl: "https://privacy-service.com/privacy",
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string; url?: string }> }>;

      expect(result[0].tags).toContainEqual({
        type: "privacy",
        url: "https://privacy-service.com/privacy",
      });
    });

    it("利用規約URLがあるサービスにtosタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "tos-service.com",
          termsOfServiceUrl: "https://tos-service.com/terms",
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string; url?: string }> }>;

      expect(result[0].tags).toContainEqual({
        type: "tos",
        url: "https://tos-service.com/terms",
      });
    });

    it("Cookieを持つサービスにcookieタグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "cookie-service.com",
          cookies: [
            { name: "session", domain: "cookie-service.com", detectedAt: 1700000063000, isSession: true },
            { name: "tracking", domain: "cookie-service.com", detectedAt: 1700000063000, isSession: false },
          ],
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string; count?: number }> }>;

      expect(result[0].tags).toContainEqual({ type: "cookie", count: 2 });
    });

    it("isNRD: falseのNRD結果にはnrdタグを付与しない", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "safe.com",
          nrdResult: { isNRD: false, confidence: "high", domainAge: 365, checkedAt: 1700000064000 },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string }> }>;

      expect(result[0].tags.find((t) => t.type === "nrd")).toBeUndefined();
    });

    it("hasAIActivity: falseのAI結果にはaiタグを付与しない", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "no-ai.com",
          aiDetected: { hasAIActivity: false, lastActivityAt: 0, providers: [] },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string }> }>;

      expect(result[0].tags.find((t) => t.type === "ai")).toBeUndefined();
    });

    it("複数のタグ条件を同時に満たすサービスに全タグを付与する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "multi.com",
          hasLoginPage: true,
          privacyPolicyUrl: "https://multi.com/privacy",
          termsOfServiceUrl: "https://multi.com/tos",
          cookies: [{ name: "sid", domain: "multi.com", detectedAt: 1700000065000, isSession: true }],
          nrdResult: { isNRD: true, confidence: "medium", domainAge: 10, checkedAt: 1700000065000 },
          typosquatResult: { isTyposquat: true, confidence: "low", totalScore: 30, checkedAt: 1700000065000 },
          aiDetected: { hasAIActivity: true, lastActivityAt: 1700000065000, providers: [] },
        }),
      ]);

      const result = (await execute()) as Array<{ tags: Array<{ type: string }> }>;
      const tagTypes = result[0].tags.map((t) => t.type);

      expect(tagTypes).toContain("nrd");
      expect(tagTypes).toContain("typosquat");
      expect(tagTypes).toContain("ai");
      expect(tagTypes).toContain("login");
      expect(tagTypes).toContain("privacy");
      expect(tagTypes).toContain("tos");
      expect(tagTypes).toContain("cookie");
      expect(result[0].tags).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // serviceConnections からの通信先取得
  // -------------------------------------------------------------------------

  describe("serviceConnectionsからの通信先取得", () => {
    it("serviceConnectionsから接続先ドメインを取得する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getServiceConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "example.com": { "cdn.example.net": 2, "api.example.net": 1 },
      });

      const result = (await execute()) as Array<{ connections: Array<{ domain: string; requestCount: number }> }>;

      expect(result[0].connections).toHaveLength(2);
      expect(result[0].connections[0]).toEqual({ domain: "cdn.example.net", requestCount: 2 });
      expect(result[0].connections[1]).toEqual({ domain: "api.example.net", requestCount: 1 });
    });

    it("serviceConnectionsにサービスがない場合、空の接続を返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getServiceConnections as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = (await execute()) as Array<{ connections: unknown[] }>;

      expect(result[0].connections).toHaveLength(0);
    });

    it("接続はrequestCount降順でソートされる", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getServiceConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "example.com": { "low.com": 1, "high.com": 3, "mid.com": 2 },
      });

      const result = (await execute()) as Array<{ connections: Array<{ domain: string; requestCount: number }> }>;

      expect(result[0].connections[0]).toEqual({ domain: "high.com", requestCount: 3 });
      expect(result[0].connections[1]).toEqual({ domain: "mid.com", requestCount: 2 });
      expect(result[0].connections[2]).toEqual({ domain: "low.com", requestCount: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // 拡張機能サービス
  // -------------------------------------------------------------------------

  describe("拡張機能サービスの変換", () => {
    it("拡張機能をUnifiedService形式で返す", async () => {
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        byExtension: {
          "ext-abc": { name: "Ad Blocker", count: 10, domains: ["example.com"], lastActivityTime: 1700000070000 },
        },
        byDomain: {
          "example.com": { count: 10, extensions: ["ext-abc"] },
        },
        total: 10,
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-abc": {
          id: "ext-abc",
          name: "Ad Blocker",
          version: "1.0.0",
          enabled: true,
          icons: [{ size: 32, url: "chrome-extension://ext-abc/icon32.png" }],
        },
      });

      const result = (await execute()) as Array<{
        id: string;
        source: { type: string; extensionId: string; extensionName: string; icon?: string };
        connections: Array<{ domain: string; requestCount: number }>;
        tags: unknown[];
        lastActivity: number;
      }>;

      const extService = result.find((s) => s.id === "extension:ext-abc");
      expect(extService).toBeDefined();
      expect(extService).toMatchObject({
        id: "extension:ext-abc",
        source: {
          type: "extension",
          extensionId: "ext-abc",
          extensionName: "Ad Blocker",
          icon: "chrome-extension://ext-abc/icon32.png",
        },
        tags: [],
        lastActivity: 1700000070000,
      });
      expect(extService!.connections).toContainEqual({ domain: "example.com", requestCount: 10 });
    });

    it("拡張機能statsがnullの場合は拡張機能を含めない", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-xyz": { id: "ext-xyz", name: "Some Ext", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{ id: string }>;

      expect(result.find((s) => s.id.startsWith("extension:"))).toBeUndefined();
    });

    it("lastActivityTimeがないときは0を使用する", async () => {
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        byExtension: {
          "ext-no-activity": { name: "Silent Ext", count: 0, domains: [] },
        },
        byDomain: {},
        total: 0,
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-no-activity": { id: "ext-no-activity", name: "Silent Ext", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{ id: string; lastActivity: number }>;

      const ext = result.find((s) => s.id === "extension:ext-no-activity");
      expect(ext?.lastActivity).toBe(0);
    });

    it("アイコンがない拡張機能ではiconがundefinedになる", async () => {
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        byExtension: {
          "ext-no-icon": { name: "No Icon", count: 1, domains: ["test.com"] },
        },
        byDomain: { "test.com": { count: 1, extensions: ["ext-no-icon"] } },
        total: 1,
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-no-icon": { id: "ext-no-icon", name: "No Icon", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{
        id: string;
        source: { icon?: string };
      }>;

      const ext = result.find((s) => s.id === "extension:ext-no-icon");
      expect(ext?.source.icon).toBeUndefined();
    });

    it("複数拡張機能が同一ドメインにアクセスする場合リクエストカウントを按分する", async () => {
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        byExtension: {
          "ext-a": { name: "Ext A", count: 6, domains: ["shared.com"], lastActivityTime: 1700000080000 },
          "ext-b": { name: "Ext B", count: 4, domains: ["shared.com"], lastActivityTime: 1700000081000 },
        },
        byDomain: {
          "shared.com": { count: 10, extensions: ["ext-a", "ext-b"] },
        },
        total: 10,
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-a": { id: "ext-a", name: "Ext A", version: "1.0", enabled: true },
        "ext-b": { id: "ext-b", name: "Ext B", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{
        id: string;
        connections: Array<{ domain: string; requestCount: number }>;
      }>;

      const extA = result.find((s) => s.id === "extension:ext-a");
      const extB = result.find((s) => s.id === "extension:ext-b");

      // 10 / 2 extensions = 5 per extension (Math.ceil)
      expect(extA?.connections[0].requestCount).toBe(5);
      expect(extB?.connections[0].requestCount).toBe(5);
    });

    it("ドメインサービスと拡張機能サービスを両方返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getExtensionStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        byExtension: {
          "ext-1": { name: "Test Ext", count: 5, domains: ["example.com"], lastActivityTime: 1700000090000 },
        },
        byDomain: { "example.com": { count: 5, extensions: ["ext-1"] } },
        total: 5,
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-1": { id: "ext-1", name: "Test Ext", version: "2.0", enabled: true },
      });

      const result = (await execute()) as Array<{ id: string }>;

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toContain("domain:example.com");
      expect(result.map((s) => s.id)).toContain("extension:ext-1");
    });
  });
});
