import type { DebugHandlerResult } from "./types.js";
import type { DetectedService } from "../types/index.js";
import { mergeServices, mergeConnections } from "../data-export/importer.js";

export async function exportData(): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get([
      "services",
      "serviceConnections",
      "extensionConnections",
    ]);
    const services = storage.services
      ? Object.values(storage.services as Record<string, DetectedService>)
      : [];
    return {
      success: true,
      data: {
        version: "1",
        exportedAt: new Date().toISOString(),
        services,
        serviceConnections: storage.serviceConnections || {},
        extensionConnections: storage.extensionConnections || {},
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to export data" };
  }
}

export async function importData(params: {
  services: Record<string, unknown>[];
  serviceConnections?: Record<string, string[]>;
  extensionConnections?: Record<string, string[]>;
}): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get([
      "services",
      "serviceConnections",
      "extensionConnections",
    ]);

    const existingServices = (storage.services || {}) as Record<string, DetectedService>;
    const merged = mergeServices(existingServices, params.services as unknown as DetectedService[]);
    await chrome.storage.local.set({ services: merged });

    let scCount = 0;
    let ecCount = 0;

    if (params.serviceConnections) {
      const existing = (storage.serviceConnections || {}) as Record<string, string[]>;
      await chrome.storage.local.set({
        serviceConnections: mergeConnections(existing, params.serviceConnections),
      });
      scCount = Object.keys(params.serviceConnections).length;
    }

    if (params.extensionConnections) {
      const existing = (storage.extensionConnections || {}) as Record<string, string[]>;
      await chrome.storage.local.set({
        extensionConnections: mergeConnections(existing, params.extensionConnections),
      });
      ecCount = Object.keys(params.extensionConnections).length;
    }

    return {
      success: true,
      data: {
        counts: {
          services: params.services.length,
          serviceConnections: scCount,
          extensionConnections: ecCount,
        },
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to import data" };
  }
}
