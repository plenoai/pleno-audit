import { describe, it, expect } from "vitest";
import { buildServiceIndex, queryServiceIndex } from "./service-explorer.js";
import type { FilterCategory, ServiceQuery } from "./service-explorer.js";
import type { UnifiedService, SortType } from "@libztbs/types";

function makeDomainService(
  domain: string,
  overrides: {
    lastActivity?: number;
    requestCount?: number;
    isNRD?: boolean;
    isTyposquat?: boolean;
    hasAIActivity?: boolean;
    hasLoginPage?: boolean;
  } = {},
): UnifiedService {
  return {
    id: domain,
    source: {
      type: "domain",
      domain,
      service: {
        domain,
        detectedAt: 1742040000000,
        hasLoginPage: overrides.hasLoginPage ?? false,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
        cookies: [],
        nrdResult: overrides.isNRD ? { isNRD: true, confidence: "high", domainAge: 5, checkedAt: 1742040000000 } : undefined,
        typosquatResult: overrides.isTyposquat ? { isTyposquat: true, confidence: "high", totalScore: 80, checkedAt: 1742040000000 } : undefined,
        aiDetected: overrides.hasAIActivity ? { hasAIActivity: true, lastActivityAt: 1742040000000, providers: [] } : undefined,
      },
    },
    connections: [{ domain: "api.example.com", requestCount: overrides.requestCount ?? 1 }],
    lastActivity: overrides.lastActivity ?? 1742040000000,
  };
}

function makeExtensionService(name: string, requestCount = 1): UnifiedService {
  return {
    id: `ext-${name}`,
    source: { type: "extension", extensionId: `ext-${name}`, extensionName: name },
    connections: [{ domain: "cdn.ext.com", requestCount }],
    lastActivity: 1742040000000,
  };
}

function query(overrides: Partial<ServiceQuery> = {}): ServiceQuery {
  return {
    sortType: "activity",
    searchQuery: "",
    activeFilters: new Set<FilterCategory>(),
    limit: 100,
    ...overrides,
  };
}

describe("buildServiceIndex", () => {
  it("builds index from empty array", () => {
    const index = buildServiceIndex([]);
    expect(index.entries).toHaveLength(0);
    expect(index.counts.nrd).toBe(0);
  });

  it("counts filter categories correctly", () => {
    const services = [
      makeDomainService("nrd.evil.com", { isNRD: true }),
      makeDomainService("typo.evil.com", { isTyposquat: true }),
      makeDomainService("ai.service.com", { hasAIActivity: true }),
      makeDomainService("login.example.com", { hasLoginPage: true }),
      makeExtensionService("AdBlock"),
    ];
    const index = buildServiceIndex(services);
    expect(index.counts.nrd).toBe(1);
    expect(index.counts.typosquat).toBe(1);
    expect(index.counts.ai).toBe(1);
    expect(index.counts.login).toBe(1);
    expect(index.counts.extension).toBe(1);
  });

  it("counts services with multiple tags in each category", () => {
    const services = [
      makeDomainService("bad.com", { isNRD: true, isTyposquat: true }),
    ];
    const index = buildServiceIndex(services);
    expect(index.counts.nrd).toBe(1);
    expect(index.counts.typosquat).toBe(1);
  });
});

describe("queryServiceIndex", () => {
  const services = [
    makeDomainService("google.com", { lastActivity: 3000, requestCount: 10 }),
    makeDomainService("evil-nrd.com", { lastActivity: 2000, isNRD: true, requestCount: 5 }),
    makeDomainService("ai-tool.io", { lastActivity: 1000, hasAIActivity: true, requestCount: 20 }),
    makeExtensionService("AdBlock"),
  ];
  const index = buildServiceIndex(services);

  describe("search", () => {
    it("filters by search query (case-insensitive)", () => {
      const result = queryServiceIndex(index, query({ searchQuery: "Google" }));
      expect(result.services).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("returns all when search is empty", () => {
      const result = queryServiceIndex(index, query({ searchQuery: "" }));
      expect(result.total).toBe(4);
    });

    it("returns empty for no matches", () => {
      const result = queryServiceIndex(index, query({ searchQuery: "nonexistent" }));
      expect(result.total).toBe(0);
    });
  });

  describe("filters (OR logic)", () => {
    it("filters by single category", () => {
      const result = queryServiceIndex(index, query({
        activeFilters: new Set<FilterCategory>(["nrd"]),
      }));
      expect(result.services).toHaveLength(1);
      expect((result.services[0].source as any).domain).toBe("evil-nrd.com");
    });

    it("filters by multiple categories (OR)", () => {
      const result = queryServiceIndex(index, query({
        activeFilters: new Set<FilterCategory>(["nrd", "ai"]),
      }));
      expect(result.services).toHaveLength(2);
    });

    it("no filters returns all", () => {
      const result = queryServiceIndex(index, query({
        activeFilters: new Set<FilterCategory>(),
      }));
      expect(result.total).toBe(4);
    });
  });

  describe("sorting", () => {
    it("sorts by activity (lastActivity desc)", () => {
      const result = queryServiceIndex(index, query({ sortType: "activity" }));
      const activities = result.services.map((s) => s.lastActivity);
      for (let i = 1; i < activities.length; i++) {
        expect(activities[i]).toBeLessThanOrEqual(activities[i - 1]);
      }
    });

    it("sorts by connections (requestCount desc)", () => {
      const result = queryServiceIndex(index, query({ sortType: "connections" }));
      const totals = result.services.map((s) =>
        s.connections.reduce((sum, c) => sum + c.requestCount, 0),
      );
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i]).toBeLessThanOrEqual(totals[i - 1]);
      }
    });

    it("sorts by name alphabetically", () => {
      const result = queryServiceIndex(index, query({ sortType: "name" }));
      const names = result.services.map((s) =>
        s.source.type === "domain" ? s.source.domain : s.source.extensionName,
      );
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });

  describe("pagination", () => {
    it("limits results", () => {
      const result = queryServiceIndex(index, query({ limit: 2 }));
      expect(result.services).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.hasMore).toBe(true);
    });

    it("hasMore is false when all fit", () => {
      const result = queryServiceIndex(index, query({ limit: 10 }));
      expect(result.hasMore).toBe(false);
    });
  });
});
