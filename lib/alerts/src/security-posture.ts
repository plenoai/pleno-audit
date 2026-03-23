/**
 * @fileoverview Security Posture Scoring
 *
 * ブラウザセキュリティポスチャーの定量評価。
 * NRD, Typosquat, CSP違反, AI利用状況を入力に
 * 0-100のスコアとリスクレベルを算出する。
 */

import { scoreToRiskLevel5, type RiskLevel5 } from "./scoring-utils.js";

/**
 * スコアリング入力
 */
export interface PostureInput {
  nrdCount: number;
  typosquatCount: number;
  cspViolationCount: number;
}

/**
 * 減点内訳
 */
export interface PosturePenalty {
  category: "nrd" | "typosquat" | "csp_violation";
  count: number;
  penalty: number;
}

/**
 * ステータスバッジ用の表示情報
 */
export type PostureStatus = "danger" | "warning" | "monitoring" | "normal";

/**
 * ポスチャー算出結果
 */
export interface SecurityPosture {
  /** 0-100 のスコア（高いほど安全） */
  score: number;
  /** 5段階リスクレベル */
  level: RiskLevel5;
  /** ステータスバッジ用（UI向け簡易分類） */
  status: PostureStatus;
  /** 各カテゴリの減点内訳 */
  breakdown: PosturePenalty[];
}

/**
 * カテゴリ別の減点重み
 *
 * - NRD: 1件あたり20pt減点（新規登録ドメインはフィッシングリスク高）
 * - Typosquat: 1件あたり30pt減点（なりすまし攻撃の直接的兆候）
 * - CSP違反: 10件ごとに5pt減点（ノイズが多いため段階的）
 */
const PENALTY_WEIGHTS = {
  nrd: 20,
  typosquat: 30,
  cspViolationPer10: 5,
} as const;

/**
 * セキュリティポスチャーを算出する
 */
export function calculateSecurityPosture(input: PostureInput): SecurityPosture {
  const penalties: PosturePenalty[] = [];

  const nrdPenalty = input.nrdCount * PENALTY_WEIGHTS.nrd;
  penalties.push({ category: "nrd", count: input.nrdCount, penalty: nrdPenalty });

  const typosquatPenalty = input.typosquatCount * PENALTY_WEIGHTS.typosquat;
  penalties.push({ category: "typosquat", count: input.typosquatCount, penalty: typosquatPenalty });

  const cspPenalty = Math.floor(input.cspViolationCount / 10) * PENALTY_WEIGHTS.cspViolationPer10;
  penalties.push({ category: "csp_violation", count: input.cspViolationCount, penalty: cspPenalty });

  const totalPenalty = nrdPenalty + typosquatPenalty + cspPenalty;
  const score = Math.max(0, 100 - totalPenalty);

  // scoreToRiskLevel5 は「高スコア = 高リスク」前提なので、反転して渡す
  const level = scoreToRiskLevel5(100 - score);

  const status = deriveStatus(input);

  return { score, level, breakdown: penalties, status };
}

/**
 * UI向けステータスを導出
 *
 * 優先順位: NRD/Typosquat検出 > CSP違反多数 > 正常
 */
function deriveStatus(input: PostureInput): PostureStatus {
  if (input.nrdCount > 0 || input.typosquatCount > 0) return "danger";
  if (input.cspViolationCount > 10) return "warning";
  return "normal";
}
