import type { CSPReport } from "@pleno-audit/csp";

export type ParquetLogType =
  | "csp-violations"
  | "network-requests"
  | "events"
  | "ai-prompts"
  | "nrd-detections"
  | "typosquat-detections";

export interface ParquetFileRecord {
  key: string; // "csp-violations-2026-01-14"
  type: ParquetLogType;
  date: string; // "2026-01-14"
  data: Uint8Array; // Parquetファイルのバイナリ
  recordCount: number;
  sizeBytes: number;
  createdAt: number;
  lastModified: number;
}

export interface WriteBuffer<T> {
  records: T[];
  lastFlush: number;
  targetDate: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
  domain?: string;
  type?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface DatabaseStats {
  violations: number;
  requests: number;
  uniqueDomains: number;
}

export interface DynamicIndex {
  period: { since: number; until: number };
  tables: {
    cspViolations: Map<string, number[]>; // domain → rowIndices
    networkRequests: Map<string, number[]>; // domain → rowIndices
    events: Map<string, number[]>; // type → rowIndices
  };
  stats: {
    totalRecords: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
  };
  createdAt: number;
  expiresAt: number; // 5分後に自動失効
}

export interface ParquetEvent {
  id: string;
  type: string;
  domain: string;
  timestamp: number;
  details: string; // JSON serialized
}

export interface QueryResult<T = CSPReport | ParquetEvent> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface ExportOptions {
  type?: ParquetLogType;
  since?: string;
  until?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedRecords: number;
  timestamp?: number;
}
