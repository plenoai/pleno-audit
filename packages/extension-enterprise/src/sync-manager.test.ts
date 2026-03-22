import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const mockLocalGetReports = vi.hoisted(() => vi.fn());
const mockLocalPostReports = vi.hoisted(() => vi.fn());
const mockLocalSync = vi.hoisted(() => vi.fn());
const mockRemotePushAndPull = vi.hoisted(() => vi.fn());

// Mock logger
vi.mock("@pleno-audit/extension-runtime", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock api-client
vi.mock("./api-client.js", () => ({
  getApiClient: vi.fn().mockResolvedValue({
    getReports: mockLocalGetReports,
    postReports: mockLocalPostReports,
    sync: mockLocalSync,
  }),
  ApiClient: class MockApiClient {
    pushAndPull = mockRemotePushAndPull;
  },
}));

// Mock chrome API
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockAlarmsCreate = vi.fn();
const mockAlarmsClear = vi.fn();
const mockAlarmsOnAlarmAddListener = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  alarms: {
    create: mockAlarmsCreate,
    clear: mockAlarmsClear,
    onAlarm: {
      addListener: mockAlarmsOnAlarmAddListener,
    },
  },
});

import { SyncManager, getSyncManager } from "./sync-manager.js";

describe("SyncManager", () => {
  let manager: SyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockAlarmsClear.mockResolvedValue(undefined);
    manager = new SyncManager();
  });

  describe("init", () => {
    it("initializes disabled by default", async () => {
      mockStorageGet.mockResolvedValue({});

      await manager.init();

      expect(manager.isEnabled()).toBe(false);
      expect(manager.getRemoteEndpoint()).toBeNull();
    });

    it("initializes enabled with endpoint from storage", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });

      await manager.init();

      expect(manager.isEnabled()).toBe(true);
      expect(manager.getRemoteEndpoint()).toBe("https://api.example.com");
    });
  });

  describe("setEnabled", () => {
    it("enables sync with endpoint", async () => {
      await manager.setEnabled(true, "https://api.test.com");

      expect(mockStorageSet).toHaveBeenCalledWith({
        syncEnabled: true,
        remoteEndpoint: "https://api.test.com",
      });
      expect(manager.isEnabled()).toBe(true);
      expect(manager.getRemoteEndpoint()).toBe("https://api.test.com");
    });

    it("disables sync and clears clients", async () => {
      await manager.setEnabled(true, "https://api.test.com");
      await manager.setEnabled(false);

      expect(mockStorageSet).toHaveBeenLastCalledWith({
        syncEnabled: false,
        remoteEndpoint: null,
      });
      expect(manager.isEnabled()).toBe(false);
      expect(manager.getRemoteEndpoint()).toBeNull();
    });

    it("starts sync when enabled", async () => {
      await manager.setEnabled(true, "https://api.test.com");

      expect(mockAlarmsCreate).toHaveBeenCalledWith("syncReports", {
        periodInMinutes: 1,
      });
    });

    it("stops sync when disabled", async () => {
      await manager.setEnabled(true, "https://api.test.com");
      await manager.setEnabled(false);

      expect(mockAlarmsClear).toHaveBeenCalledWith("syncReports");
    });
  });

  describe("startSync", () => {
    it("does nothing when disabled", async () => {
      await manager.startSync();

      expect(mockAlarmsCreate).not.toHaveBeenCalled();
    });

    it("creates alarm when enabled", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      await manager.startSync(5);

      expect(mockAlarmsCreate).toHaveBeenCalledWith("syncReports", {
        periodInMinutes: 5,
      });
    });

    it("registers alarm listener only once", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      await manager.startSync();
      await manager.startSync();

      expect(mockAlarmsOnAlarmAddListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopSync", () => {
    it("clears sync alarm", async () => {
      await manager.stopSync();

      expect(mockAlarmsClear).toHaveBeenCalledWith("syncReports");
    });
  });

  describe("sync", () => {
    it("returns zeros when disabled", async () => {
      const result = await manager.sync();

      expect(result).toEqual({ sent: 0, received: 0 });
    });

    it("syncs local and remote reports", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      const localReports = [
        { id: "local1", domain: "local.com", timestamp: "2024-01-01", violations: [], requests: [] },
      ];
      const serverReports = [
        { id: "server1", domain: "server.com", timestamp: "2024-01-02", violations: [], requests: [] },
      ];

      mockStorageGet.mockResolvedValue({ lastSyncTime: "2024-01-01T00:00:00.000Z" });
      mockLocalSync.mockResolvedValue({ reports: localReports });
      mockRemotePushAndPull.mockResolvedValue({
        serverReports,
        serverTime: "2024-01-02T00:00:00.000Z",
      });
      mockLocalPostReports.mockResolvedValue({ success: true });

      const result = await manager.sync();

      expect(result).toEqual({ sent: 1, received: 1 });
      expect(mockLocalSync).toHaveBeenCalledWith("2024-01-01T00:00:00.000Z");
      expect(mockRemotePushAndPull).toHaveBeenCalledWith(localReports, "2024-01-01T00:00:00.000Z");
      expect(mockLocalPostReports).toHaveBeenCalledWith(serverReports);
    });

    it("uses epoch time when no lastSyncTime", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      mockStorageGet.mockResolvedValue({});
      mockLocalSync.mockResolvedValue({ reports: [] });
      mockRemotePushAndPull.mockResolvedValue({ serverReports: [], serverTime: "2024-01-01T00:00:00.000Z" });

      await manager.sync();

      expect(mockLocalSync).toHaveBeenCalledWith("1970-01-01T00:00:00.000Z");
    });

    it("skips postReports when no server reports", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      mockStorageGet.mockResolvedValue({});
      mockLocalSync.mockResolvedValue({ reports: [] });
      mockRemotePushAndPull.mockResolvedValue({ serverReports: [], serverTime: "2024-01-01T00:00:00.000Z" });

      await manager.sync();

      expect(mockLocalPostReports).not.toHaveBeenCalled();
    });

    it("updates lastSyncTime after sync", async () => {
      mockStorageGet.mockResolvedValue({
        syncEnabled: true,
        remoteEndpoint: "https://api.example.com",
      });
      await manager.init();

      mockStorageGet.mockResolvedValue({});
      mockLocalSync.mockResolvedValue({ reports: [] });
      mockRemotePushAndPull.mockResolvedValue({ serverReports: [], serverTime: "2024-01-02T12:00:00.000Z" });

      await manager.sync();

      expect(mockStorageSet).toHaveBeenCalledWith({ lastSyncTime: "2024-01-02T12:00:00.000Z" });
    });
  });

  describe("isEnabled", () => {
    it("returns false by default", () => {
      expect(manager.isEnabled()).toBe(false);
    });

    it("returns true when enabled", async () => {
      await manager.setEnabled(true, "https://api.test.com");
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe("getRemoteEndpoint", () => {
    it("returns null by default", () => {
      expect(manager.getRemoteEndpoint()).toBeNull();
    });

    it("returns endpoint when set", async () => {
      await manager.setEnabled(true, "https://api.test.com");
      expect(manager.getRemoteEndpoint()).toBe("https://api.test.com");
    });
  });
});

describe("getSyncManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({});
  });

  it("returns singleton instance", async () => {
    const { getSyncManager: getManager } = await import("./sync-manager.js");
    const instance1 = await getManager();
    const instance2 = await getManager();

    expect(instance1).toBe(instance2);
  });
});
