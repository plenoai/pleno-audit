import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNRDDetector, type NRDCache } from "./detector.js";
import type { NRDConfig, NRDResult } from "./types.js";

// Mock RDAP module
vi.mock("./rdap.js", () => ({
  queryRDAP: vi.fn(),
  extractRegistrationDate: vi.fn(),
}));

import { queryRDAP, extractRegistrationDate } from "./rdap.js";

const mockQueryRDAP = queryRDAP as ReturnType<typeof vi.fn>;
const mockExtractRegistrationDate = extractRegistrationDate as ReturnType<typeof vi.fn>;

function createMockCache(): NRDCache & { store: Map<string, NRDResult> } {
  const store = new Map<string, NRDResult>();
  return {
    store,
    get: vi.fn((domain: string) => store.get(domain) || null),
    set: vi.fn((domain: string, result: NRDResult) => {
      store.set(domain, result);
    }),
    clear: vi.fn(() => store.clear()),
  };
}

const defaultConfig: NRDConfig = {
  thresholdDays: 30,
  rdapTimeout: 5000,
  cacheExpiry: 86400000, // 24 hours
};

describe("createNRDDetector", () => {
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    cache = createMockCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("checkDomain", () => {
    it("returns NRD result for newly registered domain", async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const registrationDate = tenDaysAgo.toISOString();

      mockQueryRDAP.mockResolvedValue({ events: [{ eventAction: "registration" }] });
      mockExtractRegistrationDate.mockReturnValue(registrationDate);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("new-domain.com");

      expect(result.isNRD).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.method).toBe("rdap");
      expect(result.domain).toBe("new-domain.com");
      expect(result.registrationDate).toBe(registrationDate);
      expect(result.domainAge).toBeLessThanOrEqual(11); // ~10 days
    });

    it("returns non-NRD result for old domain", async () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const registrationDate = oneYearAgo.toISOString();

      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(registrationDate);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("old-domain.com");

      expect(result.isNRD).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.domainAge).toBeGreaterThan(360);
    });

    it("returns cached result when available", async () => {
      const cachedResult: NRDResult = {
        domain: "cached.com",
        isNRD: true,
        confidence: "high",
        registrationDate: "2024-01-01",
        domainAge: 10,
        method: "rdap",
        suspiciousScores: {
          entropy: 0.5,
          suspiciousTLD: false,
          hasExcessiveHyphens: false,
          hasExcessiveNumbers: false,
          isRandomLooking: false,
          totalScore: 10,
        },
        ddns: { isDDNS: false, provider: null },
        checkedAt: Date.now(),
      };
      cache.store.set("cached.com", cachedResult);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("cached.com");

      expect(result.method).toBe("cache");
      expect(result.isNRD).toBe(true);
      expect(mockQueryRDAP).not.toHaveBeenCalled();
    });

    it("ignores expired cache entries", async () => {
      const expiredResult: NRDResult = {
        domain: "expired.com",
        isNRD: true,
        confidence: "high",
        registrationDate: "2024-01-01",
        domainAge: 10,
        method: "rdap",
        suspiciousScores: {
          entropy: 0.5,
          suspiciousTLD: false,
          hasExcessiveHyphens: false,
          hasExcessiveNumbers: false,
          isRandomLooking: false,
          totalScore: 10,
        },
        ddns: { isDDNS: false, provider: null },
        checkedAt: Date.now() - defaultConfig.cacheExpiry - 1000, // Expired
      };
      cache.store.set("expired.com", expiredResult);

      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(null);

      const detector = createNRDDetector(defaultConfig, cache);
      await detector.checkDomain("expired.com");

      expect(mockQueryRDAP).toHaveBeenCalled();
    });

    it("handles RDAP error gracefully", async () => {
      mockQueryRDAP.mockRejectedValue(new Error("RDAP failed"));

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("error-domain.com");

      expect(result.isNRD).toBe(false);
      expect(result.confidence).toBe("unknown");
      expect(result.method).toBe("error");
      expect(result.registrationDate).toBeNull();
    });

    it("handles RDAP response without registration date", async () => {
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(null);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("unknown-age.com");

      expect(result.isNRD).toBe(false);
      expect(result.confidence).toBe("unknown");
      expect(result.domainAge).toBeNull();
    });

    it("detects DDNS domains", async () => {
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(null);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("test.duckdns.org");

      expect(result.ddns.isDDNS).toBe(true);
      expect(result.ddns.provider).toBe("DuckDNS");
    });

    it("caches result after query", async () => {
      const registrationDate = new Date().toISOString();
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(registrationDate);

      const detector = createNRDDetector(defaultConfig, cache);
      await detector.checkDomain("new.com");

      expect(cache.set).toHaveBeenCalledWith(
        "new.com",
        expect.objectContaining({ domain: "new.com" })
      );
    });

    it("includes suspicious scores in result", async () => {
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(null);

      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("ab12cd34.xyz");

      expect(result.suspiciousScores).toBeDefined();
      expect(typeof result.suspiciousScores.entropy).toBe("number");
      expect(typeof result.suspiciousScores.totalScore).toBe("number");
    });

    it("respects threshold configuration", async () => {
      const customConfig: NRDConfig = {
        ...defaultConfig,
        thresholdDays: 7, // Stricter threshold
      };

      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(tenDaysAgo.toISOString());

      const detector = createNRDDetector(customConfig, cache);
      const result = await detector.checkDomain("test.com");

      // 10 days old, but threshold is 7 days, so NOT NRD
      expect(result.isNRD).toBe(false);
    });

    it("includes timestamp in result", async () => {
      mockQueryRDAP.mockResolvedValue({ events: [] });
      mockExtractRegistrationDate.mockReturnValue(null);

      const before = Date.now();
      const detector = createNRDDetector(defaultConfig, cache);
      const result = await detector.checkDomain("test.com");
      const after = Date.now();

      expect(result.checkedAt).toBeGreaterThanOrEqual(before);
      expect(result.checkedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("checkDomainSync", () => {
    it("returns suspicious scores without network call", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("example.com");

      expect(scores).toBeDefined();
      expect(typeof scores.entropy).toBe("number");
      expect(typeof scores.totalScore).toBe("number");
      expect(mockQueryRDAP).not.toHaveBeenCalled();
    });

    it("detects suspicious TLD", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("test.xyz");

      expect(scores.suspiciousTLD).toBe(true);
    });

    it("detects excessive hyphens", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("a-b-c-d.com");

      expect(scores.hasExcessiveHyphens).toBe(true);
    });

    it("detects excessive numbers", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("test12345.com");

      expect(scores.hasExcessiveNumbers).toBe(true);
    });

    it("detects random-looking domains", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("xyzqwrt.com");

      expect(scores.isRandomLooking).toBe(true);
    });

    it("returns low score for normal domain", () => {
      const detector = createNRDDetector(defaultConfig, cache);
      const scores = detector.checkDomainSync("google.com");

      expect(scores.totalScore).toBeLessThan(30);
    });
  });
});

describe("NRD threshold edge cases", () => {
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    cache = createMockCache();
    vi.clearAllMocks();
  });

  it("domain exactly at threshold is NRD", async () => {
    const now = new Date();
    const exactlyThresholdDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    mockQueryRDAP.mockResolvedValue({ events: [] });
    mockExtractRegistrationDate.mockReturnValue(exactlyThresholdDays.toISOString());

    const detector = createNRDDetector(defaultConfig, cache);
    const result = await detector.checkDomain("exact.com");

    expect(result.isNRD).toBe(true);
  });

  it("domain one day over threshold is not NRD", async () => {
    const now = new Date();
    const justOverThreshold = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    mockQueryRDAP.mockResolvedValue({ events: [] });
    mockExtractRegistrationDate.mockReturnValue(justOverThreshold.toISOString());

    const detector = createNRDDetector(defaultConfig, cache);
    const result = await detector.checkDomain("old.com");

    expect(result.isNRD).toBe(false);
  });
});
