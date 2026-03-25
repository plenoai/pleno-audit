/**
 * @fileoverview Service Explorer
 *
 * サービスのフィルタリング・ソート・インデックス構築を行う。
 * UIに依存しない純粋なデータ操作ロジック。
 */

import type { SortType, UnifiedService } from "@libztbs/types";

export type FilterCategory = "nrd" | "typosquat" | "ai" | "login" | "extension";

const FILTER_TAGS: FilterCategory[] = [
  "nrd",
  "typosquat",
  "ai",
  "login",
  "extension",
];

interface ServiceIndexEntry {
  service: UnifiedService;
  name: string;
  normalizedName: string;
  connectionCount: number;
  tagSet: Set<FilterCategory>;
}

export interface ServiceIndex {
  entries: ServiceIndexEntry[];
  counts: Record<FilterCategory, number>;
}

export interface ServiceQuery {
  sortType: SortType;
  searchQuery: string;
  activeFilters: Set<FilterCategory>;
  limit: number;
}

export interface ServiceQueryResult {
  services: UnifiedService[];
  total: number;
  hasMore: boolean;
}

function getServiceName(service: UnifiedService): string {
  return service.source.type === "domain"
    ? service.source.domain
    : service.source.extensionName;
}

function getConnectionCount(service: UnifiedService): number {
  return service.connections.reduce((sum, conn) => sum + conn.requestCount, 0);
}

function getTagSet(service: UnifiedService): Set<FilterCategory> {
  const tagSet = new Set<FilterCategory>();
  if (service.source.type === "extension") {
    tagSet.add("extension");
  } else {
    const s = service.source.service;
    if (s.nrdResult?.isNRD) tagSet.add("nrd");
    if (s.typosquatResult?.isTyposquat) tagSet.add("typosquat");
    if (s.aiDetected?.hasAIActivity) tagSet.add("ai");
    if (s.hasLoginPage) tagSet.add("login");
  }
  return tagSet;
}

function sortEntries(entries: ServiceIndexEntry[], sortType: SortType): ServiceIndexEntry[] {
  const result = [...entries];
  result.sort((a, b) => {
    switch (sortType) {
      case "activity":
        return b.service.lastActivity - a.service.lastActivity;
      case "connections":
        if (b.connectionCount !== a.connectionCount) {
          return b.connectionCount - a.connectionCount;
        }
        return b.service.lastActivity - a.service.lastActivity;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
  return result;
}

export function buildServiceIndex(services: UnifiedService[]): ServiceIndex {
  const entries = services.map((service) => {
    const name = getServiceName(service);
    return {
      service,
      name,
      normalizedName: name.toLowerCase(),
      connectionCount: getConnectionCount(service),
      tagSet: getTagSet(service),
    };
  });

  const counts = FILTER_TAGS.reduce(
    (acc, category) => {
      acc[category] = 0;
      return acc;
    },
    {} as Record<FilterCategory, number>,
  );

  for (const entry of entries) {
    for (const category of FILTER_TAGS) {
      if (entry.tagSet.has(category)) {
        counts[category] += 1;
      }
    }
  }

  return { entries, counts };
}

export function queryServiceIndex(
  index: ServiceIndex,
  query: ServiceQuery,
): ServiceQueryResult {
  const normalizedQuery = query.searchQuery.trim().toLowerCase();
  let entries = index.entries;

  if (normalizedQuery) {
    entries = entries.filter((entry) =>
      entry.normalizedName.includes(normalizedQuery),
    );
  }

  if (query.activeFilters.size > 0) {
    entries = entries.filter((entry) => {
      for (const filter of query.activeFilters) {
        if (entry.tagSet.has(filter)) return true;
      }
      return false;
    });
  }

  const sorted = sortEntries(entries, query.sortType);
  const total = sorted.length;
  const limit = Math.max(query.limit, 0);
  const limited = limit > 0 ? sorted.slice(0, limit) : sorted;

  return {
    services: limited.map((entry) => entry.service),
    total,
    hasMore: total > limit,
  };
}
