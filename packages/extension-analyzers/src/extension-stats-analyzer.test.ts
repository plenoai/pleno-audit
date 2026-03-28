import { describe, it, expect } from "vitest";
import {
  generateExtensionStats,
  generateDailyTimeSeries,
  generateWeeklyTimeSeries,
  generateDashboardStats,
  ExtensionStatsCache,
} from "./extension-stats-analyzer.js";
import type { ExtensionRequestRecord } from "@libztbs/types";

function makeRecord(overrides: Partial<ExtensionRequestRecord> = {}): ExtensionRequestRecord {
  return {
    id: "r-" + Math.random().toString(36).slice(2, 8),
    extensionId: "ext-abc",
    extensionName: "Test Extension",
    timestamp: 1742040000000,
    url: "https://api.example.com/data",
    method: "GET",
    resourceType: "xmlhttprequest",
    domain: "api.example.com",
    detectedBy: "webRequest",
    ...overrides,
  };
}

describe("generateExtensionStats", () => {
  it("returns empty array for no records", () => {
    expect(generateExtensionStats([])).toEqual([]);
  });

  it("groups records by extension ID", () => {
    const records = [
      makeRecord({ extensionId: "ext-a", extensionName: "A" }),
      makeRecord({ extensionId: "ext-b", extensionName: "B" }),
      makeRecord({ extensionId: "ext-a", extensionName: "A" }),
    ];
    const stats = generateExtensionStats(records);
    expect(stats).toHaveLength(2);
    const extA = stats.find((s) => s.extensionId === "ext-a")!;
    expect(extA.totalRequests).toBe(2);
  });

  it("calculates top domains correctly", () => {
    const records = [
      makeRecord({ url: "https://cdn.evil.com/track" }),
      makeRecord({ url: "https://cdn.evil.com/more" }),
      makeRecord({ url: "https://api.good.com/data" }),
    ];
    const stats = generateExtensionStats(records);
    expect(stats[0].topDomains[0].domain).toBe("cdn.evil.com");
    expect(stats[0].topDomains[0].count).toBe(2);
    expect(stats[0].topDomains[0].percentage).toBeCloseTo(66.67, 0);
  });

  it("counts detection method breakdown", () => {
    const records = [
      makeRecord({ detectedBy: "webRequest" }),
      makeRecord({ detectedBy: "declarativeNetRequest" }),
      makeRecord({ detectedBy: "declarativeNetRequest" }),
    ];
    const stats = generateExtensionStats(records);
    expect(stats[0].detectionBreakdown).toEqual({
      webRequest: 1,
      declarativeNetRequest: 2,
    });
  });

  it("sorts results by requestsPerDay descending", () => {
    const now = 1742040000000;
    const records = [
      // ext-slow: 1 request over 10 days
      makeRecord({ extensionId: "ext-slow", extensionName: "Slow", timestamp: now - 10 * 86400000 }),
      makeRecord({ extensionId: "ext-slow", extensionName: "Slow", timestamp: now }),
      // ext-fast: 10 requests in 1 day
      ...Array.from({ length: 10 }, () =>
        makeRecord({ extensionId: "ext-fast", extensionName: "Fast", timestamp: now }),
      ),
    ];
    const stats = generateExtensionStats(records);
    expect(stats[0].extensionId).toBe("ext-fast");
  });
});

describe("generateDailyTimeSeries", () => {
  it("returns empty array for no records", () => {
    expect(generateDailyTimeSeries([])).toEqual([]);
  });

  it("groups records into daily buckets", () => {
    // 2024-01-15 UTC and 2024-01-16 UTC
    const day1 = new Date("2024-01-15T10:00:00Z").getTime();
    const day2 = new Date("2024-01-16T14:00:00Z").getTime();

    const records = [
      makeRecord({ timestamp: day1 }),
      makeRecord({ timestamp: day1 + 3600000 }), // same day
      makeRecord({ timestamp: day2 }),
    ];
    const series = generateDailyTimeSeries(records);
    expect(series).toHaveLength(2);
    expect(series[0].requestCount).toBe(2);
    expect(series[1].requestCount).toBe(1);
  });

  it("counts unique domains per day", () => {
    const ts = new Date("2024-01-15T10:00:00Z").getTime();
    const records = [
      makeRecord({ timestamp: ts, url: "https://a.com/1" }),
      makeRecord({ timestamp: ts, url: "https://a.com/2" }),
      makeRecord({ timestamp: ts, url: "https://b.com/1" }),
    ];
    const series = generateDailyTimeSeries(records);
    expect(series[0].uniqueDomains).toBe(2);
  });

  it("identifies dominant resource type", () => {
    const ts = new Date("2024-01-15T10:00:00Z").getTime();
    const records = [
      makeRecord({ timestamp: ts, resourceType: "xmlhttprequest" }),
      makeRecord({ timestamp: ts, resourceType: "xmlhttprequest" }),
      makeRecord({ timestamp: ts, resourceType: "image" }),
    ];
    const series = generateDailyTimeSeries(records);
    expect(series[0].dominantResourceType).toBe("xmlhttprequest");
  });

  it("results are sorted by timestamp ascending", () => {
    const day1 = new Date("2024-01-16T10:00:00Z").getTime();
    const day2 = new Date("2024-01-15T10:00:00Z").getTime();

    const records = [makeRecord({ timestamp: day1 }), makeRecord({ timestamp: day2 })];
    const series = generateDailyTimeSeries(records);
    expect(series[0].timestamp).toBeLessThan(series[1].timestamp);
  });
});

describe("generateWeeklyTimeSeries", () => {
  it("groups records into weekly buckets starting Monday", () => {
    // 2024-01-15 is a Monday, 2024-01-22 is the next Monday
    const week1 = new Date("2024-01-17T10:00:00Z").getTime(); // Wednesday week 1
    const week2 = new Date("2024-01-24T10:00:00Z").getTime(); // Wednesday week 2

    const records = [
      makeRecord({ timestamp: week1 }),
      makeRecord({ timestamp: week2 }),
    ];
    const series = generateWeeklyTimeSeries(records);
    expect(series).toHaveLength(2);
    expect(series[0].period).toBe("weekly");
  });
});

describe("generateDashboardStats", () => {
  it("returns empty stats for no records", () => {
    const stats = generateDashboardStats([]);
    expect(stats.totalExtensions).toBe(0);
    expect(stats.totalRequests).toBe(0);
    expect(stats.extensionStats).toEqual([]);
    expect(stats.topDomains).toEqual([]);
  });

  it("aggregates across all extensions", () => {
    const records = [
      makeRecord({ extensionId: "ext-a", extensionName: "A", url: "https://shared.com/x" }),
      makeRecord({ extensionId: "ext-b", extensionName: "B", url: "https://shared.com/y" }),
    ];
    const stats = generateDashboardStats(records);
    expect(stats.totalExtensions).toBe(2);
    expect(stats.totalRequests).toBe(2);
    expect(stats.topDomains[0].domain).toBe("shared.com");
    expect(stats.topDomains[0].extensionIds).toContain("ext-a");
    expect(stats.topDomains[0].extensionIds).toContain("ext-b");
  });

  it("calculates correct date range", () => {
    const records = [
      makeRecord({ timestamp: 1000 }),
      makeRecord({ timestamp: 5000 }),
      makeRecord({ timestamp: 3000 }),
    ];
    const stats = generateDashboardStats(records);
    expect(stats.dateRange.start).toBe(1000);
    expect(stats.dateRange.end).toBe(5000);
  });
});

describe("ExtensionStatsCache", () => {
  it("returns cached result within TTL", () => {
    const cache = new ExtensionStatsCache();
    const records = [makeRecord()];

    const first = cache.getStats(records);
    const second = cache.getStats(records);
    expect(first).toBe(second); // same reference = cache hit
  });

  it("clears cache", () => {
    const cache = new ExtensionStatsCache();
    const records = [makeRecord()];

    const first = cache.getStats(records);
    cache.clear();
    const second = cache.getStats(records);
    expect(first).not.toBe(second);
  });
});
