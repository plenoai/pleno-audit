/**
 * @fileoverview Audit Log Exporter
 *
 * 監査ログ（AIプロンプト、検出サービス）をCSV/JSON形式でエクスポート
 */

import type {
  AIPromptExport,
  DetectedServiceExport,
} from "./types.js";

/**
 * CSV用のエスケープ処理
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * タイムスタンプをISO形式に変換
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

// ============================================================================
// AI Prompt Export
// ============================================================================

/**
 * AIプロンプト履歴をCSV形式にエクスポート（プライバシー保護）
 */
export function exportAIPromptsToCSV(prompts: AIPromptExport[]): string {
  const headers = [
    "id",
    "timestamp",
    "pageUrl",
    "provider",
    "model",
    "contentSize",
    "hasSensitiveData",
    "sensitiveDataTypes",
    "riskLevel",
    "riskScore",
  ];

  const rows = prompts.map((prompt) => [
    escapeCSV(prompt.id),
    escapeCSV(formatTimestamp(prompt.timestamp)),
    escapeCSV(prompt.pageUrl),
    escapeCSV(prompt.provider),
    escapeCSV(prompt.model),
    escapeCSV(prompt.contentSize),
    escapeCSV(prompt.hasSensitiveData),
    escapeCSV(prompt.sensitiveDataTypes.join("; ")),
    escapeCSV(prompt.riskLevel),
    escapeCSV(prompt.riskScore),
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}

/**
 * AIプロンプト履歴をJSON形式にエクスポート
 */
export function exportAIPromptsToJSON(
  prompts: AIPromptExport[],
  options?: { pretty?: boolean }
): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    recordCount: prompts.length,
    prompts: prompts.map((prompt) => ({
      ...prompt,
      timestamp: formatTimestamp(prompt.timestamp),
    })),
  };

  return options?.pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

// ============================================================================
// Detected Services Export
// ============================================================================

/**
 * 検出サービスをCSV形式にエクスポート
 */
export function exportDetectedServicesToCSV(
  services: DetectedServiceExport[]
): string {
  const headers = [
    "domain",
    "detectedAt",
    "hasLoginPage",
    "privacyPolicyUrl",
    "termsOfServiceUrl",
    "cookieCount",
    "isNRD",
    "nrdConfidence",
    "nrdDomainAge",
    "isTyposquat",
    "typosquatConfidence",
    "typosquatScore",
    "hasAIActivity",
    "aiProviders",
    "aiHasSensitiveData",
    "aiRiskLevel",
  ];

  const rows = services.map((service) => [
    escapeCSV(service.domain),
    escapeCSV(formatTimestamp(service.detectedAt)),
    escapeCSV(service.hasLoginPage),
    escapeCSV(service.privacyPolicyUrl),
    escapeCSV(service.termsOfServiceUrl),
    escapeCSV(service.cookieCount),
    escapeCSV(service.isNRD),
    escapeCSV(service.nrdConfidence),
    escapeCSV(service.nrdDomainAge),
    escapeCSV(service.isTyposquat),
    escapeCSV(service.typosquatConfidence),
    escapeCSV(service.typosquatScore),
    escapeCSV(service.hasAIActivity),
    escapeCSV(service.aiProviders?.join("; ")),
    escapeCSV(service.aiHasSensitiveData),
    escapeCSV(service.aiRiskLevel),
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}

/**
 * 検出サービスをJSON形式にエクスポート
 */
export function exportDetectedServicesToJSON(
  services: DetectedServiceExport[],
  options?: { pretty?: boolean }
): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    recordCount: services.length,
    services: services.map((service) => ({
      ...service,
      detectedAt: formatTimestamp(service.detectedAt),
    })),
  };

  return options?.pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

// ============================================================================
// Combined Audit Export
// ============================================================================

/**
 * 監査ログ全体をエクスポート
 */
export interface AuditLogData {
  services: DetectedServiceExport[];
}

/**
 * 監査ログをJSON形式でエクスポート
 */
export function exportAuditLogToJSON(
  data: AuditLogData,
  options?: { pretty?: boolean }
): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    summary: {
      serviceCount: data.services.length,
    },
    services: data.services.map((service) => ({
      ...service,
      detectedAt: formatTimestamp(service.detectedAt),
    })),
  };

  return options?.pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

/**
 * ダウンロード用のBlobを作成
 */
export function createExportBlob(
  content: string,
  format: "json" | "csv"
): Blob {
  const mimeType = format === "json" ? "application/json" : "text/csv";
  return new Blob([content], { type: `${mimeType};charset=utf-8` });
}

/**
 * ファイル名を生成
 */
export function generateExportFilename(
  dataType: "ai-prompts" | "services" | "audit-log",
  format: "json" | "csv"
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `pleno-audit-${dataType}-${timestamp}.${format}`;
}
