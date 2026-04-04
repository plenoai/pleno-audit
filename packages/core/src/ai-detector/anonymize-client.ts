/**
 * pleno-anonymize API Client
 *
 * ローカルで稼働するpleno-anonymizeサーバーと通信し、
 * PII検出を行うクライアント。検出のみ、匿名化は行わない。
 *
 * デフォルトでは無効。ユーザーが設定画面から有効化する。
 */

import { createLogger } from "../extension-runtime/logger.js";

const logger = createLogger("anonymize-client");

/** pleno-anonymize /api/analyze レスポンスのエンティティ */
export interface AnonymizeEntity {
  entity_type: string;
  start: number;
  end: number;
  score: number;
  text: string;
}

/** /api/analyze リクエスト */
export interface AnalyzeRequest {
  text: string;
  language: "ja" | "en";
  entities?: string[];
}

export interface AnonymizeClientConfig {
  serverUrl: string;
  timeoutMs: number;
}

const DEFAULT_CLIENT_CONFIG: AnonymizeClientConfig = {
  serverUrl: "http://localhost:8080",
  timeoutMs: 5000,
};

export function createAnonymizeClient(config: Partial<AnonymizeClientConfig> = {}) {
  const cfg: AnonymizeClientConfig = { ...DEFAULT_CLIENT_CONFIG, ...config };

  async function checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${cfg.serverUrl}/health`, {
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function checkReady(): Promise<boolean> {
    try {
      const res = await fetch(`${cfg.serverUrl}/ready`, {
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function analyze(request: AnalyzeRequest): Promise<AnonymizeEntity[]> {
    const res = await fetch(`${cfg.serverUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`anonymize analyze failed: ${res.status}`);
    }
    return res.json();
  }

  function updateConfig(newConfig: Partial<AnonymizeClientConfig>) {
    Object.assign(cfg, newConfig);
    logger.debug("client config updated", cfg);
  }

  return {
    checkHealth,
    checkReady,
    analyze,
    updateConfig,
  };
}

export type AnonymizeClient = ReturnType<typeof createAnonymizeClient>;
