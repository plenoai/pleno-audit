import { describe, it, expect, beforeEach } from "vitest";
import { createProducer } from "./producer.js";
import type { QueueAdapter, QueueItem } from "./types.js";
import { QUEUE_KEY_PREFIX } from "./types.js";

function createMockStorage(): QueueAdapter & { data: Record<string, unknown> } {
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

describe("Producer", () => {
  let storage: ReturnType<typeof createMockStorage>;
  const TAB_ID = 42;
  const key = `${QUEUE_KEY_PREFIX}${TAB_ID}`;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("enqueues a single event", async () => {
    const producer = createProducer(storage, TAB_ID);
    await producer.enqueue("XSS_DETECTED", { url: "http://evil.com" }, "high");

    const queue = storage.data[key] as QueueItem[];
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe("XSS_DETECTED");
    expect(queue[0].priority).toBe("high");
    expect(queue[0].tabId).toBe(TAB_ID);
    expect(queue[0].data).toEqual({ url: "http://evil.com" });
  });

  it("defaults to low priority", async () => {
    const producer = createProducer(storage, TAB_ID);
    await producer.enqueue("COOKIE_ACCESS", {});

    const queue = storage.data[key] as QueueItem[];
    expect(queue[0].priority).toBe("low");
  });

  it("enqueues batch", async () => {
    const producer = createProducer(storage, TAB_ID);
    await producer.enqueueBatch([
      { type: "A", data: 1, priority: "high" },
      { type: "B", data: 2 },
      { type: "C", data: 3 },
    ]);

    const queue = storage.data[key] as QueueItem[];
    expect(queue).toHaveLength(3);
    expect(queue[0].type).toBe("A");
    expect(queue[1].priority).toBe("low");
  });

  it("evicts low-priority items at threshold", async () => {
    const producer = createProducer(storage, TAB_ID, {
      maxPerTab: 10,
      evictionThreshold: 0.5, // threshold at 5
    });

    // Fill with 4 low + 1 high = 5 items → threshold met
    for (let i = 0; i < 4; i++) {
      await producer.enqueue("LOW", { i }, "low");
    }
    await producer.enqueue("HIGH", {}, "high");

    // At threshold: low-priority evicted, only high remains
    const queue = storage.data[key] as QueueItem[];
    expect(queue).toHaveLength(1);
    expect(queue[0].priority).toBe("high");
  });

  it("hard caps at maxPerTab", async () => {
    const producer = createProducer(storage, TAB_ID, {
      maxPerTab: 5,
      evictionThreshold: 1.0, // disable soft eviction
    });

    for (let i = 0; i < 10; i++) {
      await producer.enqueue("HIGH", { i }, "high");
    }

    const queue = storage.data[key] as QueueItem[];
    // Each enqueue: push 1 item, if >= maxPerTab → slice to keep newest (maxPerTab - 1) + new = maxPerTab
    // After 5th: [0,1,2,3,4] (5 items, at cap → slice to 4, then push 5th already done)
    // The slice happens before push of new item? No: push then backpressure.
    // push(5th) → len=5 → slice(1) → [1,2,3,4] (4 items)
    // push(6th) → [1,2,3,4,5] → len=5 → slice(1) → [2,3,4,5]
    // ... push(10th=i9) → [6,7,8,9] (4 items)
    expect(queue.length).toBeLessThanOrEqual(5);
    // Should keep the newest items
    expect((queue[queue.length - 1].data as { i: number }).i).toBe(9);
  });

  it("reports queue size", async () => {
    const producer = createProducer(storage, TAB_ID);
    expect(await producer.size()).toBe(0);

    await producer.enqueue("A", {});
    await producer.enqueue("B", {});
    expect(await producer.size()).toBe(2);
  });

  it("generates unique IDs", async () => {
    const producer = createProducer(storage, TAB_ID);
    await producer.enqueueBatch([
      { type: "A", data: 1 },
      { type: "B", data: 2 },
      { type: "C", data: 3 },
    ]);

    const queue = storage.data[key] as QueueItem[];
    const ids = new Set(queue.map((q) => q.id));
    expect(ids.size).toBe(3);
  });

  it("isolates different tabs", async () => {
    const p1 = createProducer(storage, 100);
    const p2 = createProducer(storage, 200);

    await p1.enqueue("FROM_TAB_100", {});
    await p2.enqueue("FROM_TAB_200", {});

    const q1 = storage.data[`${QUEUE_KEY_PREFIX}100`] as QueueItem[];
    const q2 = storage.data[`${QUEUE_KEY_PREFIX}200`] as QueueItem[];

    expect(q1).toHaveLength(1);
    expect(q1[0].type).toBe("FROM_TAB_100");
    expect(q2).toHaveLength(1);
    expect(q2[0].type).toBe("FROM_TAB_200");
  });

  it("serializes concurrent writes", async () => {
    const producer = createProducer(storage, TAB_ID);

    // Fire 10 concurrent enqueues
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => producer.enqueue("CONCURRENT", { i })),
    );

    const queue = storage.data[key] as QueueItem[];
    expect(queue).toHaveLength(10);
  });
});
