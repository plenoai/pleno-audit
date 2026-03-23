/**
 * 不審な通信パターン検出
 *
 * 拡張機能の通信パターンをヒューリスティックに分析し、以下の不審な挙動を検出:
 * 1. 大量リクエスト検出
 * 2. 時間帯分析（深夜時間帯）
 * 3. エンコードパラメータ検出
 * 4. 通信先の多様性分析（DGA可能性）
 */

import type { ExtensionRequestRecord } from "./storage-types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("suspicious-pattern-detector");

export interface SuspiciousPattern {
  type: "bulk_requests" | "late_night_activity" | "encoded_params" | "domain_diversity";
  severity: "critical" | "high" | "medium" | "low";
  extensionId: string;
  extensionName: string;
  timestamp: number;
  description: string;
  details: Record<string, unknown>;
}

export interface SuspiciousPatternConfig {
  // 大量リクエスト検出: 1分間のリクエスト数閾値
  bulkRequestThreshold: number;
  // 大量リクエスト検出: チェック対象時間窓（ミリ秒）
  bulkRequestWindow: number;
  // 時間帯分析: 深夜時間帯の開始時刻（時）
  lateNightStart: number;
  // 時間帯分析: 深夜時間帯の終了時刻（時）
  lateNightEnd: number;
  // エンコードパラメータ検出: base64パラメータの最小長
  base64MinLength: number;
  // 通信先の多様性: チェック対象時間窓内のドメイン数閾値
  domainDiversityThreshold: number;
  // 通信先の多様性: チェック対象時間窓（ミリ秒）
  domainDiversityWindow: number;
  // 異常に長いURLパラメータの閾値（文字数）
  longParameterThreshold: number;
}

export const DEFAULT_SUSPICIOUS_PATTERN_CONFIG: SuspiciousPatternConfig = {
  bulkRequestThreshold: 50, // 1分間に50リクエスト以上
  bulkRequestWindow: 60 * 1000, // 1分
  lateNightStart: 2, // 2:00
  lateNightEnd: 5, // 5:00
  base64MinLength: 20, // 20文字以上のbase64
  domainDiversityThreshold: 10, // 短期間に10以上の異なるドメイン
  domainDiversityWindow: 10 * 60 * 1000, // 10分
  longParameterThreshold: 500, // 500文字以上のパラメータ
};

/**
 * Base64エンコードされた文字列であるかをヒューリスティックに判定
 * （完全な判定ではなく、可能性をチェック）
 */
function isLikelyBase64(str: string): boolean {
  if (str.length < 8) return false;
  // Base64は英数字、+, /, = のみを含む
  return /^[A-Za-z0-9+/]+={0,2}$/.test(str) && str.length % 4 === 0;
}

/**
 * URLからクエリパラメータを抽出
 */
function extractQueryParams(url: string): Map<string, string> {
  const params = new Map<string, string>();
  try {
    const urlObj = new URL(url);
    for (const [key, value] of urlObj.searchParams) {
      params.set(key, value);
    }
  } catch {
    // 意図的なサイレント無視: 不正なURLはスキップ
    logger.debug("Invalid URL skipped in extractQueryParams:", url);
  }
  return params;
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    // 意図的なサイレント無視: 不正なURLはnullを返す
    logger.debug("Invalid URL skipped in extractDomain:", url);
    return null;
  }
}

/**
 * 1. 大量リクエスト検出
 * 短時間での異常な数のリクエスト（データ収集の兆候）
 */
export function detectBulkRequests(
  records: ExtensionRequestRecord[],
  config: SuspiciousPatternConfig
): SuspiciousPattern[] {
  const patterns: SuspiciousPattern[] = [];
  const extMap = new Map<string, { name: string; records: ExtensionRequestRecord[] }>();

  // 拡張機能ごとにレコードをグループ化
  for (const record of records) {
    if (!extMap.has(record.extensionId)) {
      extMap.set(record.extensionId, {
        name: record.extensionName,
        records: [],
      });
    }
    extMap.get(record.extensionId)!.records.push(record);
  }

  // 各拡張機能について大量リクエストをチェック
  for (const [extId, { name, records: extRecords }] of extMap) {
    // 時間順でソート
    const sorted = [...extRecords].sort((a, b) => a.timestamp - b.timestamp);

    // ツーポインタ方式でスライディングウィンドウ分析（O(n)）
    let left = 0;
    let maxCount = 0;
    let maxCountStart = 0;

    for (let right = 0; right < sorted.length; right++) {
      // ウィンドウを超えた古いレコードを除外
      while (sorted[right].timestamp - sorted[left].timestamp >= config.bulkRequestWindow) {
        left++;
      }
      const count = right - left + 1;
      if (count > maxCount) {
        maxCount = count;
        maxCountStart = sorted[left].timestamp;
      }
    }

    // 閾値を超えた場合はパターンを記録
    if (maxCount >= config.bulkRequestThreshold) {
      patterns.push({
        type: "bulk_requests",
        severity: maxCount > config.bulkRequestThreshold * 2 ? "critical" : "high",
        extensionId: extId,
        extensionName: name,
        timestamp: maxCountStart,
        description: `${maxCount}件のリクエストが${config.bulkRequestWindow / 1000}秒以内に検出されました`,
        details: {
          requestCount: maxCount,
          timeWindow: config.bulkRequestWindow,
          startTime: new Date(maxCountStart).toISOString(),
        },
      });
    }
  }

  return patterns;
}

/**
 * 2. 時間帯分析
 * 深夜時間帯（例: 2:00-5:00）の通信を検出
 */
export function detectLateNightActivity(
  records: ExtensionRequestRecord[],
  config: SuspiciousPatternConfig
): SuspiciousPattern[] {
  const patterns: SuspiciousPattern[] = [];
  const extMap = new Map<string, { name: string; count: number; latestTime: number }>();

  for (const record of records) {
    const hour = new Date(record.timestamp).getHours();
    // 深夜時間帯は lateNightStart から lateNightEnd の範囲（例: 2:00-5:00）
    const isLateNight =
      config.lateNightStart <= hour && hour < config.lateNightEnd;

    if (!isLateNight) continue;

    if (!extMap.has(record.extensionId)) {
      extMap.set(record.extensionId, {
        name: record.extensionName,
        count: 0,
        latestTime: 0,
      });
    }

    const entry = extMap.get(record.extensionId)!;
    entry.count++;
    entry.latestTime = Math.max(entry.latestTime, record.timestamp);
  }

  // 深夜に複数回通信している拡張機能を検出
  for (const [extId, { name, count, latestTime }] of extMap) {
    if (count >= 3) {
      // 3回以上の深夜通信
      patterns.push({
        type: "late_night_activity",
        severity: count >= 10 ? "high" : "medium",
        extensionId: extId,
        extensionName: name,
        timestamp: latestTime,
        description: `${config.lateNightStart}:00-${config.lateNightEnd}:00の間に${count}件の通信が検出されました`,
        details: {
          requestCount: count,
          lateNightWindow: `${config.lateNightStart}:00-${config.lateNightEnd}:00`,
          latestActivityTime: new Date(latestTime).toISOString(),
        },
      });
    }
  }

  return patterns;
}

/**
 * 3. エンコードパラメータ検出
 * base64エンコードされたクエリパラメータ、異常に長いURLパラメータを検出
 */
export function detectEncodedParameters(
  records: ExtensionRequestRecord[],
  config: SuspiciousPatternConfig
): SuspiciousPattern[] {
  const patterns: SuspiciousPattern[] = [];
  const detectedExts = new Set<string>();

  for (const record of records) {
    // 既に検出済みの拡張機能はスキップ
    if (detectedExts.has(record.extensionId)) continue;

    const params = extractQueryParams(record.url);

    for (const [key, value] of params) {
      // Base64パラメータを検出
      if (isLikelyBase64(value) && value.length >= config.base64MinLength) {
        patterns.push({
          type: "encoded_params",
          severity: "high",
          extensionId: record.extensionId,
          extensionName: record.extensionName,
          timestamp: record.timestamp,
          description: `Base64エンコードされたクエリパラメータが検出されました（キー: ${key}）`,
          details: {
            parameterKey: key,
            parameterLength: value.length,
            detectedInUrl: record.url.substring(0, 100),
          },
        });
        detectedExts.add(record.extensionId);
        break;
      }

      // 異常に長いパラメータを検出
      if (value.length > config.longParameterThreshold) {
        patterns.push({
          type: "encoded_params",
          severity: "medium",
          extensionId: record.extensionId,
          extensionName: record.extensionName,
          timestamp: record.timestamp,
          description: `異常に長いクエリパラメータが検出されました（${value.length}文字）`,
          details: {
            parameterKey: key,
            parameterLength: value.length,
            threshold: config.longParameterThreshold,
          },
        });
        detectedExts.add(record.extensionId);
        break;
      }
    }
  }

  return patterns;
}

/**
 * 4. 通信先の多様性
 * 短期間で多数の異なるドメインへ通信する拡張機能を検出（DGA可能性）
 */
export function detectDomainDiversity(
  records: ExtensionRequestRecord[],
  config: SuspiciousPatternConfig
): SuspiciousPattern[] {
  const patterns: SuspiciousPattern[] = [];
  const extMap = new Map<string, { name: string; records: ExtensionRequestRecord[] }>();

  // 拡張機能ごとにレコードをグループ化
  for (const record of records) {
    if (!extMap.has(record.extensionId)) {
      extMap.set(record.extensionId, {
        name: record.extensionName,
        records: [],
      });
    }
    extMap.get(record.extensionId)!.records.push(record);
  }

  // 各拡張機能について多様性をチェック
  for (const [extId, { name, records: extRecords }] of extMap) {
    if (extRecords.length < 2) continue;

    // 時間順でソート
    const sorted = [...extRecords].sort((a, b) => a.timestamp - b.timestamp);

    // ツーポインタ方式でスライディングウィンドウ分析（O(n)）
    let left = 0;
    const domainAtIndex = sorted.map((r) => extractDomain(r.url));
    const domainCount = new Map<string, number>();
    let maxDomainCount = 0;
    let maxDomainStart = 0;
    let maxDomains: Set<string> = new Set();

    for (let right = 0; right < sorted.length; right++) {
      // 右側のドメインを追加
      const rightDomain = domainAtIndex[right];
      if (rightDomain) {
        domainCount.set(rightDomain, (domainCount.get(rightDomain) || 0) + 1);
      }

      // ウィンドウを超えた古いレコードを除外
      while (sorted[right].timestamp - sorted[left].timestamp >= config.domainDiversityWindow) {
        const leftDomain = domainAtIndex[left];
        if (leftDomain) {
          const count = domainCount.get(leftDomain) || 0;
          if (count <= 1) {
            domainCount.delete(leftDomain);
          } else {
            domainCount.set(leftDomain, count - 1);
          }
        }
        left++;
      }

      // 最大ドメイン数を更新
      if (domainCount.size > maxDomainCount) {
        maxDomainCount = domainCount.size;
        maxDomainStart = sorted[left].timestamp;
        maxDomains = new Set(domainCount.keys());
      }
    }

    // 閾値を超えた場合はパターンを記録
    if (maxDomainCount >= config.domainDiversityThreshold) {
      patterns.push({
        type: "domain_diversity",
        severity: "high",
        extensionId: extId,
        extensionName: name,
        timestamp: maxDomainStart,
        description: `${maxDomainCount}個の異なるドメインへのアクセスが${config.domainDiversityWindow / 1000 / 60}分以内に検出されました（DGA可能性）`,
        details: {
          uniqueDomainCount: maxDomainCount,
          threshold: config.domainDiversityThreshold,
          timeWindow: config.domainDiversityWindow,
          sampleDomains: Array.from(maxDomains).slice(0, 5),
        },
      });
    }
  }

  return patterns;
}

/**
 * 全ての不審なパターンを検出
 */
export function detectAllSuspiciousPatterns(
  records: ExtensionRequestRecord[],
  config: SuspiciousPatternConfig
): SuspiciousPattern[] {
  const allPatterns: SuspiciousPattern[] = [];

  for (const p of detectBulkRequests(records, config)) allPatterns.push(p);
  for (const p of detectLateNightActivity(records, config)) allPatterns.push(p);
  for (const p of detectEncodedParameters(records, config)) allPatterns.push(p);
  for (const p of detectDomainDiversity(records, config)) allPatterns.push(p);

  // タイムスタンプでソート
  allPatterns.sort((a, b) => b.timestamp - a.timestamp);

  logger.info(`Detected ${allPatterns.length} suspicious patterns`);

  return allPatterns;
}
