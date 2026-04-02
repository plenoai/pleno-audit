/**
 * @fileoverview CSP Statistics
 *
 * CSP違反データからの統計集約ロジック。
 */

import type { CSPViolation } from "./types.js";

export interface StatEntry {
  label: string;
  value: number;
}

export interface DomainViolationMeta {
  count: number;
  lastSeen: number;
}

/**
 * CSP違反からディレクティブの一意リストを抽出
 */
export function extractDirectives(violations: CSPViolation[]): string[] {
  return Array.from(new Set(violations.map((v) => v.directive))).sort();
}

/**
 * ディレクティブ別の違反統計を集計
 */
export function computeDirectiveStats(violations: CSPViolation[]): StatEntry[] {
  const stats: Record<string, number> = {};
  for (const v of violations) {
    const key = v.directive || "unknown";
    stats[key] = (stats[key] ?? 0) + 1;
  }
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

/**
 * ドメイン別の違反統計を集計
 */
export function computeDomainViolationStats(violations: CSPViolation[]): {
  domainStats: StatEntry[];
  domainViolationMeta: Record<string, DomainViolationMeta>;
} {
  const stats: Record<string, DomainViolationMeta> = {};
  for (const v of violations) {
    try {
      const domain = new URL(v.blockedURL).hostname;
      const ts = new Date(v.timestamp).getTime();
      const existing = stats[domain];
      if (existing) {
        existing.count++;
        if (ts > existing.lastSeen) existing.lastSeen = ts;
      } else {
        stats[domain] = { count: 1, lastSeen: ts };
      }
    } catch {
      // invalid URL
    }
  }
  const domainStats = Object.entries(stats)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, { count }]) => ({ label, value: count }));
  return { domainStats, domainViolationMeta: stats };
}
