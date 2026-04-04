import { useCallback } from "preact/hooks";
import type { CSPReport } from "libztbs/csp";
import type { DetectedService } from "libztbs/types";
import { validateImportData } from "libztbs/data-export";
import { createLogger } from "libztbs/extension-runtime";

interface UseDashboardActionsOptions {
  reports: CSPReport[];
  services: DetectedService[];
  serviceConnections: Record<string, string[]>;
  extensionConnections: Record<string, string[]>;
  loadData: () => Promise<void> | void;
}

const logger = createLogger("dashboard-actions");

export function useDashboardActions({
  reports,
  services,
  serviceConnections,
  extensionConnections,
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
    const data = {
      version: "1",
      exportedAt: new Date().toISOString(),
      services,
      serviceConnections,
      extensionConnections,
      reports,
    };
    const blob = new Blob([
      JSON.stringify(data, null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reports, services, serviceConnections, extensionConnections]);

  const handleImportJSON = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, message: "ファイルが選択されませんでした" });
          return;
        }
        try {
          const content = await file.text();
          const validation = validateImportData(content);
          if (!validation.valid || !validation.data) {
            resolve({ success: false, message: validation.errors.join(", ") });
            return;
          }

          const result = await chrome.runtime.sendMessage({
            type: "IMPORT_DATA",
            data: {
              services: validation.data.services,
              serviceConnections: validation.data.serviceConnections,
              extensionConnections: validation.data.extensionConnections,
            },
          });

          if (result?.success) {
            await loadData();
            const c = result.counts;
            resolve({
              success: true,
              message: `${c.services}件のサービスをインポートしました`,
            });
          } else {
            resolve({ success: false, message: "インポートに失敗しました" });
          }
        } catch (error) {
          logger.warn("Failed to import data.", error);
          resolve({ success: false, message: "ファイルの読み込みに失敗しました" });
        }
      };
      input.click();
    });
  }, [loadData]);

  return {
    handleClearData,
    handleExportJSON,
    handleImportJSON,
  };
}
