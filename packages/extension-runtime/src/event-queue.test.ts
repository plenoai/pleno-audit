import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventQueue } from "./event-queue.js";
import type { EventQueueDeps, EventQueueConfig } from "./event-queue.js";

function createMockDeps(overrides: Partial<EventQueueDeps> = {}): EventQueueDeps {
  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    isRuntimeAvailable: vi.fn(() => true),
    sendEvent: vi.fn(async () => {}),
    fireEvent: vi.fn(),
    scheduleTimeout: vi.fn((cb: () => void, _ms: number) => {
      cb();
      return 1;
    }),
    clearTimeout: vi.fn(),
    ...overrides,
  };
}

describe("EventQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic push and flush", () => {
    it("enqueues event and sends via sendEvent on flush", async () => {
      const sendEvent = vi.fn(async () => {});
      const deps = createMockDeps({ sendEvent });
      const queue = createEventQueue(deps);

      queue.push("XSS_DETECTED", { url: "https://evil.com" });

      // scheduleTimeout triggers flush immediately in mock
      expect(sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "XSS_DETECTED",
          data: expect.objectContaining({ url: "https://evil.com", source: "security-bridge" }),
        }),
      );
    });

    it("tracks queue size", () => {
      // Use a deps that does NOT auto-flush so we can observe size
      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999), // don't call cb
      });
      const queue = createEventQueue(deps);

      expect(queue.size).toBe(0);
      queue.push("XSS_DETECTED", {});
      expect(queue.size).toBe(1);
    });
  });

  describe("backpressure: queue overflow", () => {
    it("drops low-priority events when queue is full", () => {
      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps, { maxQueue: 5 });

      for (let i = 0; i < 5; i++) {
        queue.push("XSS_DETECTED", { i });
      }
      expect(queue.size).toBe(5);

      // Low-priority event should be dropped
      queue.push("DOM_SCRAPING_DETECTED", { dropped: true });
      expect(queue.size).toBe(5);
    });

    it("accepts high-priority events when full by evicting oldest", () => {
      // Use high-priority types to fill queue (no throttling)
      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps, { maxQueue: 3 });

      queue.push("XSS_DETECTED", { i: 0 });
      queue.push("SUPPLY_CHAIN_RISK_DETECTED", { i: 1 });
      queue.push("FULLSCREEN_PHISHING_DETECTED", { i: 2 });
      expect(queue.size).toBe(3);

      // Another high-priority event evicts oldest
      queue.push("CREDENTIAL_THEFT_DETECTED", { critical: true });
      expect(queue.size).toBe(3);
    });
  });

  describe("low-priority throttling", () => {
    it("throttles repeated low-priority events within interval", () => {
      const now = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps);

      queue.push("DOM_SCRAPING_DETECTED", { first: true });
      expect(queue.size).toBe(1);

      // Same type within 800ms → throttled
      vi.spyOn(Date, "now").mockReturnValue(now + 500);
      queue.push("DOM_SCRAPING_DETECTED", { second: true });
      expect(queue.size).toBe(1); // still 1, second was throttled

      // After 800ms → allowed
      vi.spyOn(Date, "now").mockReturnValue(now + 900);
      queue.push("DOM_SCRAPING_DETECTED", { third: true });
      expect(queue.size).toBe(2);

      vi.restoreAllMocks();
    });
  });

  describe("flushSync: page unload", () => {
    it("sends events via fireEvent synchronously", () => {
      const fireEvent = vi.fn();
      const deps = createMockDeps({
        fireEvent,
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps);

      queue.push("XSS_DETECTED", { a: 1 });
      queue.push("CREDENTIAL_THEFT_DETECTED", { b: 2 });
      expect(fireEvent).not.toHaveBeenCalled();

      queue.flushSync();
      expect(fireEvent).toHaveBeenCalledTimes(2);
      expect(queue.size).toBe(0);
    });

    it("respects maxUnloadBatch limit", () => {
      const fireEvent = vi.fn();
      const deps = createMockDeps({
        fireEvent,
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps, { maxUnloadBatch: 2 });

      for (let i = 0; i < 5; i++) {
        queue.push("XSS_DETECTED", { i });
      }

      queue.flushSync();
      expect(fireEvent).toHaveBeenCalledTimes(2);
    });

    it("does nothing when runtime is unavailable", () => {
      const fireEvent = vi.fn();
      const isRuntimeAvailable = vi.fn(() => false);
      const deps = createMockDeps({ fireEvent, isRuntimeAvailable });
      const queue = createEventQueue(deps);

      queue.flushSync();
      expect(fireEvent).not.toHaveBeenCalled();
    });
  });

  describe("runtime unavailability", () => {
    it("silently drops events when runtime is unavailable", () => {
      const deps = createMockDeps({
        isRuntimeAvailable: vi.fn(() => false),
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps);

      queue.push("XSS_DETECTED", {});
      expect(queue.size).toBe(0);
    });
  });

  describe("teardown", () => {
    it("clears queue and stops accepting events", () => {
      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps);

      queue.push("XSS_DETECTED", {});
      expect(queue.size).toBe(1);

      queue.teardown();
      expect(queue.size).toBe(0);

      queue.push("XSS_DETECTED", {});
      expect(queue.size).toBe(0);
    });
  });

  describe("sendEvent failure", () => {
    it("tears down queue on send failure", async () => {
      let flushCb: (() => void) | undefined;
      const deps = createMockDeps({
        sendEvent: vi.fn(async () => { throw new Error("disconnected"); }),
        scheduleTimeout: vi.fn((cb: () => void) => {
          flushCb = cb;
          return 1;
        }),
      });
      const queue = createEventQueue(deps);

      queue.push("XSS_DETECTED", {});
      // Trigger deferred flush
      flushCb?.();
      // Wait for async flush
      await vi.waitFor(() => {
        expect(queue.size).toBe(0);
      });
    });
  });

  describe("high-load detection", () => {
    it("increases throttle interval after notifyLongTask", () => {
      const now = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      const deps = createMockDeps({
        scheduleTimeout: vi.fn(() => 999),
      });
      const queue = createEventQueue(deps);

      queue.notifyLongTask();

      queue.push("DOM_SCRAPING_DETECTED", { first: true });
      expect(queue.size).toBe(1);

      // Within 2000ms high-load throttle → rejected
      vi.spyOn(Date, "now").mockReturnValue(now + 1500);
      queue.push("DOM_SCRAPING_DETECTED", { second: true });
      expect(queue.size).toBe(1);

      // After 2000ms → allowed
      vi.spyOn(Date, "now").mockReturnValue(now + 2100);
      queue.push("DOM_SCRAPING_DETECTED", { third: true });
      expect(queue.size).toBe(2);

      vi.restoreAllMocks();
    });
  });
});
