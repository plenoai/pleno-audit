import { describe, expect, it } from "vitest";

import {
  type DNRRateLimiterState,
  checkDNRRateLimit,
  isAlreadyCoveredByWebRequest,
  pruneRecentHits,
} from "./rate-limiter.js";

function createInitialState(overrides?: Partial<DNRRateLimiterState>): DNRRateLimiterState {
  return {
    dnrQuotaWindowStart: 0,
    dnrCallCount: 0,
    lastDNRCallTime: 0,
    ...overrides,
  };
}

describe("checkDNRRateLimit", () => {
  it("returns allowed=true when no limits hit", () => {
    const state = createInitialState();
    // now is well past the quota window and min interval
    const now = 11 * 60 * 1000;

    const result = checkDNRRateLimit(state, now);

    expect(result.allowed).toBe(true);
    expect(result.next.dnrCallCount).toBe(1);
    expect(result.next.lastDNRCallTime).toBe(now);
  });

  it("resets quota window when interval elapsed", () => {
    const windowStart = 1000;
    const state = createInitialState({
      dnrQuotaWindowStart: windowStart,
      dnrCallCount: 10,
      lastDNRCallTime: windowStart,
    });
    // 10 minutes + 1ms later -> window resets
    const now = windowStart + 10 * 60 * 1000;

    const result = checkDNRRateLimit(state, now);

    expect(result.allowed).toBe(true);
    expect(result.next.dnrQuotaWindowStart).toBe(now);
    expect(result.next.dnrCallCount).toBe(1);
  });

  it("returns allowed=false when max calls reached within window", () => {
    const now = 100_000;
    const state = createInitialState({
      dnrQuotaWindowStart: now - 1000, // within window
      dnrCallCount: 18,
      lastDNRCallTime: now - 60_000, // min interval satisfied
    });

    const result = checkDNRRateLimit(state, now);

    expect(result.allowed).toBe(false);
    expect(result.next.dnrCallCount).toBe(18); // unchanged
  });

  it("returns allowed=false when called too quickly (min interval)", () => {
    const now = 100_000;
    const state = createInitialState({
      dnrQuotaWindowStart: now - 1000,
      dnrCallCount: 1,
      lastDNRCallTime: now - 10_000, // only 10s ago, need 35s
    });

    const result = checkDNRRateLimit(state, now);

    expect(result.allowed).toBe(false);
    expect(result.next.dnrCallCount).toBe(1); // unchanged
  });

  it("correctly increments call count across successive allowed calls", () => {
    let state = createInitialState();
    const baseTime = 11 * 60 * 1000;

    // First call
    let result = checkDNRRateLimit(state, baseTime);
    expect(result.allowed).toBe(true);
    expect(result.next.dnrCallCount).toBe(1);

    // Second call after min interval
    state = result.next;
    result = checkDNRRateLimit(state, baseTime + 36_000);
    expect(result.allowed).toBe(true);
    expect(result.next.dnrCallCount).toBe(2);

    // Third call
    state = result.next;
    result = checkDNRRateLimit(state, baseTime + 72_000);
    expect(result.allowed).toBe(true);
    expect(result.next.dnrCallCount).toBe(3);
  });

  it("does not mutate the input state", () => {
    const state = createInitialState();
    const now = 11 * 60 * 1000;

    checkDNRRateLimit(state, now);

    expect(state.dnrCallCount).toBe(0);
    expect(state.lastDNRCallTime).toBe(0);
    expect(state.dnrQuotaWindowStart).toBe(0);
  });
});

describe("isAlreadyCoveredByWebRequest", () => {
  it("returns true when hit exists after since", () => {
    const recentHits = new Map([["abc:1", 5000]]);

    expect(isAlreadyCoveredByWebRequest(recentHits, "abc", 1, 4000)).toBe(true);
  });

  it("returns true when hit timestamp equals since", () => {
    const recentHits = new Map([["abc:1", 5000]]);

    expect(isAlreadyCoveredByWebRequest(recentHits, "abc", 1, 5000)).toBe(true);
  });

  it("returns false when hit is before since", () => {
    const recentHits = new Map([["abc:1", 3000]]);

    expect(isAlreadyCoveredByWebRequest(recentHits, "abc", 1, 4000)).toBe(false);
  });

  it("returns false when no hit exists for key", () => {
    const recentHits = new Map([["abc:1", 5000]]);

    expect(isAlreadyCoveredByWebRequest(recentHits, "xyz", 2, 1000)).toBe(false);
  });

  it("returns false for empty map", () => {
    const recentHits = new Map<string, number>();

    expect(isAlreadyCoveredByWebRequest(recentHits, "abc", 1, 0)).toBe(false);
  });
});

describe("pruneRecentHits", () => {
  it("removes entries older than cutoff", () => {
    const recentHits = new Map([
      ["a:1", 1000],
      ["b:2", 2000],
      ["c:3", 5000],
    ]);

    pruneRecentHits(recentHits, 3000);

    expect(recentHits.size).toBe(1);
    expect(recentHits.has("c:3")).toBe(true);
  });

  it("keeps entries newer than cutoff", () => {
    const recentHits = new Map([
      ["a:1", 5000],
      ["b:2", 6000],
    ]);

    pruneRecentHits(recentHits, 3000);

    expect(recentHits.size).toBe(2);
  });

  it("removes entries exactly at cutoff", () => {
    const recentHits = new Map([["a:1", 3000]]);

    pruneRecentHits(recentHits, 3001);

    expect(recentHits.size).toBe(0);
  });

  it("keeps entries exactly at cutoff boundary", () => {
    const recentHits = new Map([["a:1", 3000]]);

    pruneRecentHits(recentHits, 3000);

    // 3000 < 3000 is false, so entry is kept
    expect(recentHits.size).toBe(1);
  });

  it("handles empty map", () => {
    const recentHits = new Map<string, number>();

    pruneRecentHits(recentHits, 5000);

    expect(recentHits.size).toBe(0);
  });
});
