import type { EventLog } from "./types";
import type { BackgroundServiceState } from "./state";
import type { NewEvent } from "./types";
import { resolveEventTimestamp } from "../services/event-timestamp";

function generateEventId(): string {
  return crypto.randomUUID();
}

export async function addEvent(_state: BackgroundServiceState, event: NewEvent): Promise<EventLog> {
  const timestamp = resolveEventTimestamp(event.timestamp, {
    logger: _state.logger,
    context: `${event.type}:${event.domain}`,
  });
  return {
    ...event,
    id: generateEventId(),
    timestamp,
  } as EventLog;
}
