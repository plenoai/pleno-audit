/**
 * Queue Producer - Content script side
 *
 * Writes events to chrome.storage.local as a persistent queue.
 * Per-tab key partitioning eliminates write contention.
 * Works regardless of background SW state.
 */

import {
  type QueueItem,
  type Priority,
  type ProducerConfig,
  type QueueAdapter,
  QUEUE_KEY_PREFIX,
  DEFAULTS,
} from "./types.js";

let idCounter = 0;

function generateId(): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  return `${Date.now()}-${idCounter++}-${random.toString(36)}`;
}

export interface ProducerContext {
  senderUrl?: string;
}

export interface Producer {
  enqueue<T>(type: string, data: T, priority?: Priority): Promise<void>;
  enqueueBatch<T>(items: Array<{ type: string; data: T; priority?: Priority }>): Promise<void>;
  setContext(ctx: ProducerContext): void;
  size(): Promise<number>;
}

export function createProducer(
  adapter: QueueAdapter,
  tabId: number,
  config?: ProducerConfig,
): Producer {
  const maxPerTab = config?.maxPerTab ?? DEFAULTS.maxPerTab;
  const evictionThreshold = Math.floor(
    maxPerTab * (config?.evictionThreshold ?? DEFAULTS.evictionThreshold),
  );
  const onEviction = config?.onEviction;
  const key = `${QUEUE_KEY_PREFIX}${tabId}`;
  let senderUrl: string | undefined;

  // Serialize writes to this tab's queue key
  let writeChain = Promise.resolve();

  function serialWrite(fn: () => Promise<void>): Promise<void> {
    writeChain = writeChain.then(fn, fn);
    return writeChain;
  }

  async function readQueue(): Promise<QueueItem[]> {
    const data = await adapter.get(key);
    return (data[key] as QueueItem[] | undefined) ?? [];
  }

  function applyBackpressure(queue: QueueItem[]): QueueItem[] {
    const beforeLen = queue.length;
    if (queue.length >= evictionThreshold) {
      queue = queue.filter((item) => item.priority !== "low");
      const evicted = beforeLen - queue.length;
      if (evicted > 0) onEviction?.(evicted, "low-priority");
    }
    if (queue.length >= maxPerTab) {
      const evicted = queue.length - maxPerTab + 1;
      queue = queue.slice(evicted);
      if (evicted > 0) onEviction?.(evicted, "overflow");
    }
    return queue;
  }

  return {
    enqueue<T>(type: string, data: T, priority: Priority = "low"): Promise<void> {
      return serialWrite(async () => {
        let queue = await readQueue();

        const item: QueueItem<T> = {
          id: generateId(),
          type,
          ts: Date.now(),
          priority,
          tabId,
          senderUrl,
          data,
        };

        queue.push(item);
        queue = applyBackpressure(queue);
        await adapter.set({ [key]: queue });
      });
    },

    enqueueBatch<T>(
      items: Array<{ type: string; data: T; priority?: Priority }>,
    ): Promise<void> {
      return serialWrite(async () => {
        let queue = await readQueue();

        const now = Date.now();
        for (const { type, data, priority } of items) {
          queue.push({
            id: generateId(),
            type,
            ts: now,
            priority: priority ?? "low",
            tabId,
            senderUrl,
            data,
          });
        }

        queue = applyBackpressure(queue);
        await adapter.set({ [key]: queue });
      });
    },

    setContext(ctx: ProducerContext): void {
      senderUrl = ctx.senderUrl;
    },

    async size(): Promise<number> {
      const queue = await readQueue();
      return queue.length;
    },
  };
}
