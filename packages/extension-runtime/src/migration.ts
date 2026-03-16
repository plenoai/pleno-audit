import type { CSPReport } from "@pleno-audit/csp";
import { getApiClient } from "./api-client.js";

const MIGRATION_KEY = "duckdbMigrationCompleted";
const LEGACY_REPORTS_KEY = "cspReports";
const BATCH_SIZE = 100;

export async function checkMigrationNeeded(): Promise<boolean> {
  const result = await chrome.storage.local.get([MIGRATION_KEY, LEGACY_REPORTS_KEY]);
  return !result[MIGRATION_KEY] && Array.isArray(result[LEGACY_REPORTS_KEY]) && result[LEGACY_REPORTS_KEY].length > 0;
}

export async function migrateToDatabase(): Promise<{ success: boolean; migratedCount: number }> {
  const result = await chrome.storage.local.get([MIGRATION_KEY, LEGACY_REPORTS_KEY]) as Record<string, unknown>;
  if (result[MIGRATION_KEY]) {
    return { success: true, migratedCount: 0 };
  }

  const legacyReports: CSPReport[] = (result[LEGACY_REPORTS_KEY] as CSPReport[]) || [];
  if (legacyReports.length === 0) {
    await chrome.storage.local.set({ [MIGRATION_KEY]: true });
    return { success: true, migratedCount: 0 };
  }

  const apiClient = await getApiClient();
  for (let i = 0; i < legacyReports.length; i += BATCH_SIZE) {
    const batch = legacyReports.slice(i, i + BATCH_SIZE);
    await apiClient.postReports(batch);
  }

  await chrome.storage.local.set({ [MIGRATION_KEY]: true });
  await chrome.storage.local.remove([LEGACY_REPORTS_KEY]);
  return { success: true, migratedCount: legacyReports.length };
}
