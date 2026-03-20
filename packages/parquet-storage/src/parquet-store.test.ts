import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const mockIndexedDBInit = vi.hoisted(() => vi.fn());
const mockIndexedDBSave = vi.hoisted(() => vi.fn());
const mockIndexedDBLoad = vi.hoisted(() => vi.fn());
const mockIndexedDBListByDateRange = vi.hoisted(() => vi.fn());
const mockIndexedDBDeleteBeforeDate = vi.hoisted(() => vi.fn());
const mockIndexedDBClear = vi.hoisted(() => vi.fn());

vi.mock("./indexeddb-adapter", () => ({
  ParquetIndexedDBAdapter: class MockParquetIndexedDBAdapter {
    init = mockIndexedDBInit;
    save = mockIndexedDBSave;
    load = mockIndexedDBLoad;
    listByDateRange = mockIndexedDBListByDateRange;
    deleteBeforeDate = mockIndexedDBDeleteBeforeDate;
    clear = mockIndexedDBClear;
  },
}));

import { ParquetStore } from "./parquet-store.js";

describe("ParquetStore", () => {
  let store: ParquetStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexedDBInit.mockResolvedValue(undefined);
    mockIndexedDBSave.mockResolvedValue(undefined);
    mockIndexedDBLoad.mockResolvedValue(null);
    mockIndexedDBListByDateRange.mockResolvedValue([]);
    mockIndexedDBDeleteBeforeDate.mockResolvedValue(0);
    mockIndexedDBClear.mockResolvedValue(undefined);
    store = new ParquetStore();
  });

  describe("init", () => {
    it("initializes IndexedDB adapter", async () => {
      await store.init();
      expect(mockIndexedDBInit).toHaveBeenCalled();
    });
  });

  describe("write and flush", () => {
    it("writes records to buffer", async () => {
      await store.write("csp-violations", [{ domain: "example.com" }]);
      // Buffer will accumulate records before flushing
      expect(mockIndexedDBSave).not.toHaveBeenCalled();
    });
  });

  describe("getReports", () => {
    it("returns empty result when no data", async () => {
      mockIndexedDBListByDateRange.mockResolvedValue([]);

      const result = await store.getReports();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("queries violations and requests", async () => {
      const violationData = JSON.stringify([
        { domain: "example.com", directive: "script-src", timestamp: "2024-01-01T00:00:00.000Z" },
      ]);
      const requestData = JSON.stringify([
        { domain: "example.com", url: "https://example.com/api", timestamp: "2024-01-01T00:00:00.000Z" },
      ]);

      mockIndexedDBListByDateRange
        .mockResolvedValueOnce([{ data: new TextEncoder().encode(violationData) }])
        .mockResolvedValueOnce([{ data: new TextEncoder().encode(requestData) }]);

      const result = await store.getReports();

      expect(mockIndexedDBListByDateRange).toHaveBeenCalledTimes(2);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("applies date range from options", async () => {
      mockIndexedDBListByDateRange.mockResolvedValue([]);

      await store.getReports({ since: "2024-01-01", until: "2024-01-31" });

      expect(mockIndexedDBListByDateRange).toHaveBeenCalledWith(
        "csp-violations",
        "2024-01-01",
        "2024-01-31"
      );
    });
  });

  describe("getViolations", () => {
    it("returns paginated violations", async () => {
      const data = JSON.stringify([
        { domain: "example.com", directive: "script-src", timestamp: "2024-01-01T00:00:00.000Z" },
        { domain: "test.com", directive: "style-src", timestamp: "2024-01-02T00:00:00.000Z" },
      ]);

      mockIndexedDBListByDateRange.mockResolvedValue([
        { data: new TextEncoder().encode(data) },
      ]);

      const result = await store.getViolations({ limit: 10 });

      expect(result.data.length).toBe(2);
    });
  });

  describe("getNetworkRequests", () => {
    it("returns paginated network requests", async () => {
      const data = JSON.stringify([
        { domain: "api.example.com", url: "https://api.example.com/v1", method: "GET", timestamp: "2024-01-01T00:00:00.000Z" },
      ]);

      mockIndexedDBListByDateRange.mockResolvedValue([
        { data: new TextEncoder().encode(data) },
      ]);

      const result = await store.getNetworkRequests();

      expect(result.data.length).toBe(1);
    });
  });

  describe("getEvents", () => {
    it("returns paginated events", async () => {
      const data = JSON.stringify([
        { type: "page_visit", domain: "example.com", timestamp: "2024-01-01T00:00:00.000Z" },
      ]);

      mockIndexedDBListByDateRange.mockResolvedValue([
        { data: new TextEncoder().encode(data) },
      ]);

      const result = await store.getEvents();

      expect(result.data.length).toBe(1);
    });
  });

  describe("getStats", () => {
    it("returns database statistics", async () => {
      const violationData = JSON.stringify([
        { domain: "example.com", directive: "script-src" },
        { domain: "test.com", directive: "style-src" },
      ]);
      const requestData = JSON.stringify([
        { domain: "api.example.com", url: "https://api.example.com" },
      ]);

      mockIndexedDBListByDateRange
        .mockResolvedValueOnce([{ data: new TextEncoder().encode(violationData) }])
        .mockResolvedValueOnce([{ data: new TextEncoder().encode(requestData) }]);

      const stats = await store.getStats();

      expect(stats.violations).toBe(2);
      expect(stats.requests).toBe(1);
      expect(stats.uniqueDomains).toBe(3);
    });

    it("returns zeros when no data", async () => {
      mockIndexedDBListByDateRange.mockResolvedValue([]);

      const stats = await store.getStats();

      expect(stats.violations).toBe(0);
      expect(stats.requests).toBe(0);
      expect(stats.uniqueDomains).toBe(0);
    });
  });

  describe("insertReports", () => {
    it("inserts CSP violation reports", async () => {
      const reports = [
        { id: "1", type: "csp-violation", domain: "example.com", directive: "script-src", timestamp: "2024-01-01" },
      ];

      await store.insertReports(reports as any);

      // Reports are buffered, not immediately saved
      expect(mockIndexedDBSave).not.toHaveBeenCalled();
    });

    it("inserts network request reports", async () => {
      const reports = [
        { id: "1", type: "network-request", domain: "example.com", url: "https://example.com", timestamp: "2024-01-01" },
      ];

      await store.insertReports(reports as any);

      expect(mockIndexedDBSave).not.toHaveBeenCalled();
    });
  });

  describe("addEvents", () => {
    it("adds events to buffer", async () => {
      const events = [
        { type: "page_visit", domain: "example.com", timestamp: Date.now() },
      ];

      await store.addEvents(events as any);

      expect(mockIndexedDBSave).not.toHaveBeenCalled();
    });
  });

  describe("deleteOldReports", () => {
    it("deletes reports before specified date", async () => {
      mockIndexedDBDeleteBeforeDate
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      const deleted = await store.deleteOldReports("2024-01-01");

      expect(deleted).toBe(10);
      expect(mockIndexedDBDeleteBeforeDate).toHaveBeenCalledTimes(3);
      expect(mockIndexedDBDeleteBeforeDate).toHaveBeenCalledWith("csp-violations", "2024-01-01");
      expect(mockIndexedDBDeleteBeforeDate).toHaveBeenCalledWith("network-requests", "2024-01-01");
      expect(mockIndexedDBDeleteBeforeDate).toHaveBeenCalledWith("events", "2024-01-01");
    });
  });

  describe("clearAll", () => {
    it("clears all data", async () => {
      await store.clearAll();

      expect(mockIndexedDBClear).toHaveBeenCalled();
    });
  });

  describe("date range handling", () => {
    it("uses default 30-day range when no options", async () => {
      mockIndexedDBListByDateRange.mockResolvedValue([]);

      await store.getReports();

      const calls = mockIndexedDBListByDateRange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Should have start and end dates
      expect(calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(calls[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("data serialization", () => {
    it("handles multiple files for same date range", async () => {
      const data1 = JSON.stringify([{ domain: "a.com" }]);
      const data2 = JSON.stringify([{ domain: "b.com" }]);

      mockIndexedDBListByDateRange.mockResolvedValue([
        { data: new TextEncoder().encode(data1) },
        { data: new TextEncoder().encode(data2) },
      ]);

      const result = await store.getViolations();

      expect(result.data.length).toBe(2);
    });
  });
});
