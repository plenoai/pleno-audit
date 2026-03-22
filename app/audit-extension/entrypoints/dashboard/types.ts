export interface TotalCounts {
  violations: number;
  networkRequests: number;
  events: number;
  aiPrompts: number;
}

export type Period = "1h" | "24h" | "7d" | "30d" | "all";

export type TabType =
  | "overview"
  | "timeline"
  | "violations"
  | "network"
  | "domains"
  | "ai"
  | "services"
  | "events"
  | "connections"
  | "extensions";
