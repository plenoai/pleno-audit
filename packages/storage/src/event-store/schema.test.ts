import { describe, it, expect, vi, beforeEach } from "vitest";
import { DB_CONFIG, initializeDatabase } from "./schema.js";

describe("DB_CONFIG", () => {
  it("has correct database name", () => {
    expect(DB_CONFIG.name).toBe("PlenoAuditEvents");
  });

  it("has correct version", () => {
    expect(DB_CONFIG.version).toBe(1);
  });

  it("has events store configuration", () => {
    expect(DB_CONFIG.stores.events).toBeDefined();
    expect(DB_CONFIG.stores.events.name).toBe("events");
    expect(DB_CONFIG.stores.events.keyPath).toBe("id");
  });

  it("has correct indexes for events store", () => {
    const indexes = DB_CONFIG.stores.events.indexes;
    expect(indexes).toHaveLength(4);

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("timestamp");
    expect(indexNames).toContain("type");
    expect(indexNames).toContain("domain");
    expect(indexNames).toContain("type_timestamp");
  });

  it("has timestamp index with correct keyPath", () => {
    const timestampIndex = DB_CONFIG.stores.events.indexes.find(
      (i) => i.name === "timestamp"
    );
    expect(timestampIndex?.keyPath).toBe("timestamp");
  });

  it("has type index with correct keyPath", () => {
    const typeIndex = DB_CONFIG.stores.events.indexes.find(
      (i) => i.name === "type"
    );
    expect(typeIndex?.keyPath).toBe("type");
  });

  it("has domain index with correct keyPath", () => {
    const domainIndex = DB_CONFIG.stores.events.indexes.find(
      (i) => i.name === "domain"
    );
    expect(domainIndex?.keyPath).toBe("domain");
  });

  it("has composite type_timestamp index", () => {
    const compositeIndex = DB_CONFIG.stores.events.indexes.find(
      (i) => i.name === "type_timestamp"
    );
    expect(compositeIndex?.keyPath).toEqual(["type", "timestamp"]);
    expect(compositeIndex?.unique).toBe(false);
  });
});

describe("initializeDatabase", () => {
  let mockDb: Partial<IDBDatabase>;
  let mockRequest: Partial<IDBOpenDBRequest>;
  let mockStore: Partial<IDBObjectStore>;

  beforeEach(() => {
    mockStore = {
      createIndex: vi.fn(),
    };

    mockDb = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
        length: 0,
        item: vi.fn(),
        [Symbol.iterator]: vi.fn(),
      } as unknown as DOMStringList,
      createObjectStore: vi.fn().mockReturnValue(mockStore),
    };

    mockRequest = {
      result: mockDb as IDBDatabase,
      error: null,
    };

    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess(new Event("success"));
          }
        }, 0);
        return mockRequest;
      }),
    });
  });

  it("opens database with correct name and version", async () => {
    const promise = initializeDatabase();

    await promise;

    expect(indexedDB.open).toHaveBeenCalledWith(
      DB_CONFIG.name,
      DB_CONFIG.version
    );
  });

  it("resolves with database on success", async () => {
    const db = await initializeDatabase();
    expect(db).toBe(mockDb);
  });

  it("rejects on error", async () => {
    const error = new Error("Database error");
    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          mockRequest.error = error as DOMException;
          if (mockRequest.onerror) {
            mockRequest.onerror(new Event("error"));
          }
        }, 0);
        return mockRequest;
      }),
    });

    await expect(initializeDatabase()).rejects.toBe(error);
  });

  it("creates object stores on upgrade", async () => {
    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({
              target: mockRequest,
            } as IDBVersionChangeEvent);
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess(new Event("success"));
          }
        }, 0);
        return mockRequest;
      }),
    });

    await initializeDatabase();

    expect(mockDb.createObjectStore).toHaveBeenCalledWith("events", {
      keyPath: "id",
    });
  });

  it("creates indexes on upgrade", async () => {
    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({
              target: mockRequest,
            } as IDBVersionChangeEvent);
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess(new Event("success"));
          }
        }, 0);
        return mockRequest;
      }),
    });

    await initializeDatabase();

    expect(mockStore.createIndex).toHaveBeenCalledWith("timestamp", "timestamp", {
      unique: false,
    });
    expect(mockStore.createIndex).toHaveBeenCalledWith("type", "type", {
      unique: false,
    });
    expect(mockStore.createIndex).toHaveBeenCalledWith("domain", "domain", {
      unique: false,
    });
    expect(mockStore.createIndex).toHaveBeenCalledWith(
      "type_timestamp",
      ["type", "timestamp"],
      { unique: false }
    );
  });

  it("skips store creation if already exists", async () => {
    (mockDb.objectStoreNames!.contains as ReturnType<typeof vi.fn>).mockReturnValue(true);

    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({
              target: mockRequest,
            } as IDBVersionChangeEvent);
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess(new Event("success"));
          }
        }, 0);
        return mockRequest;
      }),
    });

    await initializeDatabase();

    expect(mockDb.createObjectStore).not.toHaveBeenCalled();
  });
});
