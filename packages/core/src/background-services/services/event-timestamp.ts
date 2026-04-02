interface TimestampLogger {
  warn?: (message: string, ...args: unknown[]) => void;
}

interface ResolveTimestampOptions {
  fallback?: number;
  logger?: TimestampLogger;
  context?: string;
}

function parseTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function resolveEventTimestamp(
  value: unknown,
  options?: ResolveTimestampOptions,
): number {
  const resolved = parseTimestamp(value);
  if (resolved !== null) {
    return resolved;
  }

  const fallback = options?.fallback ?? Date.now();
  options?.logger?.warn?.("Event timestamp fallback to ingest time.", {
    context: options?.context || "unknown",
    inputType: typeof value,
    fallback,
  });
  return fallback;
}
