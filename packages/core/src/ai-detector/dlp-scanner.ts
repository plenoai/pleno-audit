/**
 * DLP Scanner
 *
 * Transformers.js を利用したブラウザ内DLPスキャナー。
 * クリップボードコピーやフォーム送信時のテキストをスキャンし、
 * PII（個人情報）が含まれている場合にアラートを生成する。
 */

import { createLogger } from "../extension-runtime/logger.js";

const logger = createLogger("dlp-scanner");

/** スキャン対象のコンテキスト */
export type ScanContext = "clipboard" | "form" | "ai_prompt";

/** 検出されたエンティティ */
export interface DLPEntity {
  entity_type: string;
  start: number;
  end: number;
  score: number;
  text: string;
}

/** スキャン結果 */
export interface DLPScanResult {
  context: ScanContext;
  domain: string;
  url?: string;
  entities: DLPEntity[];
  language: "ja" | "en";
  scannedAt: number;
}

/** DLP設定（StorageDataに保存） */
export interface DLPServerConfig {
  enabled: boolean;
  language: "ja" | "en";
  /** pipeline初期化済みか */
  modelReady: boolean;
}

export const DEFAULT_DLP_SERVER_CONFIG: DLPServerConfig = {
  enabled: false,
  language: "ja",
  modelReady: false,
};

/** テキスト長の上限（パフォーマンス保護） */
const MAX_SCAN_LENGTH = 10_000;

/** エンティティ種別の日本語ラベル */
const ENTITY_LABELS: Record<string, string> = {
  PERSON: "氏名",
  ADDRESS: "住所",
  ORGANIZATION: "組織名",
  DATE_OF_BIRTH: "生年月日",
  BANK_ACCOUNT: "銀行口座",
  PHONE_NUMBER: "電話番号",
  MY_NUMBER: "マイナンバー",
  MY_NUMBER_CORPORATE: "法人番号",
  CREDIT_CARD: "クレジットカード",
  PASSPORT: "パスポート",
  DRIVER_LICENSE: "運転免許証",
  HEALTH_INSURANCE: "健康保険証",
  RESIDENCE_CARD: "在留カード",
  POSTAL_CODE: "郵便番号",
  IP_ADDRESS: "IPアドレス",
  URL: "URL",
  EMAIL_ADDRESS: "メールアドレス",
};

export function getEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

const MODEL_ID = "0xhikae/ja-ner-onnx";

/** Transformers.js pipeline の型（動的インポートのため軽量定義） */
interface TokenClassificationResult {
  entity_group: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

type NERPipeline = (
  text: string,
  options?: { aggregation_strategy?: string },
) => Promise<TokenClassificationResult[]>;

export interface DLPScanner {
  scan: (
    text: string,
    context: ScanContext,
    domain: string,
    url?: string,
  ) => Promise<DLPScanResult | null>;
  initPipeline: (
    onProgress?: (progress: { status: string; progress?: number }) => void,
  ) => Promise<void>;
  disposePipeline: () => Promise<void>;
  updateConfig: (newConfig: Partial<DLPServerConfig>) => void;
  getConfig: () => DLPServerConfig;
}

export function createDLPScanner(initialConfig?: Partial<DLPServerConfig>): DLPScanner {
  const config: DLPServerConfig = { ...DEFAULT_DLP_SERVER_CONFIG, ...initialConfig };
  let nerPipeline: NERPipeline | null = null;

  async function initPipeline(
    onProgress?: (progress: { status: string; progress?: number }) => void,
  ): Promise<void> {
    const { pipeline, env } = await import("@huggingface/transformers");

    // Chrome拡張: CDN blocked by CSP → バンドル済みWASMを使用
    // Worker内のdynamic importも制限されるため proxy=false でメインスレッド実行
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      const wasmConfig = env.backends.onnx.wasm;
      if (wasmConfig) {
        wasmConfig.wasmPaths = chrome.runtime.getURL("/");
        wasmConfig.proxy = false;
      }
    }

    nerPipeline = (await pipeline("token-classification", MODEL_ID, {
      dtype: "fp32",
      progress_callback: onProgress,
    })) as unknown as NERPipeline;
    config.modelReady = true;
    logger.info("Transformers.js NER pipeline initialized");
  }

  async function disposePipeline(): Promise<void> {
    nerPipeline = null;
    config.modelReady = false;
  }

  async function scan(
    text: string,
    context: ScanContext,
    domain: string,
    url?: string,
  ): Promise<DLPScanResult | null> {
    if (!config.enabled || !nerPipeline) {
      return null;
    }

    const trimmed = text.length > MAX_SCAN_LENGTH
      ? text.slice(0, MAX_SCAN_LENGTH)
      : text;

    if (trimmed.trim().length === 0) {
      return null;
    }

    try {
      const results = await nerPipeline(trimmed, { aggregation_strategy: "simple" });

      const entities: DLPEntity[] = results
        .filter((r) => r.entity_group != null && r.entity_group !== "")
        .map((r) => ({
          entity_type: r.entity_group,
          start: r.start,
          end: r.end,
          score: r.score,
          text: trimmed.slice(r.start, r.end),
        }));

      if (entities.length === 0) {
        return null;
      }

      logger.info({
        event: "PII_DETECTED",
        data: {
          context,
          domain,
          entityCount: entities.length,
          entityTypes: [...new Set(entities.map(e => e.entity_type))],
        },
      });

      return {
        context,
        domain,
        url,
        entities,
        language: config.language,
        scannedAt: Date.now(),
      };
    } catch (error) {
      logger.error("scan failed", error);
      return null;
    }
  }

  function updateConfig(newConfig: Partial<DLPServerConfig>) {
    Object.assign(config, newConfig);
  }

  function getConfig(): DLPServerConfig {
    return { ...config };
  }

  return {
    scan,
    initPipeline,
    disposePipeline,
    updateConfig,
    getConfig,
  };
}
