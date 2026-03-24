import type { Period, TabType } from "./types";
import { validTabs } from "./constants";
export { getStatusBadge } from "@libztbs/alerts";

export function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

export function getPeriodMs(period: Period): number {
  switch (period) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

export function resolveTabFromHash(hash: string): TabType | null {
  if (hash === "permissions") return "extensions";
  return validTabs.includes(hash as TabType) ? (hash as TabType) : null;
}

export function getInitialTab(): TabType {
  const hash = window.location.hash.slice(1);
  return resolveTabFromHash(hash) ?? "services";
}
