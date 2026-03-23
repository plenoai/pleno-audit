/**
 * Network Monitor - Rate Limiter
 *
 * DNR API呼び出しのレート制限ロジック（純粋関数）
 *
 * グローバル状態に依存せず、状態を引数で受け取り新しい状態を返す。
 * これによりテスタビリティと再利用性を確保する。
 */

import {
  DNR_MAX_CALLS_PER_INTERVAL,
  DNR_MIN_INTERVAL_MS,
  DNR_QUOTA_INTERVAL_MS,
} from "./constants.js";

/**
 * DNRレート制限に必要な状態
 */
export interface DNRRateLimiterState {
  dnrQuotaWindowStart: number;
  dnrCallCount: number;
  lastDNRCallTime: number;
}

/**
 * DNR API呼び出しがレート制限内かを判定し、次の状態を返す
 *
 * 3つのガードを順に適用:
 * 1. クォータウィンドウのリセット（10分経過でカウントをリセット）
 * 2. ウィンドウ内の最大呼び出し回数チェック
 * 3. 最小呼び出し間隔チェック
 */
export function checkDNRRateLimit(
  rateLimiter: DNRRateLimiterState,
  now: number,
): { allowed: boolean; next: DNRRateLimiterState } {
  let { dnrQuotaWindowStart, dnrCallCount, lastDNRCallTime } = rateLimiter;

  // クォータウィンドウのリセット
  if (now - dnrQuotaWindowStart >= DNR_QUOTA_INTERVAL_MS) {
    dnrQuotaWindowStart = now;
    dnrCallCount = 0;
  }

  // ウィンドウ内の最大呼び出し回数超過
  if (dnrCallCount >= DNR_MAX_CALLS_PER_INTERVAL) {
    return {
      allowed: false,
      next: { dnrQuotaWindowStart, dnrCallCount, lastDNRCallTime },
    };
  }

  // 最小呼び出し間隔未満
  if (now - lastDNRCallTime < DNR_MIN_INTERVAL_MS) {
    return {
      allowed: false,
      next: { dnrQuotaWindowStart, dnrCallCount, lastDNRCallTime },
    };
  }

  // 許可: カウントと最終呼び出し時刻を更新
  return {
    allowed: true,
    next: {
      dnrQuotaWindowStart,
      dnrCallCount: dnrCallCount + 1,
      lastDNRCallTime: now,
    },
  };
}

/**
 * 指定タブ・拡張機能の通信がWebRequestで既に検出済みかを判定
 *
 * WebRequestとDNRの重複検出を防ぐために使用。
 * since以降にヒットが記録されていれば重複とみなす。
 */
export function isAlreadyCoveredByWebRequest(
  recentHits: ReadonlyMap<string, number>,
  extensionId: string,
  tabId: number,
  since: number,
): boolean {
  const key = `${extensionId}:${tabId}`;
  const lastSeen = recentHits.get(key);
  return lastSeen != null && lastSeen >= since;
}

/**
 * cutoffより古いWebRequestヒット記録を削除
 *
 * メモリリーク防止のために定期的に呼び出す。
 */
export function pruneRecentHits(
  recentHits: Map<string, number>,
  cutoff: number,
): void {
  for (const [key, timestamp] of recentHits) {
    if (timestamp < cutoff) {
      recentHits.delete(key);
    }
  }
}
