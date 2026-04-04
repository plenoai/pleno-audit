/**
 * Anonymize Scanner
 *
 * pleno-anonymizeを利用したDLPスキャナー。
 * クリップボードコピーやフォーム送信時のテキストをスキャンし、
 * PII（個人情報）が含まれている場合にアラートを生成する。
 */

import { createLogger } from "../extension-runtime/logger.js";
import { createAnonymizeClient, type AnonymizeClient, type AnonymizeEntity } from "./anonymize-client.js";

const logger = createLogger("anonymize-scanner");

/** スキャン対象のコンテキスト */
export type ScanContext = "clipboard" | "form" | "ai_prompt";

/** スキャン結果 */
export interface AnonymizeScanResult {
  context: ScanContext;
  domain: string;
  url?: string;
  entities: AnonymizeEntity[];
  language: "ja" | "en";
  scannedAt: number;
}

/** DLP Anonymize設定（StorageDataに保存） */
export interface DLPAnonymizeConfig {
  enabled: boolean;
  serverUrl: string;
  language: "ja" | "en";
  /** サーバー接続済みか（ヘルスチェック成功後にtrue） */
  serverConnected: boolean;
}

export const DEFAULT_DLP_ANONYMIZE_CONFIG: DLPAnonymizeConfig = {
  enabled: false,
  serverUrl: "http://localhost:8080",
  language: "ja",
  serverConnected: false,
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

export function createAnonymizeScanner(initialConfig?: Partial<DLPAnonymizeConfig>) {
  const config: DLPAnonymizeConfig = { ...DEFAULT_DLP_ANONYMIZE_CONFIG, ...initialConfig };
  let client: AnonymizeClient = createAnonymizeClient({
    serverUrl: config.serverUrl,
  });

  async function verifyConnection(): Promise<boolean> {
    try {
      const healthy = await client.checkHealth();
      if (!healthy) {
        config.serverConnected = false;
        return false;
      }
      const ready = await client.checkReady();
      config.serverConnected = ready;
      return ready;
    } catch (error) {
      logger.warn("anonymize server connection failed", error);
      config.serverConnected = false;
      return false;
    }
  }

  async function scan(
    text: string,
    context: ScanContext,
    domain: string,
    url?: string,
  ): Promise<AnonymizeScanResult | null> {
    if (!config.enabled || !config.serverConnected) {
      return null;
    }

    const trimmed = text.length > MAX_SCAN_LENGTH
      ? text.slice(0, MAX_SCAN_LENGTH)
      : text;

    if (trimmed.trim().length === 0) {
      return null;
    }

    try {
      const entities = await client.analyze({
        text: trimmed,
        language: config.language,
      });

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

  function updateConfig(newConfig: Partial<DLPAnonymizeConfig>) {
    const serverChanged = newConfig.serverUrl && newConfig.serverUrl !== config.serverUrl;
    Object.assign(config, newConfig);
    if (serverChanged) {
      client = createAnonymizeClient({ serverUrl: config.serverUrl });
      config.serverConnected = false;
    }
  }

  function getConfig(): DLPAnonymizeConfig {
    return { ...config };
  }

  return {
    scan,
    verifyConnection,
    updateConfig,
    getConfig,
  };
}

export type AnonymizeScanner = ReturnType<typeof createAnonymizeScanner>;
