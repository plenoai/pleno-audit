/**
 * Network Monitor - Utilities
 *
 * 共通ユーティリティ関数
 */

import type {
  NetworkRequestRecord,
  ExtensionRequestRecord,
} from "../../extension-runtime/index.js";

/**
 * NetworkRequestRecord から ExtensionRequestRecord へ変換
 */
export function toExtensionRequestRecords(
  records: NetworkRequestRecord[]
): ExtensionRequestRecord[] {
  return records
    .filter(
      (record): record is NetworkRequestRecord & { extensionId: string } =>
        record.initiatorType === "extension" && typeof record.extensionId === "string"
    )
    .map((record) => ({
      id: record.id,
      extensionId: record.extensionId,
      extensionName: record.extensionName || "Unknown",
      timestamp: record.timestamp,
      url: record.url,
      method: record.method,
      resourceType: record.resourceType,
      domain: record.domain,
      detectedBy: record.detectedBy,
    }));
}
