import type { ParquetEvent, ParquetStore } from "@pleno-audit/parquet-storage";
import type { AsyncHandlerEntry, RuntimeHandlerDependencies } from "./types.js";

type ParquetEventQueryOptions = Parameters<ParquetStore["getEvents"]>[0];

function normalizeEventQueryOptions(data: unknown): Record<string, unknown> {
  const options = typeof data === "object" && data !== null
    ? { ...(data as Record<string, unknown>) }
    : {};

  if (typeof options.since === "number") {
    options.since = new Date(options.since).toISOString();
  }
  if (typeof options.until === "number") {
    options.until = new Date(options.until).toISOString();
  }

  return options;
}

function parseEventDetails(details: unknown, logger?: { warn: (...args: unknown[]) => void }): unknown {
  if (typeof details !== "string") {
    return details;
  }

  try {
    return JSON.parse(details);
  } catch (error) {
    logger?.warn("Failed to parse event details.", error);
    return details;
  }
}

export function createEventStoreHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_EVENTS", {
      execute: async (message) => {
        const store = await deps.getOrInitParquetStore();
        const options = normalizeEventQueryOptions(message.data) as ParquetEventQueryOptions;
        const result = await store.getEvents(options);
        const events = result.data.map((event: ParquetEvent) => ({
          ...event,
          details: parseEventDetails(event.details, deps.logger),
          timestamp: new Date(event.timestamp).toISOString(),
        }));
        return { events, total: result.total, hasMore: result.hasMore };
      },
      fallback: () => ({ events: [], total: 0, hasMore: false }),
    }],
    ["GET_EVENTS_COUNT", {
      execute: async (message) => {
        const store = await deps.getOrInitParquetStore();
        const options = normalizeEventQueryOptions(message.data) as ParquetEventQueryOptions;
        const result = await store.getEvents(options);
        return { count: result.total };
      },
      fallback: () => ({ count: 0 }),
    }],
    ["CLEAR_EVENTS", {
      execute: async () => {
        const store = await deps.getOrInitParquetStore();
        await store.clearAll();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
  ];
}
