import { describe, expect, it } from "vitest";
import type { EventLog } from "@pleno-audit/casb-types";
import {
  TIMELINE_PERIOD_MS,
  buildDomainStats,
  buildEventStats,
  buildHourlyDistribution,
  filterEventsByCategory,
  getMaxBars,
  getPeakHour,
  normalizeEventTimestamps,
} from "./timeline";

function createEvent(overrides: Partial<EventLog> = {}): EventLog {
  return {
    type: "login_detected",
    domain: "example.com",
    timestamp: Date.now(),
    details: {},
    ...overrides,
  } as EventLog;
}

describe("normalizeEventTimestamps", () => {
  it("converts string timestamp to number", () => {
    const iso = "2024-01-15T12:00:00.000Z";
    const events = [createEvent({ timestamp: iso as unknown as number })];
    const result = normalizeEventTimestamps(events as Array<EventLog & { timestamp: string | number }>);
    expect(typeof result[0].timestamp).toBe("number");
    expect(result[0].timestamp).toBe(new Date(iso).getTime());
  });

  it("passes through number timestamp unchanged", () => {
    const ts = 1700000000000;
    const events = [createEvent({ timestamp: ts })];
    const result = normalizeEventTimestamps(events as Array<EventLog & { timestamp: string | number }>);
    expect(result[0].timestamp).toBe(ts);
  });
});

describe("filterEventsByCategory", () => {
  const events = [
    createEvent({ type: "login_detected" }),
    createEvent({ type: "csp_violation" }),
    createEvent({ type: "ai_prompt_sent" }),
    createEvent({ type: "nrd_detected" }),
  ] as EventLog[];

  it('"all" returns all events', () => {
    expect(filterEventsByCategory(events, "all")).toEqual(events);
  });

  it('"security" returns only security events', () => {
    const result = filterEventsByCategory(events, "security");
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.type)).toEqual(["csp_violation", "nrd_detected"]);
  });

  it("returns empty array when no events match category", () => {
    const sessionOnly = [createEvent({ type: "ai_prompt_sent" })] as EventLog[];
    expect(filterEventsByCategory(sessionOnly, "session")).toEqual([]);
  });
});

describe("buildEventStats", () => {
  it("counts events by type and sorts by count descending", () => {
    const now = Date.now();
    const events = [
      createEvent({ type: "login_detected", timestamp: now }),
      createEvent({ type: "login_detected", timestamp: now }),
      createEvent({ type: "csp_violation", timestamp: now }),
    ] as EventLog[];

    const result = buildEventStats(events, "7d", "#999");
    expect(result[0].type).toBe("login_detected");
    expect(result[0].count).toBe(2);
    expect(result[1].type).toBe("csp_violation");
    expect(result[1].count).toBe(1);
  });

  it("uses fallbackColor when no color defined for type", () => {
    const events = [createEvent({ type: "unknown_type", timestamp: Date.now() })] as EventLog[];
    const result = buildEventStats(events, "7d", "#fallback");
    expect(result[0].color).toBe("#fallback");
  });
});

describe("buildDomainStats", () => {
  it("groups events by domain and returns top10", () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      createEvent({ domain: `domain-${i}.com` }),
    ) as EventLog[];
    const result = buildDomainStats(events);
    expect(result.total).toBe(12);
    expect(result.top10).toHaveLength(10);
  });

  it('uses "(unknown)" for missing domain', () => {
    const events = [createEvent({ domain: "" })] as EventLog[];
    const result = buildDomainStats(events);
    expect(result.top10[0].domain).toBe("(unknown)");
  });
});

describe("buildHourlyDistribution", () => {
  it("returns a 24-element array", () => {
    const result = buildHourlyDistribution([]);
    expect(result).toHaveLength(24);
    expect(result.every((v) => v === 0)).toBe(true);
  });

  it("correctly buckets events by hour", () => {
    const date = new Date(2024, 0, 15, 14, 30, 0);
    const events = [createEvent({ timestamp: date.getTime() })] as EventLog[];
    const result = buildHourlyDistribution(events);
    expect(result[14]).toBe(1);
  });
});

describe("getPeakHour", () => {
  it("returns index of max value", () => {
    const hours = Array(24).fill(0) as number[];
    hours[9] = 5;
    hours[14] = 10;
    expect(getPeakHour(hours)).toBe(14);
  });

  it("returns null when all values are zero", () => {
    expect(getPeakHour(Array(24).fill(0) as number[])).toBeNull();
  });
});

describe("getMaxBars", () => {
  it("returns correct values for hour granularity", () => {
    expect(getMaxBars("hour", "7d")).toBe(48);
    expect(getMaxBars("hour", "30d")).toBe(72);
    expect(getMaxBars("hour", "90d")).toBe(96);
  });

  it("returns correct values for day granularity", () => {
    expect(getMaxBars("day", "7d")).toBe(7);
    expect(getMaxBars("day", "30d")).toBe(30);
    expect(getMaxBars("day", "90d")).toBe(90);
  });

  it("returns correct values for week granularity", () => {
    expect(getMaxBars("week", "7d")).toBe(1);
    expect(getMaxBars("week", "30d")).toBe(5);
    expect(getMaxBars("week", "90d")).toBe(13);
  });
});

describe("TIMELINE_PERIOD_MS", () => {
  it("has correct millisecond values", () => {
    expect(TIMELINE_PERIOD_MS["7d"]).toBe(7 * 24 * 60 * 60 * 1000);
    expect(TIMELINE_PERIOD_MS["30d"]).toBe(30 * 24 * 60 * 60 * 1000);
    expect(TIMELINE_PERIOD_MS["90d"]).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
