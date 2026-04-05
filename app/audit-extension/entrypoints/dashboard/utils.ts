import type { TabType } from "./types";
import { validTabs } from "./constants";

export function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

export function resolveTabFromHash(hash: string): TabType | null {
  if (hash === "permissions") return "extensions";
  return validTabs.includes(hash as TabType) ? (hash as TabType) : null;
}

export function getInitialTab(): TabType {
  const hash = window.location.hash.slice(1);
  return resolveTabFromHash(hash) ?? "services";
}
