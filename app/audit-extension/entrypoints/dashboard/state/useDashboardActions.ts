import { useCallback } from "preact/hooks";
import type { CSPReport } from "@pleno-audit/csp";
import type { DetectedService } from "@pleno-audit/casb-types";
import { createLogger } from "@pleno-audit/extension-runtime";

interface UseDashboardActionsOptions {
  reports: CSPReport[];
  services: DetectedService[];
  loadData: () => Promise<void> | void;
}

const logger = createLogger("dashboard-actions");

export function useDashboardActions({
  reports,
  services,
  loadData,
}: UseDashboardActionsOptions) {
  const handleClearData = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await loadData();
    } catch (error) {
      logger.warn("Failed to clear data.", error);
    }
  }, [loadData]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([
      JSON.stringify({ reports, services }, null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reports, services]);

  return {
    handleClearData,
    handleExportJSON,
  };
}
