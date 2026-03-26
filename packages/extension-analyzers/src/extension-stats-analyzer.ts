/**
 * 拡張機能通信統計分析
 *
 * ネットワークリクエストを統計化し、ダッシュボード表示用データを生成
 * - 拡張機能ごとのリクエスト集計
 * - 時系列データ（日次/週次）
 * - 通信先ドメイン分析
 * - detectedBy別の内訳
 */

import type { ExtensionRequestRecord } from "@libztbs/types";
import { createLogger } from "@libztbs/extension-runtime/logger";

const logger = createLogger("extension-stats-analyzer");

/**
 * 単一拡張機能の統計情報
 */
export interface ExtensionStats {
  extensionId: string;
  extensionName: string;
  totalRequests: number;
  requestsPerDay: number; // 平均日次リクエスト数
  topDomains: Array<{
    domain: string;
    count: number;
    percentage: number;
  }>;
  detectionBreakdown: {
    webRequest: number;
    declarativeNetRequest: number;
  };
  lastActivityTime: number; // 最後の通信時刻
  resourceTypes: Record<string, number>; // リソースタイプ別集計
}

/**
 * 時系列統計データ（日次/週次）
 */
export interface TimeSeriesData {
  timestamp: number; // 集計対象の日/週の開始時刻
  period: "daily" | "weekly"; // 日次/週次
  extensionId: string;
  requestCount: number;
  uniqueDomains: number;
  dominantResourceType: string; // 最も多いリソースタイプ
}

/**
 * ダッシュボード用の集計統計
 */
export interface DashboardStats {
  totalExtensions: number;
  totalRequests: number;
  dateRange: {
    start: number;
    end: number;
  };
  extensionStats: ExtensionStats[];
  topDomains: Array<{
    domain: string;
    count: number;
    extensionIds: string[];
  }>;
  timeSeriesDaily: TimeSeriesData[];
  timeSeriesWeekly: TimeSeriesData[];
}

/**
 * 日次の開始時刻を取得（00:00:00 UTC）
 */
function getDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * 週次の開始時刻を取得（月曜 00:00:00 UTC）
 */
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // 月曜を週の開始に
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * 拡張機能ごとの統計情報を生成
 */
export function generateExtensionStats(records: ExtensionRequestRecord[]): ExtensionStats[] {
  const extMap = new Map<string, ExtensionRequestRecord[]>();

  // 拡張機能ごとにレコードをグループ化
  for (const record of records) {
    if (!extMap.has(record.extensionId)) {
      extMap.set(record.extensionId, []);
    }
    extMap.get(record.extensionId)!.push(record);
  }

  const stats: ExtensionStats[] = [];

  for (const [extId, extRecords] of extMap) {
    if (extRecords.length === 0) continue;

    // 基本統計（reduce使用でスタックオーバーフロー回避）
    const totalRequests = extRecords.length;
    let minTime = extRecords[0].timestamp;
    let maxTime = extRecords[0].timestamp;
    for (const record of extRecords) {
      if (record.timestamp < minTime) minTime = record.timestamp;
      if (record.timestamp > maxTime) maxTime = record.timestamp;
    }
    const daysSpan = Math.max(1, (maxTime - minTime) / (1000 * 60 * 60 * 24));
    const requestsPerDay = totalRequests / daysSpan;

    // ドメイン集計
    const domainCount = new Map<string, number>();
    for (const record of extRecords) {
      const domain = extractDomain(record.url);
      if (domain) {
        domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
      }
    }

    // TOP ドメイン（最大10個）
    const topDomains = Array.from(domainCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: (count / totalRequests) * 100,
      }));

    // detectedBy別の内訳
    const detectionBreakdown = {
      webRequest: 0,
      declarativeNetRequest: 0,
    };
    for (const record of extRecords) {
      if (record.detectedBy === "declarativeNetRequest") {
        detectionBreakdown.declarativeNetRequest++;
      } else {
        detectionBreakdown.webRequest++;
      }
    }

    // リソースタイプ別集計
    const resourceTypes: Record<string, number> = {};
    for (const record of extRecords) {
      resourceTypes[record.resourceType] = (resourceTypes[record.resourceType] || 0) + 1;
    }

    stats.push({
      extensionId: extId,
      extensionName: extRecords[0].extensionName,
      totalRequests,
      requestsPerDay,
      topDomains,
      detectionBreakdown,
      lastActivityTime: maxTime,
      resourceTypes,
    });
  }

  // requestsPerDayでソート（降順）
  stats.sort((a, b) => b.requestsPerDay - a.requestsPerDay);

  return stats;
}

/**
 * 日次時系列データを生成（O(n)アルゴリズム）
 */
export function generateDailyTimeSeries(
  records: ExtensionRequestRecord[]
): TimeSeriesData[] {
  // 集計用の補助データ構造
  const aggregationMap = new Map<
    string,
    {
      data: TimeSeriesData;
      domains: Set<string>;
      resourceTypeCounts: Map<string, number>;
    }
  >();

  // 1回のループで全データを集計
  for (const record of records) {
    const dayStart = getDayStart(record.timestamp);
    const key = `${dayStart}:${record.extensionId}`;

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        data: {
          timestamp: dayStart,
          period: "daily",
          extensionId: record.extensionId,
          requestCount: 0,
          uniqueDomains: 0,
          dominantResourceType: "",
        },
        domains: new Set(),
        resourceTypeCounts: new Map(),
      });
    }

    const agg = aggregationMap.get(key)!;
    agg.data.requestCount++;

    const domain = extractDomain(record.url);
    if (domain) agg.domains.add(domain);

    agg.resourceTypeCounts.set(
      record.resourceType,
      (agg.resourceTypeCounts.get(record.resourceType) || 0) + 1
    );
  }

  // 最終データを構築
  const result: TimeSeriesData[] = [];
  for (const { data, domains, resourceTypeCounts } of aggregationMap.values()) {
    data.uniqueDomains = domains.size;

    // 支配的なリソースタイプ
    let maxCount = 0;
    for (const [resourceType, count] of resourceTypeCounts) {
      if (count > maxCount) {
        maxCount = count;
        data.dominantResourceType = resourceType;
      }
    }

    result.push(data);
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

/**
 * 週次時系列データを生成（O(n)アルゴリズム）
 */
export function generateWeeklyTimeSeries(
  records: ExtensionRequestRecord[]
): TimeSeriesData[] {
  // 集計用の補助データ構造
  const aggregationMap = new Map<
    string,
    {
      data: TimeSeriesData;
      domains: Set<string>;
      resourceTypeCounts: Map<string, number>;
    }
  >();

  // 1回のループで全データを集計
  for (const record of records) {
    const weekStart = getWeekStart(record.timestamp);
    const key = `${weekStart}:${record.extensionId}`;

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        data: {
          timestamp: weekStart,
          period: "weekly",
          extensionId: record.extensionId,
          requestCount: 0,
          uniqueDomains: 0,
          dominantResourceType: "",
        },
        domains: new Set(),
        resourceTypeCounts: new Map(),
      });
    }

    const agg = aggregationMap.get(key)!;
    agg.data.requestCount++;

    const domain = extractDomain(record.url);
    if (domain) agg.domains.add(domain);

    agg.resourceTypeCounts.set(
      record.resourceType,
      (agg.resourceTypeCounts.get(record.resourceType) || 0) + 1
    );
  }

  // 最終データを構築
  const result: TimeSeriesData[] = [];
  for (const { data, domains, resourceTypeCounts } of aggregationMap.values()) {
    data.uniqueDomains = domains.size;

    // 支配的なリソースタイプ
    let maxCount = 0;
    for (const [resourceType, count] of resourceTypeCounts) {
      if (count > maxCount) {
        maxCount = count;
        data.dominantResourceType = resourceType;
      }
    }

    result.push(data);
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

/**
 * ダッシュボード用の集計統計を生成
 */
export function generateDashboardStats(
  records: ExtensionRequestRecord[]
): DashboardStats {
  if (records.length === 0) {
    return {
      totalExtensions: 0,
      totalRequests: 0,
      dateRange: { start: 0, end: 0 },
      extensionStats: [],
      topDomains: [],
      timeSeriesDaily: [],
      timeSeriesWeekly: [],
    };
  }

  const extensionStats = generateExtensionStats(records);
  const timeSeriesDaily = generateDailyTimeSeries(records);
  const timeSeriesWeekly = generateWeeklyTimeSeries(records);

  // グローバルのトップドメイン
  const globalDomainCount = new Map<string, Set<string>>();
  for (const record of records) {
    const domain = extractDomain(record.url);
    if (domain) {
      if (!globalDomainCount.has(domain)) {
        globalDomainCount.set(domain, new Set());
      }
      globalDomainCount.get(domain)!.add(record.extensionId);
    }
  }

  const topDomains = Array.from(globalDomainCount.entries())
    .map(([domain, extIds]) => ({
      domain,
      count: Array.from(extIds).reduce((sum, extId) => {
        return (
          sum +
          records.filter((r) => extractDomain(r.url) === domain && r.extensionId === extId)
            .length
        );
      }, 0),
      extensionIds: Array.from(extIds),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // TOP 20

  // 日付範囲（Math.min/max(...array)はV8引数上限で溢れるためループで算出）
  let minTimestamp = records[0].timestamp;
  let maxTimestamp = records[0].timestamp;
  for (const record of records) {
    if (record.timestamp < minTimestamp) minTimestamp = record.timestamp;
    if (record.timestamp > maxTimestamp) maxTimestamp = record.timestamp;
  }
  const dateRange = {
    start: minTimestamp,
    end: maxTimestamp,
  };

  return {
    totalExtensions: extensionStats.length,
    totalRequests: records.length,
    dateRange,
    extensionStats,
    topDomains,
    timeSeriesDaily,
    timeSeriesWeekly,
  };
}

/**
 * 拡張機能の統計情報を取得（キャッシュ機能付き）
 */
export class ExtensionStatsCache {
  private cache: Map<string, DashboardStats> = new Map();
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 5 * 60 * 1000; // 5分

  /**
   * キャッシュから統計を取得または生成
   */
  getStats(records: ExtensionRequestRecord[]): DashboardStats {
    const now = Date.now();
    const cacheKey = `stats_${records.length}_${records[records.length - 1]?.timestamp || 0}`;

    // キャッシュが有効か確認
    if (
      this.cache.has(cacheKey) &&
      now - this.cacheTimestamp < this.cacheTTL &&
      this.cache.size < 100
    ) {
      logger.debug("Using cached dashboard stats");
      return this.cache.get(cacheKey)!;
    }

    // キャッシュが無効な場合は再生成
    const stats = generateDashboardStats(records);
    this.cache.set(cacheKey, stats);
    this.cacheTimestamp = now;

    // キャッシュサイズ制限（100エントリまで）
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }

    logger.debug("Generated new dashboard stats");
    return stats;
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }
}

// グローバルキャッシュインスタンス
export const globalExtensionStatsCache = new ExtensionStatsCache();
