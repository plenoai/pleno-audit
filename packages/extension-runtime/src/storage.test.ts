import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chrome API
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageClear = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
      remove: mockStorageRemove,
      clear: mockStorageClear,
    },
  },
});

// Mock dependencies
vi.mock("@pleno-audit/detectors", () => ({
  DEFAULT_NRD_CONFIG: { enabled: true, checkInterval: 3600000 },
  DEFAULT_AI_MONITOR_CONFIG: { enabled: true },
}));

vi.mock("@pleno-audit/csp", () => ({
  DEFAULT_CSP_CONFIG: { enabled: true, reportOnly: false },
}));

import {
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearAIPrompts,
  clearAllStorage,
  queueStorageOperation,
} from "./storage.js";

describe("storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockStorageRemove.mockResolvedValue(undefined);
    mockStorageClear.mockResolvedValue(undefined);
  });

  describe("getStorage", () => {
    it("returns default values when storage is empty", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorage();

      expect(result.services).toEqual({});
      expect(result.alerts).toEqual([]);
      expect(result.aiPrompts).toEqual([]);
      expect(result.networkMonitorConfig).toEqual({
        enabled: true,
        captureAllRequests: true,
        excludeOwnExtension: true,
        excludedDomains: [],
        excludedExtensions: [],
      });
      expect(result.doHMonitorConfig).toEqual({
        action: "detect",
        maxStoredRequests: 1000,
      });
    });

    it("returns stored values when available", async () => {
      const services = { "example.com": { domain: "example.com", firstSeen: "2024-01-01" } };
      const alerts = [{ id: "a1", category: "nrd", severity: "high" }];

      mockStorageGet.mockResolvedValue({ services, alerts });

      const result = await getStorage();

      expect(result.services).toEqual(services);
      expect(result.alerts).toEqual(alerts);
    });

    it("merges stored and default configs", async () => {
      const cspConfig = { enabled: false, reportOnly: true };

      mockStorageGet.mockResolvedValue({ cspConfig });

      const result = await getStorage();

      expect(result.cspConfig).toEqual(cspConfig);
    });

    it("fetches all storage keys", async () => {
      await getStorage();

      expect(mockStorageGet).toHaveBeenCalledWith(
        expect.arrayContaining([
          "services",
          "policyConfig",
          "alerts",
          "cspConfig",
          "aiPrompts",
          "aiMonitorConfig",
          "nrdConfig",
          "networkMonitorConfig",
          "doHRequests",
          "doHMonitorConfig",
          "dataRetentionConfig",
          "detectionConfig",
          "blockingConfig",
          "notificationConfig",
          "alertCooldown",
        ])
      );
    });
  });

  describe("setStorage", () => {
    it("sets storage data", async () => {
      const data = { services: { "test.com": { domain: "test.com" } } };

      await setStorage(data);

      expect(mockStorageSet).toHaveBeenCalledWith(data);
    });

    it("allows partial updates", async () => {
      await setStorage({ alerts: [] });

      expect(mockStorageSet).toHaveBeenCalledWith({ alerts: [] });
    });
  });

  describe("getStorageKey", () => {
    it("returns specific key value", async () => {
      const services = { "example.com": { domain: "example.com" } };
      mockStorageGet.mockResolvedValue({ services });

      const result = await getStorageKey("services");

      expect(result).toEqual(services);
      expect(mockStorageGet).toHaveBeenCalledWith(["services"]);
    });

    it("returns default for missing key", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("services");

      expect(result).toEqual({});
    });

    it("returns default for alerts", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("alerts");

      expect(result).toEqual([]);
    });

    it("returns default config for cspConfig", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("cspConfig");

      expect(result).toEqual({ enabled: true, reportOnly: false });
    });

    it("returns default config for aiMonitorConfig", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("aiMonitorConfig");

      expect(result).toEqual({ enabled: true });
    });

    it("returns default config for networkMonitorConfig", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("networkMonitorConfig");

      expect(result).toEqual({
        enabled: true,
        captureAllRequests: true,
        excludeOwnExtension: true,
        excludedDomains: [],
        excludedExtensions: [],
      });
    });
  });

  describe("getServiceCount", () => {
    it("returns 0 when no services", async () => {
      mockStorageGet.mockResolvedValue({});

      const count = await getServiceCount();

      expect(count).toBe(0);
    });

    it("returns correct count of services", async () => {
      mockStorageGet.mockResolvedValue({
        services: {
          "example.com": { domain: "example.com" },
          "test.com": { domain: "test.com" },
          "demo.com": { domain: "demo.com" },
        },
      });

      const count = await getServiceCount();

      expect(count).toBe(3);
    });
  });

  describe("clearAIPrompts", () => {
    it("removes aiPrompts from storage", async () => {
      await clearAIPrompts();

      expect(mockStorageRemove).toHaveBeenCalledWith(["aiPrompts"]);
    });
  });

  describe("clearAllStorage", () => {
    it("clears all storage and sets default values", async () => {
      await clearAllStorage();

      expect(mockStorageClear).toHaveBeenCalled();
      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          services: {},
          alerts: [],
          aiPrompts: [],
        })
      );
    });

    it("preserves theme when preserveTheme option is true", async () => {
      mockStorageGet.mockResolvedValue({ themeMode: "dark" });

      await clearAllStorage({ preserveTheme: true });

      expect(mockStorageClear).toHaveBeenCalled();
      // Should restore theme after clearing
      expect(mockStorageSet).toHaveBeenCalledWith({ themeMode: "dark" });
    });

    it("does not preserve theme when preserveTheme is false", async () => {
      mockStorageGet.mockResolvedValue({ themeMode: "dark" });

      await clearAllStorage({ preserveTheme: false });

      expect(mockStorageClear).toHaveBeenCalled();
      // Should not restore theme
      expect(mockStorageSet).not.toHaveBeenCalledWith({ themeMode: "dark" });
    });

    it("handles missing theme gracefully", async () => {
      mockStorageGet.mockResolvedValue({});

      await clearAllStorage({ preserveTheme: true });

      expect(mockStorageClear).toHaveBeenCalled();
      // Should not try to restore undefined theme
      expect(mockStorageSet).toHaveBeenCalledTimes(1); // Only default settings
    });
  });

  describe("queueStorageOperation", () => {
    it("executes operations sequentially", async () => {
      const order: number[] = [];

      const op1 = queueStorageOperation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
        return 1;
      });

      const op2 = queueStorageOperation(async () => {
        order.push(2);
        return 2;
      });

      const op3 = queueStorageOperation(async () => {
        order.push(3);
        return 3;
      });

      const results = await Promise.all([op1, op2, op3]);

      expect(results).toEqual([1, 2, 3]);
      expect(order).toEqual([1, 2, 3]);
    });

    it("returns operation result", async () => {
      const result = await queueStorageOperation(async () => "test result");

      expect(result).toBe("test result");
    });

    it("propagates errors", async () => {
      await expect(
        queueStorageOperation(async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });

    it("continues queue after error", async () => {
      const errorOp = queueStorageOperation(async () => {
        throw new Error("Error");
      }).catch(() => "caught");

      const successOp = queueStorageOperation(async () => "success");

      const results = await Promise.all([errorOp, successOp]);

      expect(results).toEqual(["caught", "success"]);
    });
  });
});
