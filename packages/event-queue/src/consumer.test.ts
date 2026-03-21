import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConsumer } from "./consumer.js";
import type { StorageAdapter, QueueItem } from "./types.js";
import { QUEUE_KEY_PREFIX } from "./types.js";

function createMockStorage(): StorageAdapter & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys) {
      if (keys === null) return { ...data };
      const keyList = typeof keys === "string" ? [keys] : keys;
      const result: Record<string, unknown> = {};
      for (const k of keyList) {
        if (k in data) result[k] = data[k];
      }
      return result;
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      const keyList = typeof keys === "string" ? [keys] : keys;
      for (const k of keyList) delete data[k];
    },
  };
}

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    type: "TEST",
    ts: Date.now(),
    priority: "low",
    tabId: 1,
    data: {},
    ...overrides,
  };
}

describe("Consumer", () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("processes all items from multiple tabs", async () => {
    storage.data[`${QUEUE_KEY_PREFIX}1`] = [makeItem({ tabId: 1 }), makeItem({ tabId: 1 })];
    storage.data[`${QUEUE_KEY_PREFIX}2`] = [makeItem({ tabId: 2 })];

    const consumer = createConsumer(storage);
    const handler = vi.fn().mockResolvedValue(undefined);
    const result = await consumer.process(handler);

    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("removes queue key when fully processed", async () => {
    storage.data[`${QUEUE_KEY_PREFIX}1`] = [makeItem()];

    const consumer = createConsumer(storage);
    await consumer.process(async () => {});

    expect(storage.data[`${QUEUE_KEY_PREFIX}1`]).toBeUndefined();
  });

  it("keeps failed items in queue", async () => {
    const good = makeItem({ type: "GOOD" });
    const bad = makeItem({ type: "BAD" });
    storage.data[`${QUEUE_KEY_PREFIX}1`] = [good, bad];

    const consumer = createConsumer(storage);
    const handler = vi.fn().mockImplementation(async (item: QueueItem) => {
      if (item.type === "BAD") throw new Error("fail");
    });

    const result = await consumer.process(handler);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);

    const remaining = storage.data[`${QUEUE_KEY_PREFIX}1`] as QueueItem[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("BAD");
  });

  it("processes high-priority items first", async () => {
    const low = makeItem({ priority: "low", ts: 1000 });
    const high = makeItem({ priority: "high", ts: 2000 });
    storage.data[`${QUEUE_KEY_PREFIX}1`] = [low, high];

    const consumer = createConsumer(storage);
    const order: string[] = [];
    await consumer.process(async (item) => {
      order.push(item.priority);
    });

    expect(order).toEqual(["high", "low"]);
  });

  it("yields after chunkSize items", async () => {
    const items = Array.from({ length: 25 }, (_, i) => makeItem({ type: `E${i}` }));
    storage.data[`${QUEUE_KEY_PREFIX}1`] = items;

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const consumer = createConsumer(storage, { chunkSize: 10 });
    await consumer.process(async () => {});

    // Should yield at least twice (at 10, 20)
    const yieldCalls = setTimeoutSpy.mock.calls.filter(
      ([fn, ms]) => ms === 0,
    );
    expect(yieldCalls.length).toBeGreaterThanOrEqual(2);

    setTimeoutSpy.mockRestore();
  });

  it("skips empty queues", async () => {
    storage.data[`${QUEUE_KEY_PREFIX}1`] = [];
    storage.data["other_key"] = "not a queue";

    const consumer = createConsumer(storage);
    const handler = vi.fn();
    const result = await consumer.process(handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  describe("cleanup", () => {
    it("removes orphan tab queues", async () => {
      storage.data[`${QUEUE_KEY_PREFIX}1`] = [makeItem({ tabId: 1 })];
      storage.data[`${QUEUE_KEY_PREFIX}2`] = [makeItem({ tabId: 2 })];
      storage.data[`${QUEUE_KEY_PREFIX}99`] = [makeItem({ tabId: 99 })];

      const consumer = createConsumer(storage);
      const removed = await consumer.cleanup([1, 2]); // tab 99 is orphan

      expect(removed).toBe(1);
      expect(storage.data[`${QUEUE_KEY_PREFIX}99`]).toBeUndefined();
      expect(storage.data[`${QUEUE_KEY_PREFIX}1`]).toBeDefined();
    });

    it("does nothing when no orphans", async () => {
      storage.data[`${QUEUE_KEY_PREFIX}1`] = [makeItem()];

      const consumer = createConsumer(storage);
      const removed = await consumer.cleanup([1]);

      expect(removed).toBe(0);
    });
  });

  describe("pending", () => {
    it("counts total pending items across tabs", async () => {
      storage.data[`${QUEUE_KEY_PREFIX}1`] = [makeItem(), makeItem()];
      storage.data[`${QUEUE_KEY_PREFIX}2`] = [makeItem()];
      storage.data["unrelated"] = "ignored";

      const consumer = createConsumer(storage);
      expect(await consumer.pending()).toBe(3);
    });

    it("returns 0 when empty", async () => {
      const consumer = createConsumer(storage);
      expect(await consumer.pending()).toBe(0);
    });
  });
});
