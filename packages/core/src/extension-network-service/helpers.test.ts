import { describe, it, expect } from "vitest";
import type { NetworkRequestRecord } from "../extension-runtime/index.js";
import {
  queryNetworkRequests,
  groupRequestsByExtensionId,
  filterRequestsWithExtensionId,
  summarizeExtensionStats,
  getUniqueDomains,
  mapToExtensionAnalysisRequest,
} from "./helpers.js";

function createRecord(
  overrides: Partial<NetworkRequestRecord> = {},
): NetworkRequestRecord {
  return {
    id: "req-1",
    url: "https://example.com/api",
    method: "GET",
    timestamp: 1000,
    domain: "example.com",
    resourceType: "xmlhttprequest",
    initiator: null,
    initiatorType: "extension",
    tabId: 1,
    frameId: 0,
    detectedBy: "webRequest",
    ...overrides,
  };
}

describe("queryNetworkRequests", () => {
  const records: NetworkRequestRecord[] = [
    createRecord({ id: "r1", timestamp: 100, initiatorType: "extension" }),
    createRecord({ id: "r2", timestamp: 300, initiatorType: "page" }),
    createRecord({ id: "r3", timestamp: 200, initiatorType: "extension" }),
    createRecord({ id: "r4", timestamp: 400, initiatorType: "browser" }),
  ];

  it("returns all records sorted by timestamp descending with no options", () => {
    const result = queryNetworkRequests(records);
    expect(result.total).toBe(4);
    expect(result.requests.map((r) => r.id)).toEqual([
      "r4",
      "r2",
      "r3",
      "r1",
    ]);
  });

  it("filters by since timestamp", () => {
    const result = queryNetworkRequests(records, { since: 250 });
    expect(result.total).toBe(2);
    expect(result.requests.map((r) => r.id)).toEqual(["r4", "r2"]);
  });

  it("filters by initiatorType", () => {
    const result = queryNetworkRequests(records, {
      initiatorType: "extension",
    });
    expect(result.total).toBe(2);
    expect(result.requests.map((r) => r.id)).toEqual(["r3", "r1"]);
  });

  it("applies limit", () => {
    const result = queryNetworkRequests(records, { limit: 2 });
    expect(result.total).toBe(4);
    expect(result.requests).toHaveLength(2);
    expect(result.requests.map((r) => r.id)).toEqual(["r4", "r2"]);
  });

  it("applies offset", () => {
    const result = queryNetworkRequests(records, { offset: 2 });
    expect(result.total).toBe(4);
    expect(result.requests.map((r) => r.id)).toEqual(["r3", "r1"]);
  });

  it("applies limit and offset together", () => {
    const result = queryNetworkRequests(records, { offset: 1, limit: 2 });
    expect(result.total).toBe(4);
    expect(result.requests.map((r) => r.id)).toEqual(["r2", "r3"]);
  });

  it("returns empty when since excludes all records", () => {
    const result = queryNetworkRequests(records, { since: 9999 });
    expect(result.total).toBe(0);
    expect(result.requests).toEqual([]);
  });
});

describe("groupRequestsByExtensionId", () => {
  it("groups requests by extensionId", () => {
    const requests = [
      createRecord({ id: "r1", extensionId: "ext-a" }),
      createRecord({ id: "r2", extensionId: "ext-b" }),
      createRecord({ id: "r3", extensionId: "ext-a" }),
    ];
    const grouped = groupRequestsByExtensionId(requests);
    expect(grouped.size).toBe(2);
    expect(grouped.get("ext-a")?.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(grouped.get("ext-b")?.map((r) => r.id)).toEqual(["r2"]);
  });

  it("skips records without extensionId", () => {
    const requests = [
      createRecord({ id: "r1", extensionId: "ext-a" }),
      createRecord({ id: "r2", extensionId: undefined }),
      createRecord({ id: "r3" }),
    ];
    const grouped = groupRequestsByExtensionId(requests);
    expect(grouped.size).toBe(1);
    expect(grouped.get("ext-a")).toHaveLength(1);
  });

  it("returns empty map for empty input", () => {
    const grouped = groupRequestsByExtensionId([]);
    expect(grouped.size).toBe(0);
  });
});

describe("filterRequestsWithExtensionId", () => {
  it("keeps only records with extensionId", () => {
    const requests = [
      createRecord({ id: "r1", extensionId: "ext-a" }),
      createRecord({ id: "r2", extensionId: undefined }),
      createRecord({ id: "r3", extensionId: "ext-b" }),
    ];
    const filtered = filterRequestsWithExtensionId(requests);
    expect(filtered.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("returns empty array when none have extensionId", () => {
    const requests = [
      createRecord({ extensionId: undefined }),
      createRecord({ extensionId: undefined }),
    ];
    expect(filterRequestsWithExtensionId(requests)).toEqual([]);
  });
});

describe("summarizeExtensionStats", () => {
  const requests = [
    createRecord({
      id: "r1",
      extensionId: "ext-a",
      extensionName: "Ext A",
      domain: "api.example.com",
      timestamp: 100,
    }),
    createRecord({
      id: "r2",
      extensionId: "ext-a",
      extensionName: "Ext A",
      domain: "cdn.example.com",
      timestamp: 200,
    }),
    createRecord({
      id: "r3",
      extensionId: "ext-b",
      extensionName: "Ext B",
      domain: "api.example.com",
      timestamp: 150,
    }),
    createRecord({ id: "r4", extensionId: undefined, domain: "other.com" }),
  ];

  it("aggregates byExtension with count, domains, and lastActivityTime", () => {
    const stats = summarizeExtensionStats(requests);
    expect(stats.byExtension["ext-a"]).toEqual({
      name: "Ext A",
      count: 2,
      domains: ["api.example.com", "cdn.example.com"],
      lastActivityTime: 200,
    });
    expect(stats.byExtension["ext-b"]).toEqual({
      name: "Ext B",
      count: 1,
      domains: ["api.example.com"],
      lastActivityTime: 150,
    });
  });

  it("aggregates byDomain with count and extensions", () => {
    const stats = summarizeExtensionStats(requests);
    expect(stats.byDomain["api.example.com"]).toEqual({
      count: 2,
      extensions: ["ext-a", "ext-b"],
    });
    expect(stats.byDomain["cdn.example.com"]).toEqual({
      count: 1,
      extensions: ["ext-a"],
    });
  });

  it("reports total as total input length (including skipped)", () => {
    const stats = summarizeExtensionStats(requests);
    expect(stats.total).toBe(4);
  });

  it("skips records without extensionId in aggregation", () => {
    const stats = summarizeExtensionStats(requests);
    expect(stats.byExtension).not.toHaveProperty("undefined");
    expect(stats.byDomain).not.toHaveProperty("other.com");
  });

  it("uses 'Unknown' when extensionName is missing", () => {
    const stats = summarizeExtensionStats([
      createRecord({ extensionId: "ext-x", extensionName: undefined }),
    ]);
    expect(stats.byExtension["ext-x"].name).toBe("Unknown");
  });
});

describe("getUniqueDomains", () => {
  it("returns deduplicated domain list", () => {
    const requests = [
      createRecord({ domain: "a.com" }),
      createRecord({ domain: "b.com" }),
      createRecord({ domain: "a.com" }),
    ];
    const domains = getUniqueDomains(requests);
    expect(domains).toHaveLength(2);
    expect(domains).toContain("a.com");
    expect(domains).toContain("b.com");
  });

  it("returns empty array for empty input", () => {
    expect(getUniqueDomains([])).toEqual([]);
  });
});

describe("mapToExtensionAnalysisRequest", () => {
  it("maps all fields correctly", () => {
    const record = createRecord({
      id: "r1",
      extensionId: "ext-a",
      extensionName: "Ext A",
      timestamp: 1000,
      url: "https://api.example.com/data",
      method: "POST",
      resourceType: "xmlhttprequest",
      domain: "api.example.com",
      detectedBy: "webRequest",
    });
    const result = mapToExtensionAnalysisRequest(record);
    expect(result).toEqual({
      id: "r1",
      extensionId: "ext-a",
      extensionName: "Ext A",
      timestamp: 1000,
      url: "https://api.example.com/data",
      method: "POST",
      resourceType: "xmlhttprequest",
      domain: "api.example.com",
      detectedBy: "webRequest",
    });
  });

  it("uses 'Unknown' when extensionName is missing", () => {
    const record = createRecord({
      extensionId: "ext-a",
      extensionName: undefined,
    });
    const result = mapToExtensionAnalysisRequest(record);
    expect(result.extensionName).toBe("Unknown");
  });

  it("throws when extensionId is missing", () => {
    const record = createRecord({ id: "r1", extensionId: undefined });
    expect(() => mapToExtensionAnalysisRequest(record)).toThrow(
      "Missing extensionId",
    );
  });
});
