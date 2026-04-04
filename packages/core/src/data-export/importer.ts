/**
 * @fileoverview Data Importer
 *
 * exportの逆操作としてJSONデータをインポートする。
 * バリデーション付きでデータの整合性を保証する。
 */

import type { DetectedService } from "../types/index.js";

/**
 * エクスポートされたデータの形式
 */
export interface ExportedData {
  services: DetectedService[];
  serviceConnections?: Record<string, string[]>;
  extensionConnections?: Record<string, string[]>;
  exportedAt?: string;
  version?: string;
}

/**
 * インポート結果
 */
export interface ImportResult {
  success: boolean;
  importedAt: number;
  counts: {
    services: number;
    serviceConnections: number;
    extensionConnections: number;
  };
  error?: string;
}

/**
 * バリデーション結果
 */
export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  data?: ExportedData;
}

/**
 * JSONファイルの内容をパースしバリデーションする
 */
export function validateImportData(content: string): ImportValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { valid: false, errors: ["JSONの解析に失敗しました"] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ["ルートはオブジェクトである必要があります"] };
  }

  const obj = parsed as Record<string, unknown>;

  // services は必須
  if (!Array.isArray(obj.services)) {
    return { valid: false, errors: ["services配列が見つかりません"] };
  }

  // 各serviceのバリデーション
  const services: DetectedService[] = [];
  for (let i = 0; i < obj.services.length; i++) {
    const s = obj.services[i] as Record<string, unknown>;
    if (typeof s !== "object" || s === null) {
      errors.push(`services[${i}]: オブジェクトではありません`);
      continue;
    }
    if (typeof s.domain !== "string" || s.domain.length === 0) {
      errors.push(`services[${i}]: domainが無効です`);
      continue;
    }
    // detectedAtが文字列（ISO形式）の場合は数値に変換
    if (typeof s.detectedAt === "string") {
      s.detectedAt = new Date(s.detectedAt as string).getTime();
    }
    if (typeof s.detectedAt !== "number" || Number.isNaN(s.detectedAt)) {
      s.detectedAt = Date.now();
    }
    // cookiesが存在しない場合はデフォルト
    if (!Array.isArray(s.cookies)) {
      s.cookies = [];
    }
    services.push(s as unknown as DetectedService);
  }

  if (services.length === 0 && errors.length > 0) {
    return { valid: false, errors };
  }

  // serviceConnections のバリデーション（オプショナル）
  let serviceConnections: Record<string, string[]> | undefined;
  if (obj.serviceConnections != null) {
    if (typeof obj.serviceConnections === "object" && !Array.isArray(obj.serviceConnections)) {
      serviceConnections = obj.serviceConnections as Record<string, string[]>;
    } else {
      errors.push("serviceConnectionsの形式が無効です（無視します）");
    }
  }

  // extensionConnections のバリデーション（オプショナル）
  let extensionConnections: Record<string, string[]> | undefined;
  if (obj.extensionConnections != null) {
    if (typeof obj.extensionConnections === "object" && !Array.isArray(obj.extensionConnections)) {
      extensionConnections = obj.extensionConnections as Record<string, string[]>;
    } else {
      errors.push("extensionConnectionsの形式が無効です（無視します）");
    }
  }

  // reportsフィールドの存在は許容（CSP reportsはインメモリなのでimportしない）

  return {
    valid: true,
    errors,
    data: {
      services,
      serviceConnections,
      extensionConnections,
      exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined,
      version: typeof obj.version === "string" ? obj.version : undefined,
    },
  };
}

/**
 * インポートデータをchrome.storage.local用の形式に変換する
 *
 * 既存データとマージする。同一ドメインは新しいデータで上書き。
 */
export function mergeServices(
  existing: Record<string, DetectedService>,
  imported: DetectedService[],
): Record<string, DetectedService> {
  const merged = { ...existing };
  for (const service of imported) {
    const domain = service.domain;
    const current = merged[domain];
    if (current) {
      // 既存データとマージ — importedを優先しつつ、既存の検出情報を保持
      merged[domain] = {
        ...current,
        ...service,
        cookies: deduplicateCookies(current.cookies, service.cookies),
        sensitiveDataDetected: mergeStringArrays(
          current.sensitiveDataDetected,
          service.sensitiveDataDetected,
        ),
      };
    } else {
      merged[domain] = service;
    }
  }
  return merged;
}

function deduplicateCookies(
  a: DetectedService["cookies"],
  b: DetectedService["cookies"],
): DetectedService["cookies"] {
  const seen = new Set(a.map((c) => c.name));
  const result = [...a];
  for (const cookie of b) {
    if (!seen.has(cookie.name)) {
      result.push(cookie);
      seen.add(cookie.name);
    }
  }
  return result;
}

function mergeStringArrays(
  a?: string[],
  b?: string[],
): string[] | undefined {
  if (!a && !b) return undefined;
  return [...new Set([...(a || []), ...(b || [])])];
}

/**
 * serviceConnectionsをマージする
 */
export function mergeConnections(
  existing: Record<string, string[]>,
  imported: Record<string, string[]>,
): Record<string, string[]> {
  const merged = { ...existing };
  for (const [key, values] of Object.entries(imported)) {
    merged[key] = [...new Set([...(merged[key] || []), ...values])];
  }
  return merged;
}
