/**
 * @fileoverview Scoring Utilities
 *
 * リスクスコアからリスクレベルへの変換を行う共通ユーティリティ
 */

/**
 * 5段階リスクレベル（PII分析用）
 *
 * critical: 80以上 - 即時対応が必要
 * high: 60以上 - 早急な対応が必要
 * medium: 40以上 - 注意が必要
 * low: 20以上 - 低リスク
 * info: 20未満 - 情報提供のみ
 */
export type RiskLevel5 = "critical" | "high" | "medium" | "low" | "info";

/**
 * 拡張機能リスクレベル（safe含む5段階）
 *
 * critical: 80以上
 * high: 60以上
 * medium: 40以上
 * low: 20以上
 * safe: 20未満
 */
export type ExtensionRiskLevel = "critical" | "high" | "medium" | "low" | "safe";

/**
 * リスクスコアのしきい値定義
 *
 * 両方のリスクレベル変換で同一のしきい値を使用することで
 * スコアリングの一貫性を保証
 */
export const RISK_SCORE_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
} as const;

/**
 * スコアを5段階リスクレベルに変換（PII分析用）
 *
 * @param score - 0-100のリスクスコア
 * @returns リスクレベル
 */
export function scoreToRiskLevel5(score: number): RiskLevel5 {
  if (score >= RISK_SCORE_THRESHOLDS.CRITICAL) return "critical";
  if (score >= RISK_SCORE_THRESHOLDS.HIGH) return "high";
  if (score >= RISK_SCORE_THRESHOLDS.MEDIUM) return "medium";
  if (score >= RISK_SCORE_THRESHOLDS.LOW) return "low";
  return "info";
}

/**
 * スコアを拡張機能リスクレベルに変換
 *
 * @param score - 0-100のリスクスコア
 * @returns 拡張機能リスクレベル
 */
export function scoreToExtensionRiskLevel(score: number): ExtensionRiskLevel {
  if (score >= RISK_SCORE_THRESHOLDS.CRITICAL) return "critical";
  if (score >= RISK_SCORE_THRESHOLDS.HIGH) return "high";
  if (score >= RISK_SCORE_THRESHOLDS.MEDIUM) return "medium";
  if (score >= RISK_SCORE_THRESHOLDS.LOW) return "low";
  return "safe";
}
