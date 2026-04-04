/**
 * DLP Scanner
 *
 * pleno-anonymizeを利用したDLPスキャナー。
 * クリップボードコピーやフォーム送信時のテキストをスキャンし、
 * PII（個人情報）が含まれている場合にアラートを生成する。
 */

import { createLogger } from "../extension-runtime/logger.js";
import { createDLPClient, type DLPClient, type DLPEntity } from "./dlp-client.js";

const logger = createLogger("dlp-scanner");

/** スキャン対象のコンテキスト */
export type ScanContext = "clipboard" | "form" | "ai_prompt";

/** スキャン結果 */
export interface DLPScanResult {
  context: ScanContext;
  domain: string;
  url?: string;
  entities: DLPEntity[];
  language: "ja" | "en";
  scannedAt: number;
}

/** DLP Server設定（StorageDataに保存） */
export interface DLPServerConfig {
  enabled: boolean;
  serverUrl: string;
  language: "ja" | "en";
  /** サーバー接続済みか（ヘルスチェック成功後にtrue） */
  serverConnected: boolean;
}

export const DEFAULT_DLP_SERVER_CONFIG: DLPServerConfig = {
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

export function createDLPScanner(initialConfig?: Partial<DLPServerConfig>) {
  const config: DLPServerConfig = { ...DEFAULT_DLP_SERVER_CONFIG, ...initialConfig };
  let client: DLPClient = createDLPClient({
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
      logger.warn("DLP server connection failed", error);
      config.serverConnected = false;
      return false;
    }
  }

  async function scan(
    text: string,
    context: ScanContext,
    domain: string,
    url?: string,
  ): Promise<DLPScanResult | null> {
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

  function updateConfig(newConfig: Partial<DLPServerConfig>) {
    const serverChanged = newConfig.serverUrl && newConfig.serverUrl !== config.serverUrl;
    Object.assign(config, newConfig);
    if (serverChanged) {
      client = createDLPClient({ serverUrl: config.serverUrl });
      config.serverConnected = false;
    }
  }

  function getConfig(): DLPServerConfig {
    return { ...config };
  }

  return {
    scan,
    verifyConnection,
    updateConfig,
    getConfig,
  };
}

export type DLPScanner = ReturnType<typeof createDLPScanner>;
