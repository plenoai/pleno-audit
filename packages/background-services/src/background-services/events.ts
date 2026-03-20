import type { EventLog } from "./types.js";
import type { BackgroundServiceState } from "./state.js";
import type { NewEvent } from "./types.js";
import { resolveEventTimestamp } from "../services/event-timestamp.js";

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
