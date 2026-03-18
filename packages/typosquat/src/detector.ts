/**
 * Typosquatting Detector
 *
 * ファクトリーパターンでdetectorインスタンスを生成。
 * NRD Detectorと同様のインターフェースを提供。
 */

import type {
  TyposquatResult,
  TyposquatConfig,
  TyposquatConfidence,
} from "./types.js";
import {
  calculateTyposquatHeuristics,
  decodePunycode,
  isPunycodeDomain,
} from "./heuristics.js";

/**
 * キャッシュインターフェース
 */
export interface TyposquatCache {
  get(domain: string): TyposquatResult | null;
  set(domain: string, result: TyposquatResult): void;
  clear(): void;
}

/**
 * スコアから信頼度を判定
 */
function determineConfidence(score: number): TyposquatConfidence {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "none";
}

/**
 * タイポスクワッティング検出器を作成
 */
export function createTyposquatDetector(
  config: TyposquatConfig,
  cache: TyposquatCache
) {
  /**
   * ドメインをチェック（同期）
   * NRD検出と異なり外部APIは不要なため同期処理
   */
  function checkDomain(domain: string): TyposquatResult {
    // 1. キャッシュ確認
    const cached = cache.get(domain);
    if (cached && Date.now() - cached.checkedAt < config.cacheExpiry) {
      return { ...cached, method: "cache" };
    }

    // 2. ヒューリスティック分析
    const heuristics = calculateTyposquatHeuristics(domain, config);

    // 3. 信頼度判定
    const confidence = determineConfidence(heuristics.totalScore);

    // 4. 結果生成
    const result: TyposquatResult = {
      domain,
      isTyposquat: heuristics.totalScore >= config.heuristicThreshold,
      confidence,
      method: "heuristic",
      heuristics,
      checkedAt: Date.now(),
      normalizedDomain: isPunycodeDomain(domain) ? decodePunycode(domain) : domain,
    };

    // 5. キャッシュ保存
    cache.set(domain, result);

    return result;
  }

  return {
    checkDomain,
  };
}
