import { useCallback } from "preact/hooks";
import type { CSPReport } from "@pleno-audit/csp";
import type { DetectedService, EventLog } from "@pleno-audit/casb-types";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";

interface UseDashboardActionsOptions {
  reports: CSPReport[];
  services: DetectedService[];
  events: EventLog[];
  aiPrompts: CapturedAIPrompt[];
  loadData: () => Promise<void> | void;
}

export function useDashboardActions({
  reports,
  services,
  events,
  aiPrompts,
  loadData,
}: UseDashboardActionsOptions) {
  const handleClearData = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await loadData();
    } catch (error) {
      console.warn("[dashboard] Failed to clear data.", error);
    }
  }, [loadData]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([
      JSON.stringify({ reports, services, events, aiPrompts }, null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aiPrompts, events, reports, services]);

  return {
    handleClearData,
    handleExportJSON,
  };
}
