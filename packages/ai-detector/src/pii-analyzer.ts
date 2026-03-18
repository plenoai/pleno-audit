/**
 * @fileoverview AI Prompt PII Analyzer
 *
 * AIプロンプト内の個人情報・機密情報を検出し、
 * リスクスコアリングを行う。
 */

import type { CapturedAIPrompt } from "./types.js";
import {
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type SensitiveDataResult,
  type DataClassification,
} from "./dlp-rules.js";
import {
  scoreToRiskLevel5,
  type RiskLevel5,
} from "@pleno-audit/alerts";

/**
 * AIプロンプトの機密情報検出結果
 */
export interface AIPromptPIIResult {
  /** 機密情報が含まれているか */
  hasSensitiveData: boolean;
  /** 検出された分類 */
  classifications: DataClassification[];
  /** 最も高リスクな分類 */
  highestRisk: DataClassification | null;
  /** 検出件数 */
  detectionCount: number;
  /** 詳細（マスク済み） */
  details: SensitiveDataResult[];
}

/**
 * AIプロンプトのリスク評価
 */
export interface AIPromptRiskAssessment {
  /** リスクスコア (0-100) */
  riskScore: number;
  /** リスクレベル */
  riskLevel: RiskLevel5;
  /** リスク要因 */
  factors: {
    sensitiveDataPresent: boolean;
    dataTypes: DataClassification[];
    credentialsDetected: boolean;
    piiDetected: boolean;
    financialDetected: boolean;
    healthDetected: boolean;
  };
  /** アラートを発火すべきか */
  shouldAlert: boolean;
}

/**
 * AIプロンプトからテキストを抽出
 */
function extractPromptText(prompt: CapturedAIPrompt["prompt"]): string {
  const texts: string[] = [];

  // Chat Completion形式
  if (prompt.messages?.length) {
    for (const msg of prompt.messages) {
      if (msg.content) {
        texts.push(msg.content);
      }
    }
  }

  // Completion形式
  if (prompt.text) {
    texts.push(prompt.text);
  }

  // 生のリクエストボディ
  if (prompt.rawBody && texts.length === 0) {
    texts.push(prompt.rawBody);
  }

  return texts.join("\n");
}

/**
 * AIプロンプト内のPII/機密情報を検出
 */
export function analyzePromptPII(
  prompt: CapturedAIPrompt["prompt"]
): AIPromptPIIResult {
  const text = extractPromptText(prompt);

  if (!text) {
    return {
      hasSensitiveData: false,
      classifications: [],
      highestRisk: null,
      detectionCount: 0,
      details: [],
    };
  }

  const hasData = hasSensitiveData(text);
  if (!hasData) {
    return {
      hasSensitiveData: false,
      classifications: [],
      highestRisk: null,
      detectionCount: 0,
      details: [],
    };
  }

  const details = detectSensitiveData(text);
  const summary = getSensitiveDataSummary(details);
  const highestRisk = getHighestRiskClassification(details);

  // ユニークな分類を抽出
  const classifications = Object.entries(summary)
    .filter(([_, count]) => count > 0)
    .map(([classification]) => classification as DataClassification);

  return {
    hasSensitiveData: true,
    classifications,
    highestRisk,
    detectionCount: details.length,
    details,
  };
}

/**
 * リスクスコアを計算
 */
export function calculatePromptRiskScore(piiResult: AIPromptPIIResult): number {
  if (!piiResult.hasSensitiveData) {
    return 0;
  }

  // 基本スコア（機密情報が含まれている場合）
  let score = 20;

  // 分類ごとの加点
  const classificationScores: Record<DataClassification, number> = {
    credentials: 40,
    financial: 35,
    health: 30,
    pii: 25,
    internal: 20,
    code: 10,
    unknown: 5,
  };

  for (const classification of piiResult.classifications) {
    score += classificationScores[classification] || 5;
  }

  // 検出件数による加点（最大20）
  score += Math.min(piiResult.detectionCount * 5, 20);

  // 最大100に制限
  return Math.min(score, 100);
}

/**
 * AIプロンプトの完全な分析結果
 */
export interface AIPromptAnalysisResult {
  pii: AIPromptPIIResult;
  risk: AIPromptRiskAssessment;
}

/**
 * AIプロンプトを完全に分析
 */
export function analyzePrompt(
  prompt: CapturedAIPrompt["prompt"]
): AIPromptAnalysisResult {
  const pii = analyzePromptPII(prompt);
  const riskScore = calculatePromptRiskScore(pii);
  const riskLevel = scoreToRiskLevel5(riskScore);

  const factors = {
    sensitiveDataPresent: pii.hasSensitiveData,
    dataTypes: pii.classifications,
    credentialsDetected: pii.classifications.includes("credentials"),
    piiDetected: pii.classifications.includes("pii"),
    financialDetected: pii.classifications.includes("financial"),
    healthDetected: pii.classifications.includes("health"),
  };

  const shouldAlert =
    pii.hasSensitiveData && (riskLevel === "critical" || riskLevel === "high");

  return {
    pii,
    risk: {
      riskScore,
      riskLevel,
      factors,
      shouldAlert,
    },
  };
}
