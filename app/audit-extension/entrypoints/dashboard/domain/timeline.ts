import type { EventLog } from "@pleno-audit/detectors";
import type { TimeGranularity } from "../../../components/TimelineChart";
import { EVENT_CATEGORIES, getEventColor, getEventLabel } from "./events";
import type { EventCategory } from "./events";

export type TimelinePeriod = "7d" | "30d" | "90d";

export const TIMELINE_PERIOD_MS: Record<TimelinePeriod, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export type EventStat = {
  type: string;
  label: string;
  color: string;
  count: number;
  trend: number;
};

export function normalizeEventTimestamps(
  events: Array<EventLog & { timestamp: string | number }>
): EventLog[] {
  return events.map((event) => ({
    ...event,
    timestamp:
      typeof event.timestamp === "string"
        ? new Date(event.timestamp).getTime()
        : event.timestamp,
  }));
}

export function filterEventsByCategory(events: EventLog[], category: EventCategory | "all") {
  if (category === "all") return events;
  const types = EVENT_CATEGORIES[category];
  return events.filter((event) => types.includes(event.type));
}

export function buildEventStats(
  events: EventLog[],
  period: TimelinePeriod,
  fallbackColor: string
): EventStat[] {
  const stats: Record<string, { count: number; trend: number }> = {};
  const now = Date.now();
  const halfPeriod = TIMELINE_PERIOD_MS[period] / 2;

  for (const event of events) {
    if (!stats[event.type]) {
      stats[event.type] = { count: 0, trend: 0 };
    }
    stats[event.type].count++;

    if (event.timestamp > now - halfPeriod) {
      stats[event.type].trend++;
    } else {
      stats[event.type].trend--;
    }
  }

  return Object.entries(stats)
    .map(([type, data]) => ({
      type,
      label: getEventLabel(type),
      color: getEventColor(type) ?? fallbackColor,
      ...data,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildDomainStats(events: EventLog[]) {
  const stats: Record<string, number> = {};
  for (const event of events) {
    const key = event.domain || "(unknown)";
    stats[key] = (stats[key] || 0) + 1;
  }
  const sorted = Object.entries(stats)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
  return { total: sorted.length, top10: sorted.slice(0, 10) };
}

export function buildHourlyDistribution(events: EventLog[]) {
  const hours = Array(24).fill(0) as number[];
  for (const event of events) {
    const hour = new Date(event.timestamp).getHours();
    hours[hour]++;
  }
  return hours;
}

export function getPeakHour(hourlyDistribution: number[]) {
  let max = 0;
  for (const value of hourlyDistribution) {
    if (value > max) max = value;
  }
  if (max === 0) return null;
  return hourlyDistribution.indexOf(max);
}

export function getMaxBars(granularity: TimeGranularity, period: TimelinePeriod) {
  if (granularity === "hour") {
    return { "7d": 48, "30d": 72, "90d": 96 }[period];
  }
  if (granularity === "day") {
    return { "7d": 7, "30d": 30, "90d": 90 }[period];
  }
  return { "7d": 1, "30d": 5, "90d": 13 }[period];
}
