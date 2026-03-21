/**
 * Queue Consumer - Background SW side
 *
 * Reads and processes events from per-tab queue partitions.
 * Designed to be triggered by chrome.alarms.
 * Failed items remain in queue for retry.
 */

import {
  type QueueItem,
  type ConsumerConfig,
  type StorageAdapter,
  QUEUE_KEY_PREFIX,
  DEFAULTS,
} from "./types.js";

export type ProcessFn = (item: QueueItem) => Promise<void>;

export interface ProcessResult {
  processed: number;
  failed: number;
  remaining: number;
}

export interface Consumer {
  process(handler: ProcessFn): Promise<ProcessResult>;
  cleanup(activeTabIds: number[]): Promise<number>;
  pending(): Promise<number>;
}

export function createConsumer(
  storage: StorageAdapter,
  config?: ConsumerConfig,
): Consumer {
  const chunkSize = config?.chunkSize ?? DEFAULTS.chunkSize;

  async function getAllQueueKeys(): Promise<string[]> {
    const all = await storage.get(null);
    return Object.keys(all).filter((k) => k.startsWith(QUEUE_KEY_PREFIX));
  }

  return {
    async process(handler: ProcessFn): Promise<ProcessResult> {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(QUEUE_KEY_PREFIX));

      let processed = 0;
      let failed = 0;
      let remaining = 0;

      for (const key of keys) {
        const queue = all[key] as QueueItem[] | undefined;
        if (!queue?.length) continue;

        // Priority sort: high first, then by timestamp (oldest first)
        queue.sort(
          (a, b) =>
            (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) ||
            a.ts - b.ts,
        );

        const succeeded: Set<string> = new Set();
        let chunkCount = 0;

        for (const item of queue) {
          try {
            await handler(item);
            succeeded.add(item.id);
            processed++;
          } catch {
            failed++;
          }

          chunkCount++;
          if (chunkCount >= chunkSize) {
            chunkCount = 0;
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        const rest = queue.filter((item) => !succeeded.has(item.id));
        remaining += rest.length;

        if (rest.length === 0) {
          await storage.remove(key);
        } else {
          await storage.set({ [key]: rest });
        }
      }

      return { processed, failed, remaining };
    },

    async cleanup(activeTabIds: number[]): Promise<number> {
      const keys = await getAllQueueKeys();
      const activeSet = new Set(activeTabIds.map((id) => `${QUEUE_KEY_PREFIX}${id}`));
      const orphanKeys = keys.filter((k) => !activeSet.has(k));

      if (orphanKeys.length > 0) {
        await storage.remove(orphanKeys);
      }

      return orphanKeys.length;
    },

    async pending(): Promise<number> {
      const all = await storage.get(null);
      let count = 0;
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(QUEUE_KEY_PREFIX) && Array.isArray(value)) {
          count += value.length;
        }
      }
      return count;
    },
  };
}
