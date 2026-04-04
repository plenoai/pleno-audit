import { describe, expect, it, vi, beforeEach } from "vitest";
import { createComputationHandlers } from "./computation-handlers.js";
import type { RuntimeHandlerDependencies } from "./types.js";
import type { DetectedService } from "../../types/index.js";

// chrome.storage.local モック
const storageData: Record<string, unknown> = {};
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          for (const k of keys) result[k] = storageData[k];
          return Promise.resolve(result);
        }
        return Promise.resolve({ [keys]: storageData[keys] });
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(storageData, data);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete storageData[key];
        return Promise.resolve();
      }),
    },
  },
} as unknown as typeof chrome;

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

// ---------------------------------------------------------------------------
// モック依存関係
// ---------------------------------------------------------------------------

function createMockDeps(): Pick<
  RuntimeHandlerDependencies,
  | "logger"
  | "getServices"
  | "getCSPReports"
  | "getNetworkRequests"
  | "getExtensionStats"
  | "getKnownExtensions"
  | "getServiceConnections"
  | "getExtensionConnections"
  | "getAlerts"
> {
  return {
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getServices: vi.fn<() => Promise<DetectedService[]>>().mockResolvedValue([]),
    getAlerts: vi.fn().mockResolvedValue([]),
    getCSPReports: vi.fn().mockResolvedValue({ reports: [] }),
    getNetworkRequests: vi.fn().mockResolvedValue({ requests: [] }),
    getExtensionStats: vi.fn().mockResolvedValue(null),
    getKnownExtensions: vi.fn().mockReturnValue({}),
    getServiceConnections: vi.fn().mockResolvedValue({}),
    getExtensionConnections: vi.fn().mockResolvedValue({}),
  };
}

describe("createComputationHandlers", () => {
  it("GET_POPUP_EVENTSとGET_AGGREGATED_SERVICESのエントリを返す", () => {
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);

    expect(entries).toHaveLength(7);
    expect(entries[0][0]).toBe("GET_POPUP_EVENTS");
    expect(entries[1][0]).toBe("DISMISS_ALERT_PATTERN");
    expect(entries[2][0]).toBe("REOPEN_DISMISSED_PATTERN");
    expect(entries[3][0]).toBe("GET_DISMISS_RECORDS");
    expect(entries[4][0]).toBe("DELETE_DISMISS_RECORD");
    expect(entries[5][0]).toBe("DELETE_SERVICE");
    expect(entries[6][0]).toBe("GET_AGGREGATED_SERVICES");
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
    for (const key of Object.keys(storageData)) delete storageData[key];
    deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const popupEntry = entries.find(([name]) => name === "GET_POPUP_EVENTS")!;
    execute = popupEntry[1].execute as typeof execute;
    fallback = popupEntry[1].fallback;
  });

  it("servicesを取得する", async () => {
    await execute();

    expect(deps.getServices).toHaveBeenCalledOnce();
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

      const result = await execute();

      expect(result.counts.critical).toBe(1);
      expect(result.counts.high).toBe(1);
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

  // -------------------------------------------------------------------------
  // dismissされたパターンのフィルタリング
  // -------------------------------------------------------------------------

  describe("dismissされたパターンのフィルタリング", () => {
    it("DismissRecordでdismissされたアラートを除外する", async () => {
      storageData["pleno_dismiss_records"] = [{
        pattern: "nrd::dismissed.com",
        reason: "false_positive",
        dismissedAt: Date.now(),
        alertSnapshot: { category: "nrd", domain: "dismissed.com", severity: "high", title: "dismissed.com" },
      }];

      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "dismissed.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 1, checkedAt: 1700000000000 },
        }),
        createService({
          domain: "visible.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 2, checkedAt: 1700000001000 },
        }),
      ]);

      const result = await execute();
      expect(result.events).toHaveLength(1);
      expect(result.events[0].domain).toBe("visible.com");
    });

    it("reopened済みのDismissRecordはフィルタしない", async () => {
      storageData["pleno_dismiss_records"] = [{
        pattern: "nrd::reopened.com",
        reason: "false_positive",
        dismissedAt: Date.now() - 10000,
        reopenedAt: Date.now(),
        alertSnapshot: { category: "nrd", domain: "reopened.com", severity: "high", title: "reopened.com" },
      }];

      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({
          domain: "reopened.com",
          nrdResult: { isNRD: true, confidence: "high", domainAge: 1, checkedAt: 1700000000000 },
        }),
      ]);

      const result = await execute();
      expect(result.events).toHaveLength(1);
      expect(result.events[0].domain).toBe("reopened.com");
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
    for (const key of Object.keys(storageData)) delete storageData[key];
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
        lastActivity: number;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "domain:example.com",
        source: { type: "domain", domain: "example.com" },
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
  // serviceConnections からの通信先取得
  // -------------------------------------------------------------------------

  describe("serviceConnectionsからの通信先取得", () => {
    it("serviceConnectionsから接続先ドメインを取得する", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getServiceConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "example.com": ["cdn.example.net", "api.example.net"],
      });

      const result = (await execute()) as Array<{ connections: Array<{ domain: string }> }>;

      expect(result[0].connections).toHaveLength(2);
      expect(result[0].connections[0]).toEqual({ domain: "cdn.example.net" });
      expect(result[0].connections[1]).toEqual({ domain: "api.example.net" });
    });

    it("serviceConnectionsにサービスがない場合、空の接続を返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getServiceConnections as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = (await execute()) as Array<{ connections: unknown[] }>;

      expect(result[0].connections).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 拡張機能サービス
  // -------------------------------------------------------------------------

  describe("拡張機能サービスの変換", () => {
    it("extensionConnectionsから拡張機能をUnifiedService形式で返す", async () => {
      (deps.getExtensionConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "ext-abc": ["example.com"],
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
        connections: Array<{ domain: string }>;
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
        lastActivity: 0,
      });
      expect(extService!.connections).toContainEqual({ domain: "example.com" });
    });

    it("extensionConnectionsが空でも既知の拡張機能は空の接続で返す", async () => {
      (deps.getExtensionConnections as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-xyz": { id: "ext-xyz", name: "Some Ext", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{ id: string; connections: unknown[] }>;

      const ext = result.find((s) => s.id === "extension:ext-xyz");
      expect(ext).toBeDefined();
      expect(ext!.connections).toHaveLength(0);
    });

    it("アイコンがない拡張機能ではiconがundefinedになる", async () => {
      (deps.getExtensionConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "ext-no-icon": ["test.com"],
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

    it("複数拡張機能の接続先をそれぞれ正確に返す", async () => {
      (deps.getExtensionConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "ext-a": ["shared.com"],
        "ext-b": ["shared.com"],
      });
      (deps.getKnownExtensions as ReturnType<typeof vi.fn>).mockReturnValue({
        "ext-a": { id: "ext-a", name: "Ext A", version: "1.0", enabled: true },
        "ext-b": { id: "ext-b", name: "Ext B", version: "1.0", enabled: true },
      });

      const result = (await execute()) as Array<{
        id: string;
        connections: Array<{ domain: string }>;
      }>;

      const extA = result.find((s) => s.id === "extension:ext-a");
      const extB = result.find((s) => s.id === "extension:ext-b");

      expect(extA?.connections[0].domain).toBe("shared.com");
      expect(extB?.connections[0].domain).toBe("shared.com");
    });

    it("ドメインサービスと拡張機能サービスを両方返す", async () => {
      (deps.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
        createService({ domain: "example.com" }),
      ]);
      (deps.getExtensionConnections as ReturnType<typeof vi.fn>).mockResolvedValue({
        "ext-1": ["example.com"],
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

// ===========================================================================
// DISMISS_ALERT_PATTERN (DismissRecord)
// ===========================================================================

describe("DISMISS_ALERT_PATTERN", () => {
  let execute: (message: { data: unknown }) => Promise<{ ok: boolean }>;

  beforeEach(() => {
    for (const key of Object.keys(storageData)) delete storageData[key];
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const entry = entries.find(([name]) => name === "DISMISS_ALERT_PATTERN")!;
    execute = entry[1].execute as typeof execute;
  });

  it("DismissRecordを作成して保存する", async () => {
    await execute({
      data: {
        category: "nrd",
        domain: "evil.com",
        severity: "high",
        title: "NRD: evil.com",
        reason: "false_positive",
        comment: "テスト用ドメイン",
      },
    });

    const records = storageData["pleno_dismiss_records"] as Array<Record<string, unknown>>;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      pattern: "nrd::evil.com",
      reason: "false_positive",
      comment: "テスト用ドメイン",
      alertSnapshot: { category: "nrd", domain: "evil.com", severity: "high", title: "NRD: evil.com" },
    });
    expect(records[0].dismissedAt).toBeTypeOf("number");
  });

  it("reason省略時はwont_fixがデフォルト", async () => {
    await execute({
      data: { category: "nrd", domain: "test.com" },
    });

    const records = storageData["pleno_dismiss_records"] as Array<Record<string, unknown>>;
    expect(records[0]).toMatchObject({ reason: "wont_fix" });
  });

  it("一括dismissを処理する", async () => {
    await execute({
      data: {
        patterns: [
          { category: "nrd", domain: "a.com" },
          { category: "typosquat", domain: "b.com" },
        ],
        reason: "investigating",
      },
    });

    const records = storageData["pleno_dismiss_records"] as Array<Record<string, unknown>>;
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ pattern: "nrd::a.com", reason: "investigating" });
    expect(records[1]).toMatchObject({ pattern: "typosquat::b.com", reason: "investigating" });
  });

  it("investigating理由を保存する", async () => {
    await execute({
      data: {
        category: "nrd",
        domain: "suspicious.com",
        reason: "investigating",
        comment: "調査中",
      },
    });

    const records = storageData["pleno_dismiss_records"] as Array<Record<string, unknown>>;
    expect(records[0]).toMatchObject({
      pattern: "nrd::suspicious.com",
      reason: "investigating",
      comment: "調査中",
    });
  });
});

// ===========================================================================
// REOPEN_DISMISSED_PATTERN
// ===========================================================================

describe("REOPEN_DISMISSED_PATTERN", () => {
  let dismissExecute: (message: { data: unknown }) => Promise<{ ok: boolean }>;
  let reopenExecute: (message: { data: unknown }) => Promise<{ ok: boolean }>;

  beforeEach(() => {
    for (const key of Object.keys(storageData)) delete storageData[key];
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    dismissExecute = entries.find(([name]) => name === "DISMISS_ALERT_PATTERN")![1].execute as typeof dismissExecute;
    reopenExecute = entries.find(([name]) => name === "REOPEN_DISMISSED_PATTERN")![1].execute as typeof reopenExecute;
  });

  it("dismissed recordにreopenedAtを設定する", async () => {
    await dismissExecute({
      data: { category: "nrd", domain: "evil.com", reason: "false_positive" },
    });

    await reopenExecute({
      data: { pattern: "nrd::evil.com" },
    });

    const records = storageData["pleno_dismiss_records"] as Array<Record<string, unknown>>;
    expect(records[0].reopenedAt).toBeTypeOf("number");
  });
});

// ===========================================================================
// GET_DISMISS_RECORDS
// ===========================================================================

describe("GET_DISMISS_RECORDS", () => {
  it("全てのDismissRecordを返す", async () => {
    for (const key of Object.keys(storageData)) delete storageData[key];
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const dismissExecute = entries.find(([name]) => name === "DISMISS_ALERT_PATTERN")![1].execute as (message: { data: unknown }) => Promise<unknown>;
    const getRecords = entries.find(([name]) => name === "GET_DISMISS_RECORDS")![1].execute as () => Promise<unknown[]>;

    await dismissExecute({ data: { category: "nrd", domain: "a.com", reason: "false_positive" } });
    await dismissExecute({ data: { category: "nrd", domain: "b.com", reason: "wont_fix" } });

    const records = await getRecords();
    expect(records).toHaveLength(2);
  });
});

// ===========================================================================
// DELETE_DISMISS_RECORD
// ===========================================================================

describe("DELETE_DISMISS_RECORD", () => {
  it("指定パターンのレコードを削除する", async () => {
    for (const key of Object.keys(storageData)) delete storageData[key];
    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const dismissExecute = entries.find(([name]) => name === "DISMISS_ALERT_PATTERN")![1].execute as (message: { data: unknown }) => Promise<unknown>;
    const deleteExecute = entries.find(([name]) => name === "DELETE_DISMISS_RECORD")![1].execute as (message: { data: unknown }) => Promise<unknown>;
    const getRecords = entries.find(([name]) => name === "GET_DISMISS_RECORDS")![1].execute as () => Promise<unknown[]>;

    await dismissExecute({ data: { category: "nrd", domain: "a.com", reason: "false_positive" } });
    await dismissExecute({ data: { category: "nrd", domain: "b.com", reason: "wont_fix" } });
    await deleteExecute({ data: { pattern: "nrd::a.com" } });

    const records = await getRecords();
    expect(records).toHaveLength(1);
    expect((records[0] as Record<string, unknown>).pattern).toBe("nrd::b.com");
  });
});

// ===========================================================================
// マイグレーション
// ===========================================================================

describe("マイグレーション: 旧dismiss patterns → DismissRecord", () => {
  it("旧パターンをDismissRecordに変換する", async () => {
    for (const key of Object.keys(storageData)) delete storageData[key];
    // 旧形式のデータを設定
    storageData["pleno_dismissed_alert_patterns"] = ["nrd::old.com", "typosquat::legacy.com"];

    const deps = createMockDeps();
    const entries = createComputationHandlers(deps as unknown as RuntimeHandlerDependencies);
    const getRecords = entries.find(([name]) => name === "GET_DISMISS_RECORDS")![1].execute as () => Promise<unknown[]>;

    const records = await getRecords();

    expect(records).toHaveLength(2);
    expect((records[0] as Record<string, unknown>).pattern).toBe("nrd::old.com");
    expect((records[0] as Record<string, unknown>).reason).toBe("wont_fix");
    expect((records[1] as Record<string, unknown>).pattern).toBe("typosquat::legacy.com");
    // 旧キーは削除されている
    expect(storageData["pleno_dismissed_alert_patterns"]).toBeUndefined();
  });
});
