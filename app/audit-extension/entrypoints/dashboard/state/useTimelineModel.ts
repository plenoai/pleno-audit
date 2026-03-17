import { useEffect, useMemo, useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import type { TimeGranularity } from "../../../components/TimelineChart";
import type { EventCategory } from "../domain/events";
import { EVENT_COLOR_MAP } from "../domain/events";
import {
  type TimelinePeriod,
  TIMELINE_PERIOD_MS,
  buildDomainStats,
  buildEventStats,
  buildHourlyDistribution,
  filterEventsByCategory,
  getMaxBars,
  getPeakHour,
  normalizeEventTimestamps,
} from "../domain/timeline";

interface UseTimelineModelOptions {
  period: TimelinePeriod;
  category: EventCategory | "all";
  granularity: TimeGranularity;
  fallbackColor: string;
}

export function useTimelineModel({
  period,
  category,
  granularity,
  fallbackColor,
}: UseTimelineModelOptions) {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      setLoading(true);
      try {
        const since = Date.now() - TIMELINE_PERIOD_MS[period];

        const result = await chrome.runtime.sendMessage({
          type: "GET_EVENTS",
          data: { limit: 5000, since },
        });

        if (cancelled) return;

        if (result?.events) {
          const normalizedEvents = normalizeEventTimestamps(result.events);
          setEvents(normalizedEvents);
        } else {
          setEvents([]);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const filteredEvents = useMemo(
    () => filterEventsByCategory(events, category),
    [events, category]
  );

  const eventStats = useMemo(
    () => buildEventStats(filteredEvents, period, fallbackColor),
    [filteredEvents, period, fallbackColor]
  );

  const domainStats = useMemo(() => buildDomainStats(filteredEvents), [filteredEvents]);

  const hourlyDistribution = useMemo(
    () => buildHourlyDistribution(filteredEvents),
    [filteredEvents]
  );

  const peakHour = useMemo(
    () => getPeakHour(hourlyDistribution),
    [hourlyDistribution]
  );

  const maxBars = useMemo(
    () => getMaxBars(granularity, period),
    [granularity, period]
  );

  return {
    events,
    loading,
    filteredEvents,
    eventStats,
    domainStats,
    hourlyDistribution,
    peakHour,
    maxBars,
    typeColors: EVENT_COLOR_MAP,
  };
}
