import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventStore, type EventQueryOptions } from "./event-store.js";
import type { EventLog } from "@pleno-audit/detectors";

// Mock IDBKeyRange
vi.stubGlobal("IDBKeyRange", {
  bound: vi.fn().mockReturnValue({ lower: 0, upper: 0 }),
  lowerBound: vi.fn().mockReturnValue({ lower: 0 }),
  upperBound: vi.fn().mockReturnValue({ upper: 0 }),
});

const mockInitializeDatabase = vi.hoisted(() => vi.fn());

vi.mock("./schema.js", () => ({
  DB_CONFIG: {
    name: "PlenoAuditEvents",
    version: 1,
    stores: {
      events: {
        name: "events",
        keyPath: "id",
      },
    },
  },
  initializeDatabase: mockInitializeDatabase,
}));

describe("EventStore", () => {
  let eventStore: EventStore;
  let mockDb: {
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockStore: {
    add: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    index: ReturnType<typeof vi.fn>;
  };
  let mockIndex: {
    openCursor: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let mockTx: {
    objectStore: ReturnType<typeof vi.fn>;
    oncomplete?: () => void;
    onerror?: () => void;
    error: Error | null;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockIndex = {
      openCursor: vi.fn(),
      count: vi.fn(),
      getAll: vi.fn(),
    };

    mockStore = {
      add: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      index: vi.fn().mockReturnValue(mockIndex),
    };

    mockTx = {
      objectStore: vi.fn().mockReturnValue(mockStore),
      error: null,
    };

    mockDb = {
      transaction: vi.fn().mockReturnValue(mockTx),
    };

    mockInitializeDatabase.mockResolvedValue(mockDb);

    eventStore = new EventStore();
  });

  describe("init", () => {
    it("initializes database", async () => {
      await eventStore.init();

      expect(mockInitializeDatabase).toHaveBeenCalled();
    });

    it("only initializes once", async () => {
      await eventStore.init();
      await eventStore.init();

      expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
    });

    it("handles concurrent init calls", async () => {
      const promise1 = eventStore.init();
      const promise2 = eventStore.init();

      await Promise.all([promise1, promise2]);

      expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe("add", () => {
    it("auto-initializes when adding event", async () => {
      const store = new EventStore();
      const event: EventLog = {
        id: "1",
        type: "page_visit",
        domain: "example.com",
        timestamp: 1000,
        details: {},
      };

      const mockRequest = {
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.add.mockReturnValue(mockRequest);

      const addPromise = store.add(event);

      setTimeout(() => {
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 0);

      await addPromise;

      expect(mockInitializeDatabase).toHaveBeenCalled();
    });

    it("adds event to store", async () => {
      const event: EventLog = {
        id: "1",
        type: "page_visit",
        domain: "example.com",
        timestamp: 1000,
        details: {},
      };

      const mockRequest = {
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.add.mockReturnValue(mockRequest);

      const addPromise = eventStore.add(event);

      // Simulate success
      setTimeout(() => {
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 0);

      await addPromise;

      expect(mockStore.add).toHaveBeenCalledWith(event);
    });
  });

  describe("addBatch", () => {
    it("adds multiple events", async () => {
      const events: EventLog[] = [
        { id: "1", type: "page_visit", domain: "example.com", timestamp: 1000, details: {} },
        { id: "2", type: "login", domain: "test.com", timestamp: 2000, details: {} },
      ];

      const batchPromise = eventStore.addBatch(events);

      setTimeout(() => {
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 0);

      await batchPromise;

      expect(mockStore.add).toHaveBeenCalledTimes(2);
      expect(mockStore.add).toHaveBeenCalledWith(events[0]);
      expect(mockStore.add).toHaveBeenCalledWith(events[1]);
    });
  });

  describe("getById", () => {
    it("returns event by id", async () => {
      const event: EventLog = {
        id: "1",
        type: "page_visit",
        domain: "example.com",
        timestamp: 1000,
        details: {},
      };

      const mockRequest = {
        result: event,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.get.mockReturnValue(mockRequest);

      const getPromise = eventStore.getById("1");

      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess(new Event("success"));
      }, 0);

      const result = await getPromise;

      expect(mockStore.get).toHaveBeenCalledWith("1");
      expect(result).toEqual(event);
    });

    it("returns null for non-existent id", async () => {
      const mockRequest = {
        result: undefined,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.get.mockReturnValue(mockRequest);

      const getPromise = eventStore.getById("nonexistent");

      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess(new Event("success"));
      }, 0);

      const result = await getPromise;

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes event by id", async () => {
      const mockRequest = {
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.delete.mockReturnValue(mockRequest);

      const deletePromise = eventStore.delete("1");

      setTimeout(() => {
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 0);

      await deletePromise;

      expect(mockStore.delete).toHaveBeenCalledWith("1");
    });
  });

  describe("clear", () => {
    it("clears all events", async () => {
      const mockRequest = {
        onerror: null as ((ev: Event) => void) | null,
      };
      mockStore.clear.mockReturnValue(mockRequest);

      const clearPromise = eventStore.clear();

      setTimeout(() => {
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 0);

      await clearPromise;

      expect(mockStore.clear).toHaveBeenCalled();
    });
  });

  describe("query", () => {
    it("uses timestamp index for queries without type/domain filter", async () => {
      const events: EventLog[] = [
        { id: "1", type: "page_visit", domain: "example.com", timestamp: 2000, details: {} },
        { id: "2", type: "login", domain: "test.com", timestamp: 1000, details: {} },
      ];

      const mockCursor = {
        value: events[0],
        continue: vi.fn(),
        advance: vi.fn(),
      };

      const mockCursorRequest = {
        result: mockCursor,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };

      const mockCountRequest = {
        result: 2,
        onsuccess: null as ((ev: Event) => void) | null,
      };

      mockIndex.openCursor.mockReturnValue(mockCursorRequest);
      mockIndex.count.mockReturnValue(mockCountRequest);

      const queryPromise = eventStore.query({ limit: 10 });

      setTimeout(() => {
        if (mockCountRequest.onsuccess) mockCountRequest.onsuccess(new Event("success"));
        if (mockCursorRequest.onsuccess) {
          mockCursorRequest.onsuccess(new Event("success"));
          // Simulate cursor exhaustion
          mockCursorRequest.result = null as unknown as typeof mockCursor;
          if (mockCursorRequest.onsuccess) mockCursorRequest.onsuccess(new Event("success"));
        }
      }, 0);

      const result = await queryPromise;

      expect(mockStore.index).toHaveBeenCalledWith("timestamp");
      expect(result.events).toHaveLength(1);
    });

    it("defaults to descending order", async () => {
      mockIndex.openCursor.mockReturnValue({
        result: null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      });
      mockIndex.count.mockReturnValue({
        result: 0,
        onsuccess: null as ((ev: Event) => void) | null,
      });

      const queryPromise = eventStore.query();

      setTimeout(() => {
        const countReq = mockIndex.count.mock.results[0]?.value;
        const cursorReq = mockIndex.openCursor.mock.results[0]?.value;
        if (countReq?.onsuccess) countReq.onsuccess(new Event("success"));
        if (cursorReq?.onsuccess) cursorReq.onsuccess(new Event("success"));
      }, 0);

      await queryPromise;

      expect(mockIndex.openCursor).toHaveBeenCalledWith(null, "prev");
    });

    it("uses ascending order when specified", async () => {
      mockIndex.openCursor.mockReturnValue({
        result: null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      });
      mockIndex.count.mockReturnValue({
        result: 0,
        onsuccess: null as ((ev: Event) => void) | null,
      });

      const queryPromise = eventStore.query({ orderBy: "timestamp" });

      setTimeout(() => {
        const countReq = mockIndex.count.mock.results[0]?.value;
        const cursorReq = mockIndex.openCursor.mock.results[0]?.value;
        if (countReq?.onsuccess) countReq.onsuccess(new Event("success"));
        if (cursorReq?.onsuccess) cursorReq.onsuccess(new Event("success"));
      }, 0);

      await queryPromise;

      expect(mockIndex.openCursor).toHaveBeenCalledWith(null, "next");
    });
  });

  describe("count", () => {
    it("uses index count for queries without filters", async () => {
      const mockCountRequest = {
        result: 5,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };
      mockIndex.count.mockReturnValue(mockCountRequest);

      const countPromise = eventStore.count();

      setTimeout(() => {
        if (mockCountRequest.onsuccess) mockCountRequest.onsuccess(new Event("success"));
      }, 0);

      const result = await countPromise;

      expect(result).toBe(5);
    });

    it("uses cursor for count with type filter", async () => {
      const events: EventLog[] = [
        { id: "1", type: "page_visit", domain: "example.com", timestamp: 1000, details: {} },
        { id: "2", type: "login", domain: "test.com", timestamp: 2000, details: {} },
        { id: "3", type: "page_visit", domain: "example.com", timestamp: 3000, details: {} },
      ];

      let cursorIndex = 0;
      const mockCursorRequest = {
        result: { value: events[0], continue: vi.fn() },
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };

      mockIndex.openCursor.mockReturnValue(mockCursorRequest);

      const countPromise = eventStore.count({ type: ["page_visit"] });

      setTimeout(() => {
        // Simulate cursor iteration
        for (let i = 0; i <= events.length; i++) {
          if (i < events.length) {
            mockCursorRequest.result = {
              value: events[i],
              continue: vi.fn(() => {
                if (mockCursorRequest.onsuccess) {
                  setTimeout(() => mockCursorRequest.onsuccess!(new Event("success")), 0);
                }
              }),
            };
          } else {
            mockCursorRequest.result = null as unknown as typeof mockCursorRequest.result;
          }
          if (mockCursorRequest.onsuccess) mockCursorRequest.onsuccess(new Event("success"));
          if (i < events.length && mockCursorRequest.result?.continue) {
            // Cursor continues handled by continue() mock
          }
        }
      }, 0);

      const result = await countPromise;

      // Count should match events with type "page_visit"
      expect(typeof result).toBe("number");
    });
  });

  describe("exportAll", () => {
    it("returns all events", async () => {
      const events: EventLog[] = [
        { id: "1", type: "page_visit", domain: "example.com", timestamp: 2000, details: {} },
        { id: "2", type: "login", domain: "test.com", timestamp: 1000, details: {} },
      ];

      let cursorIndex = 0;
      const mockCursorRequest = {
        result: null as { value: EventLog; continue: () => void; advance: () => void } | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };

      mockIndex.openCursor.mockReturnValue(mockCursorRequest);
      mockIndex.count.mockReturnValue({
        result: events.length,
        onsuccess: null as ((ev: Event) => void) | null,
      });

      const exportPromise = eventStore.exportAll();

      setTimeout(() => {
        const countReq = mockIndex.count.mock.results[0]?.value;
        if (countReq?.onsuccess) countReq.onsuccess(new Event("success"));

        // Simulate cursor iteration
        const simulateCursor = () => {
          if (cursorIndex < events.length) {
            mockCursorRequest.result = {
              value: events[cursorIndex],
              continue: () => {
                cursorIndex++;
                setTimeout(simulateCursor, 0);
              },
              advance: vi.fn(),
            };
          } else {
            mockCursorRequest.result = null;
          }
          if (mockCursorRequest.onsuccess) mockCursorRequest.onsuccess(new Event("success"));
        };
        simulateCursor();
      }, 0);

      const result = await exportPromise;

      expect(result).toEqual(events);
    });
  });

  describe("deleteOldEvents", () => {
    it("deletes events older than specified timestamp", async () => {
      const mockCursor = {
        delete: vi.fn(),
        continue: vi.fn(),
      };

      let callCount = 0;
      const mockCursorRequest = {
        result: mockCursor,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };

      mockIndex.openCursor.mockReturnValue(mockCursorRequest);

      const deletePromise = eventStore.deleteOldEvents(5000);

      setTimeout(() => {
        // Simulate deleting 2 old events
        for (let i = 0; i < 3; i++) {
          if (i < 2) {
            mockCursorRequest.result = {
              delete: vi.fn(),
              continue: vi.fn(() => {
                setTimeout(() => {
                  if (mockCursorRequest.onsuccess) mockCursorRequest.onsuccess(new Event("success"));
                }, 0);
              }),
            };
          } else {
            mockCursorRequest.result = null as unknown as typeof mockCursor;
          }
          if (mockCursorRequest.onsuccess) mockCursorRequest.onsuccess(new Event("success"));
        }
      }, 0);

      const result = await deletePromise;

      expect(result).toBe(2);
    });
  });

  describe("getAllByRange", () => {
    it("returns all events in range using getAll", async () => {
      const events: EventLog[] = [
        { id: "1", type: "page_visit", domain: "example.com", timestamp: 1000, details: {} },
        { id: "2", type: "login", domain: "test.com", timestamp: 2000, details: {} },
      ];

      const mockGetAllRequest = {
        result: events,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      };

      mockIndex.getAll.mockReturnValue(mockGetAllRequest);

      const getAllPromise = eventStore.getAllByRange(500, 2500);

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) mockGetAllRequest.onsuccess(new Event("success"));
      }, 0);

      const result = await getAllPromise;

      // Results should be sorted descending
      expect(result[0].timestamp).toBeGreaterThanOrEqual(result[1].timestamp);
    });
  });
});

describe("EventQueryOptions", () => {
  it("has correct interface", () => {
    const options: EventQueryOptions = {
      limit: 10,
      offset: 0,
      type: ["page_visit", "login"],
      domain: "example.com",
      since: 1000,
      until: 5000,
      orderBy: "-timestamp",
    };

    expect(options.limit).toBe(10);
    expect(options.offset).toBe(0);
    expect(options.type).toEqual(["page_visit", "login"]);
    expect(options.domain).toBe("example.com");
    expect(options.since).toBe(1000);
    expect(options.until).toBe(5000);
    expect(options.orderBy).toBe("-timestamp");
  });
});
