import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DynamicIndex, ParquetEvent } from "./types.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

export class DynamicIndexCache {
  private cache: Map<string, DynamicIndex> = new Map();

  private getCacheKey(since: number, until: number): string {
    return `${since}-${until}`;
  }

  get(since: number, until: number): DynamicIndex | null {
    const key = this.getCacheKey(since, until);
    const cached = this.cache.get(key);

    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  set(index: DynamicIndex): void {
    const key = this.getCacheKey(
      index.period.since,
      index.period.until
    );
    this.cache.set(key, index);

    // 最大3期間分のみ保持
    if (this.cache.size > 3) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      )[0][0];
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export class DynamicIndexBuilder {
  buildIndex(
    cspViolations: (CSPViolation | Record<string, unknown>)[],
    networkRequests: (NetworkRequest | Record<string, unknown>)[],
    events: (ParquetEvent | Record<string, unknown>)[],
    since: number,
    until: number
  ): DynamicIndex {
    const tables = {
      cspViolations: new Map<string, number[]>(),
      networkRequests: new Map<string, number[]>(),
      events: new Map<string, number[]>(),
    };

    // CSP違反インデックス
    cspViolations.forEach((v, idx) => {
      const domain = (v as any).domain as string;
      if (!tables.cspViolations.has(domain)) {
        tables.cspViolations.set(domain, []);
      }
      tables.cspViolations.get(domain)!.push(idx);
    });

    // ネットワークリクエストインデックス
    networkRequests.forEach((r, idx) => {
      const domain = (r as any).domain as string;
      if (!tables.networkRequests.has(domain)) {
        tables.networkRequests.set(domain, []);
      }
      tables.networkRequests.get(domain)!.push(idx);
    });

    // イベントインデックス
    events.forEach((e, idx) => {
      const type = (e as any).type as string;
      if (!tables.events.has(type)) {
        tables.events.set(type, []);
      }
      tables.events.get(type)!.push(idx);
    });

    // 統計情報を計算
    const stats = {
      totalRecords: cspViolations.length + networkRequests.length + events.length,
      byType: {
        "csp-violations": cspViolations.length,
        "network-requests": networkRequests.length,
        events: events.length,
      },
      byDomain: {} as Record<string, number>,
    };

    // ドメイン別統計
    const domainCounts = new Map<string, number>();
    [...tables.cspViolations.keys()].forEach((domain) => {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + tables.cspViolations.get(domain)!.length);
    });
    [...tables.networkRequests.keys()].forEach((domain) => {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + tables.networkRequests.get(domain)!.length);
    });
    [...domainCounts.entries()].forEach(([domain, count]) => {
      stats.byDomain[domain] = count;
    });

    const now = Date.now();
    return {
      period: { since, until },
      tables,
      stats,
      createdAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };
  }
}
