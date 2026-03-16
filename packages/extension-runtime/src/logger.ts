/**
 * Logger utility for consistent logging across the extension
 *
 * Features:
 * - Log level filtering (debug only in dev mode)
 * - Module-based prefixes
 * - Optional debugger sink for WebSocket forwarding
 */

declare const process: { env?: Record<string, string | undefined> } | undefined;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEventPayload {
  event: string;
  data?: unknown;
  error?: unknown;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PREFIX = "[Pleno Audit]";

// Debugger sink for forwarding logs to WebSocket
let debuggerSink: ((entry: LogEntry) => void) | null = null;

/**
 * Set the debugger sink for forwarding logs
 * Called by debug-bridge when WebSocket is connected
 */
export function setDebuggerSink(
  sink: ((entry: LogEntry) => void) | null
): void {
  debuggerSink = sink;
}

/**
 * Check if debugger sink is set
 */
export function hasDebuggerSink(): boolean {
  return debuggerSink !== null;
}

function getMinLevel(): LogLevel {
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).__PLENO_DEV__) {
    return "debug";
  }
  if (typeof process !== "undefined" && process?.env?.NODE_ENV === "development") {
    return "debug";
  }
  return "info";
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

/**
 * Serialize error objects for logging
 */
function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function serializeValue(value: unknown): string {
  if (value instanceof Error) {
    return serializeError(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isLogEventPayload(value: unknown): value is LogEventPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "event" in value &&
    typeof (value as { event?: unknown }).event === "string"
  );
}

function toSerializable(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const seen = new WeakSet<object>();
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue) => {
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }
        if (typeof currentValue === "bigint") {
          return currentValue.toString();
        }
        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }
        return currentValue;
      })
    );
  } catch {
    return serializeValue(value);
  }
}

function formatLegacySinkData(args: unknown[]): unknown {
  if (args.length <= 1) return undefined;
  const dataArgs = args.slice(1).map(toSerializable);
  return dataArgs.length === 1 ? dataArgs[0] : dataArgs;
}

interface NormalizedLog {
  consoleArgs: unknown[];
  message: string;
  data?: unknown;
}

function normalizeLogArgs(args: unknown[]): NormalizedLog {
  if (args.length === 0) {
    return { consoleArgs: [], message: "" };
  }

  const [first, ...rest] = args;
  if (isLogEventPayload(first)) {
    const consoleArgs: unknown[] = [first.event];
    const sinkData: unknown[] = [];

    if (first.data !== undefined) {
      consoleArgs.push(first.data);
      sinkData.push(first.data);
    }
    if (first.error !== undefined) {
      consoleArgs.push(first.error);
      sinkData.push({ error: first.error });
    }
    if (rest.length > 0) {
      for (const arg of rest) {
        consoleArgs.push(arg);
        sinkData.push(arg);
      }
    }

    return {
      consoleArgs,
      message: first.event,
      data: sinkData.length === 0
        ? undefined
        : toSerializable(sinkData.length === 1 ? sinkData[0] : sinkData),
    };
  }

  return {
    consoleArgs: args,
    message: args.map(serializeValue).join(" "),
    data: formatLegacySinkData(args),
  };
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string): Logger {
  const log = (level: LogLevel, ...args: unknown[]) => {
    if (!shouldLog(level)) return;

    const normalized = normalizeLogArgs(args);
    const formatted = [`${PREFIX}[${module}]`, ...normalized.consoleArgs];

    // Console output
    switch (level) {
      case "debug":
        console.debug(...formatted);
        break;
      case "info":
        console.log(...formatted);
        break;
      case "warn":
        console.warn(...formatted);
        break;
      case "error":
        console.error(...formatted);
        break;
    }

    // Forward to debugger if connected
    if (debuggerSink) {
      debuggerSink({
        timestamp: Date.now(),
        level,
        module,
        message: normalized.message,
        data: normalized.data,
      });
    }
  };

  return {
    debug: (...args) => log("debug", ...args),
    info: (...args) => log("info", ...args),
    warn: (...args) => log("warn", ...args),
    error: (...args) => log("error", ...args),
  };
}
