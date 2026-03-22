import type { DetectedService } from "@pleno-audit/casb-types";

export type ServiceTag =
  | { type: "nrd"; domainAge: number | null; confidence: string }
  | { type: "typosquat"; score: number; confidence: string }
  | { type: "ai" }
  | { type: "login" }
  | { type: "privacy"; url: string }
  | { type: "tos"; url: string }
  | { type: "cookie"; count: number };

export interface ConnectionInfo {
  domain: string;
  requestCount: number;
}

export type ServiceSource =
  | { type: "domain"; domain: string; service: DetectedService }
  | { type: "extension"; extensionId: string; extensionName: string; icon?: string };

export interface UnifiedService {
  id: string;
  source: ServiceSource;
  connections: ConnectionInfo[];
  tags: ServiceTag[];
  lastActivity: number;
  faviconUrl?: string;
}

export type SortType = "activity" | "connections" | "name";
