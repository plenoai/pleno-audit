import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
  resetEventsMigration,
  type ParquetStoreLike,
} from "./migration.js";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
      remove: mockRemove,
    },
  },
});

describe("checkEventsMigrationNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when migration is already completed", async () => {
    mockGet.mockResolvedValue({
      events_parquet_migration_completed: true,
      events: [{ id: "1", type: "test" }],
    });

    const result = await checkEventsMigrationNeeded();

    expect(result).toBe(false);
  });

  it("returns false when no events in storage", async () => {
    mockGet.mockResolvedValue({
      events_parquet_migration_completed: false,
      events: [],
    });

    const result = await checkEventsMigrationNeeded();

    expect(result).toBe(false);
  });

  it("returns false when events is not an array", async () => {
    mockGet.mockResolvedValue({
      events_parquet_migration_completed: false,
      events: null,
    });

    const result = await checkEventsMigrationNeeded();

    expect(result).toBe(false);
  });

  it("returns true when migration needed", async () => {
    mockGet.mockResolvedValue({
      events_parquet_migration_completed: false,
      events: [{ id: "1", type: "test" }],
    });

    const result = await checkEventsMigrationNeeded();

    expect(result).toBe(true);
  });

  it("returns true when migration flag is undefined", async () => {
    mockGet.mockResolvedValue({
      events: [{ id: "1", type: "test" }],
    });

    const result = await checkEventsMigrationNeeded();

    expect(result).toBe(true);
  });
});

describe("migrateEventsToIndexedDB", () => {
  let mockParquetStore: ParquetStoreLike;

  beforeEach(() => {
    vi.clearAllMocks();
    mockParquetStore = {
      init: vi.fn().mockResolvedValue(undefined),
      addEvents: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("returns success with 0 count when no events", async () => {
    mockGet.mockResolvedValue({ events: [] });

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: true, migratedCount: 0 });
    expect(mockParquetStore.init).not.toHaveBeenCalled();
  });

  it("returns success with 0 count when events is not array", async () => {
    mockGet.mockResolvedValue({ events: undefined });

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: true, migratedCount: 0 });
  });

  it("migrates events successfully", async () => {
    const events = [
      { id: "1", type: "page_visit", domain: "example.com", timestamp: 1000, details: { url: "https://example.com" } },
      { id: "2", type: "login", domain: "test.com", timestamp: 2000, details: {} },
    ];
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: true, migratedCount: 2 });
    expect(mockParquetStore.init).toHaveBeenCalled();
    expect(mockParquetStore.addEvents).toHaveBeenCalledWith([
      { id: "1", type: "page_visit", domain: "example.com", timestamp: 1000, details: '{"url":"https://example.com"}' },
      { id: "2", type: "login", domain: "test.com", timestamp: 2000, details: "{}" },
    ]);
  });

  it("processes events in batches of 100", async () => {
    const events = Array.from({ length: 250 }, (_, i) => ({
      id: String(i),
      type: "test",
      domain: "example.com",
      timestamp: i,
      details: {},
    }));
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: true, migratedCount: 250 });
    expect(mockParquetStore.addEvents).toHaveBeenCalledTimes(3);
  });

  it("sets migration flag after success", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000, details: {} }];
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    await migrateEventsToIndexedDB(mockParquetStore);

    expect(mockSet).toHaveBeenCalledWith({ events_parquet_migration_completed: true });
  });

  it("removes events from storage after success", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000, details: {} }];
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    await migrateEventsToIndexedDB(mockParquetStore);

    expect(mockRemove).toHaveBeenCalledWith(["events"]);
  });

  it("handles missing timestamp", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", details: {} }];
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result.success).toBe(true);
    expect(mockParquetStore.addEvents).toHaveBeenCalled();
    const addedEvents = (mockParquetStore.addEvents as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(addedEvents[0].timestamp).toBeGreaterThan(0);
  });

  it("handles missing details", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000 }];
    mockGet.mockResolvedValue({ events });
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result.success).toBe(true);
    const addedEvents = (mockParquetStore.addEvents as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(addedEvents[0].details).toBe("{}");
  });

  it("returns error on init failure", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000, details: {} }];
    mockGet.mockResolvedValue({ events });
    (mockParquetStore.init as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Init failed"));

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: false, migratedCount: 0, error: "Init failed" });
  });

  it("returns error on addEvents failure", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000, details: {} }];
    mockGet.mockResolvedValue({ events });
    (mockParquetStore.addEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Add failed"));

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: false, migratedCount: 0, error: "Add failed" });
  });

  it("handles non-Error exceptions", async () => {
    const events = [{ id: "1", type: "test", domain: "example.com", timestamp: 1000, details: {} }];
    mockGet.mockResolvedValue({ events });
    (mockParquetStore.addEvents as ReturnType<typeof vi.fn>).mockRejectedValue("string error");

    const result = await migrateEventsToIndexedDB(mockParquetStore);

    expect(result).toEqual({ success: false, migratedCount: 0, error: "string error" });
  });
});

describe("resetEventsMigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes migration flag", async () => {
    mockRemove.mockResolvedValue(undefined);

    await resetEventsMigration();

    expect(mockRemove).toHaveBeenCalledWith(["events_parquet_migration_completed"]);
  });
});
