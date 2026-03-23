/**
 * @fileoverview Blocking Engine
 *
 * ローカルブロック機能を提供する。
 * ユーザー同意ベースで、デフォルト無効。
 */

import type { BlockingConfig } from "./storage-types.js";
import { DEFAULT_BLOCKING_CONFIG } from "./storage-types.js";
import { createLogger } from "./logger.js";

const logger = createLogger("blocking-engine");

// ============================================================================
// Types
// ============================================================================

/**
 * ブロック対象の種類
 */
export type BlockTarget =
  | "typosquat" // タイポスクワットドメイン
  | "nrd_login" // NRDでのログイン
  | "high_risk_extension" // 高リスク拡張機能
  | "sensitive_data_ai"; // 機密データのAI送信

/**
 * ブロック判定結果
 */
export interface BlockDecision {
  shouldBlock: boolean;
  target: BlockTarget;
  reason: string;
  domain?: string;
  details?: Record<string, unknown>;
}

/**
 * ブロックイベント
 */
export interface BlockEvent {
  id: string;
  timestamp: number;
  target: BlockTarget;
  decision: "blocked" | "warned" | "allowed";
  domain: string;
  reason: string;
  userOverride?: boolean;
}

// ============================================================================
// Blocking Engine
// ============================================================================

/**
 * ブロッキングエンジンを作成
 */
export function createBlockingEngine(
  initialConfig: BlockingConfig = DEFAULT_BLOCKING_CONFIG
) {
  let config = { ...initialConfig };
  const blockEvents: BlockEvent[] = [];
  const maxEvents = 1000;

  /**
   * 設定を更新
   */
  function updateConfig(updates: Partial<BlockingConfig>): void {
    config = { ...config, ...updates };
    logger.info("Blocking config updated", { enabled: config.enabled });
  }

  /**
   * 現在の設定を取得
   */
  function getConfig(): BlockingConfig {
    return { ...config };
  }

  /**
   * ブロック機能が有効か
   */
  function isEnabled(): boolean {
    return config.enabled && config.userConsentGiven;
  }

  /**
   * ユーザー同意を記録
   */
  function recordConsent(): void {
    config.userConsentGiven = true;
    config.consentTimestamp = Date.now();
    logger.info("User consent recorded for blocking");
  }

  /**
   * タイポスクワットをチェック
   */
  function checkTyposquat(params: {
    domain: string;
    confidence: "high" | "medium" | "low" | "none";
  }): BlockDecision {
    if (!isEnabled() || !config.blockTyposquat) {
      return {
        shouldBlock: false,
        target: "typosquat",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    if (params.confidence === "high" || params.confidence === "medium") {
      recordBlockEvent({
        target: "typosquat",
        decision: "blocked",
        domain: params.domain,
        reason: `Typosquatting detected (${params.confidence} confidence)`,
      });

      return {
        shouldBlock: true,
        target: "typosquat",
        reason: `タイポスクワット検出: ${params.domain}`,
        domain: params.domain,
        details: { confidence: params.confidence },
      };
    }

    return {
      shouldBlock: false,
      target: "typosquat",
      reason: "Low confidence, not blocked",
      domain: params.domain,
    };
  }

  /**
   * NRDでのログインをチェック
   */
  function checkNRDLogin(params: {
    domain: string;
    isNRD: boolean;
    hasLoginForm: boolean;
  }): BlockDecision {
    if (!isEnabled() || !config.blockNRDLogin) {
      return {
        shouldBlock: false,
        target: "nrd_login",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    if (params.isNRD && params.hasLoginForm) {
      recordBlockEvent({
        target: "nrd_login",
        decision: "warned",
        domain: params.domain,
        reason: "Login on NRD detected",
      });

      return {
        shouldBlock: true, // 警告として表示
        target: "nrd_login",
        reason: `新規登録ドメインでのログイン: ${params.domain}`,
        domain: params.domain,
        details: { isNRD: true, hasLoginForm: true },
      };
    }

    return {
      shouldBlock: false,
      target: "nrd_login",
      reason: "Not an NRD login",
      domain: params.domain,
    };
  }

  /**
   * 高リスク拡張機能をチェック
   */
  function checkHighRiskExtension(params: {
    extensionId: string;
    extensionName: string;
    riskScore: number;
    riskLevel: string;
  }): BlockDecision {
    if (!isEnabled() || !config.blockHighRiskExtension) {
      return {
        shouldBlock: false,
        target: "high_risk_extension",
        reason: "Blocking disabled",
        domain: `chrome-extension://${params.extensionId}`,
      };
    }

    if (params.riskLevel === "critical" || params.riskScore >= 80) {
      recordBlockEvent({
        target: "high_risk_extension",
        decision: "blocked",
        domain: `chrome-extension://${params.extensionId}`,
        reason: `High risk extension: ${params.extensionName}`,
      });

      return {
        shouldBlock: true,
        target: "high_risk_extension",
        reason: `高リスク拡張機能: ${params.extensionName}`,
        domain: `chrome-extension://${params.extensionId}`,
        details: {
          extensionId: params.extensionId,
          riskScore: params.riskScore,
          riskLevel: params.riskLevel,
        },
      };
    }

    return {
      shouldBlock: false,
      target: "high_risk_extension",
      reason: "Risk level acceptable",
      domain: `chrome-extension://${params.extensionId}`,
    };
  }

  /**
   * 機密データのAI送信をチェック
   */
  function checkSensitiveDataToAI(params: {
    domain: string;
    provider: string;
    hasCredentials: boolean;
    hasFinancial: boolean;
    hasPII: boolean;
    riskLevel: string;
  }): BlockDecision {
    if (!isEnabled() || !config.blockSensitiveDataToAI) {
      return {
        shouldBlock: false,
        target: "sensitive_data_ai",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    // 資格情報は常にブロック
    if (params.hasCredentials) {
      recordBlockEvent({
        target: "sensitive_data_ai",
        decision: "blocked",
        domain: params.domain,
        reason: "Credentials detected in AI prompt",
      });

      return {
        shouldBlock: true,
        target: "sensitive_data_ai",
        reason: "AIへの資格情報送信をブロック",
        domain: params.domain,
        details: {
          provider: params.provider,
          dataTypes: ["credentials"],
        },
      };
    }

    // 金融情報は警告
    if (params.hasFinancial) {
      recordBlockEvent({
        target: "sensitive_data_ai",
        decision: "warned",
        domain: params.domain,
        reason: "Financial data detected in AI prompt",
      });

      return {
        shouldBlock: true,
        target: "sensitive_data_ai",
        reason: "AIへの金融情報送信を警告",
        domain: params.domain,
        details: {
          provider: params.provider,
          dataTypes: ["financial"],
        },
      };
    }

    return {
      shouldBlock: false,
      target: "sensitive_data_ai",
      reason: "No sensitive data detected",
      domain: params.domain,
    };
  }

  /**
   * ブロックイベントを記録
   */
  function recordBlockEvent(event: Omit<BlockEvent, "id" | "timestamp">): void {
    const blockEvent: BlockEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    blockEvents.unshift(blockEvent);

    // 最大件数を超えたら古いイベントを削除
    if (blockEvents.length > maxEvents) {
      blockEvents.splice(maxEvents);
    }

    logger.info("Block event recorded", {
      target: event.target,
      decision: event.decision,
      domain: event.domain,
    });
  }

  /**
   * ブロックイベント一覧を取得
   */
  function getBlockEvents(options?: {
    limit?: number;
    target?: BlockTarget;
  }): BlockEvent[] {
    let result = [...blockEvents];

    if (options?.target) {
      result = result.filter((e) => e.target === options.target);
    }

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * 統計情報を取得
   */
  function getStats(): {
    totalBlocked: number;
    totalWarned: number;
    totalAllowed: number;
    byTarget: Record<BlockTarget, number>;
  } {
    const stats = {
      totalBlocked: 0,
      totalWarned: 0,
      totalAllowed: 0,
      byTarget: {
        typosquat: 0,
        nrd_login: 0,
        high_risk_extension: 0,
        sensitive_data_ai: 0,
      } as Record<BlockTarget, number>,
    };

    for (const event of blockEvents) {
      if (event.decision === "blocked") stats.totalBlocked++;
      else if (event.decision === "warned") stats.totalWarned++;
      else stats.totalAllowed++;

      stats.byTarget[event.target]++;
    }

    return stats;
  }

  /**
   * イベントをクリア
   */
  function clearEvents(): void {
    blockEvents.length = 0;
  }

  return {
    updateConfig,
    getConfig,
    isEnabled,
    recordConsent,
    checkTyposquat,
    checkNRDLogin,
    checkHighRiskExtension,
    checkSensitiveDataToAI,
    getBlockEvents,
    getStats,
    clearEvents,
  };
}

export type BlockingEngine = ReturnType<typeof createBlockingEngine>;
