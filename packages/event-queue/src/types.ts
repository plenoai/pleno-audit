/**
 * Event Queue Types
 *
 * Storage-backed persistent queue for Chrome extension event delivery.
 * Decouples event production (content scripts) from consumption (background SW).
 */

export type Priority = "high" | "low";

export interface QueueItem<T = unknown> {
  /** Unique event ID for idempotent processing */
  id: string;
  /** Event type discriminator */
  type: string;
  /** Event timestamp (ms since epoch) */
  ts: number;
  /** Priority for eviction decisions */
  priority: Priority;
  /** Tab ID that produced this event */
  tabId: number;
  /** URL of the page that produced this event */
  senderUrl?: string;
  /** Event payload */
  data: T;
}

export interface ProducerConfig {
  /** Maximum items per tab queue. Default: 150 */
  maxPerTab?: number;
  /** Threshold (0-1) at which low-priority items are evicted. Default: 0.8 */
  evictionThreshold?: number;
}

export interface ConsumerConfig {
  /** Items processed per chunk before yielding. Default: 20 */
  chunkSize?: number;
}

/**
 * Minimal storage adapter interface.
 * Abstracts chrome.storage.local for testability.
 */
export interface StorageAdapter {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export const QUEUE_KEY_PREFIX = "eq:";

export const DEFAULTS = {
  maxPerTab: 150,
  evictionThreshold: 0.8,
  chunkSize: 20,
} as const;
