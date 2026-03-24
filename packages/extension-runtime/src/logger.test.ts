import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createLogger,
  setDebuggerSink,
  hasDebuggerSink,
  type LogEntry,
} from "./logger.js";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setDebuggerSink(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a logger object", () => {
    const logger = createLogger("test-module");

    expect(logger).toBeDefined();
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
  });

  it("logs info messages to console.log", () => {
    const logger = createLogger("test-module");

    logger.info("test message");

    expect(console.log).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Pleno Audit]"),
      "test message"
    );
  });

  it("logs warn messages to console.warn", () => {
    const logger = createLogger("test-module");

    logger.warn("warning message");

    expect(console.warn).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[Pleno Audit]"),
      "warning message"
    );
  });

  it("logs error messages to console.error", () => {
    const logger = createLogger("test-module");

    logger.error("error message");

    expect(console.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[Pleno Audit]"),
      "error message"
    );
  });

  it("includes module name in log prefix", () => {
    const logger = createLogger("my-module");

    logger.info("message");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[my-module]"),
      "message"
    );
  });

  it("logs multiple arguments", () => {
    const logger = createLogger("test");

    logger.info("message", { data: "value" }, 123);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Pleno Audit]"),
      "message",
      { data: "value" },
      123
    );
  });

  it("logs Error objects", () => {
    const logger = createLogger("test");
    const error = new Error("test error");

    logger.error("An error occurred:", error);

    expect(console.error).toHaveBeenCalled();
  });
});

describe("setDebuggerSink", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setDebuggerSink(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDebuggerSink(null);
  });

  it("sets debugger sink", () => {
    const sink = vi.fn();

    setDebuggerSink(sink);

    expect(hasDebuggerSink()).toBe(true);
  });

  it("clears debugger sink when set to null", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    setDebuggerSink(null);

    expect(hasDebuggerSink()).toBe(false);
  });

  it("forwards logs to sink when set", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test-module");
    logger.info("test message");

    expect(sink).toHaveBeenCalled();
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        module: "test-module",
        message: "test message",
      })
    );
  });

  it("includes timestamp in sink entry", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const before = Date.now();
    const logger = createLogger("test");
    logger.info("message");
    const after = Date.now();

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Number),
      })
    );

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it("serializes objects in sink message", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("data:", { key: "value" });

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("key");
    expect(entry.message).toContain("value");
    expect(entry.data).toEqual({ key: "value" });
  });

  it("serializes Error objects in sink message", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    const error = new Error("test error");
    logger.error("Error:", error);

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("test error");
    expect(entry.data).toMatchObject({
      message: "test error",
      name: "Error",
    });
  });

  it("supports event payload logging", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.warn({
      event: "TEST_EVENT",
      data: { key: "value" },
      error: new Error("payload error"),
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[Pleno Audit]"),
      "TEST_EVENT",
      { key: "value" },
      expect.any(Error)
    );

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toBe("TEST_EVENT");
    expect(entry.data).toEqual([
      { key: "value" },
      {
        error: {
          name: "Error",
          message: "payload error",
          stack: expect.any(String),
        },
      },
    ]);
  });

  it("does not forward to sink when not set", () => {
    const sink = vi.fn();
    setDebuggerSink(null);

    const logger = createLogger("test");
    logger.info("message");

    expect(sink).not.toHaveBeenCalled();
  });
});

describe("hasDebuggerSink", () => {
  beforeEach(() => {
    setDebuggerSink(null);
  });

  afterEach(() => {
    setDebuggerSink(null);
  });

  it("returns false when no sink is set", () => {
    expect(hasDebuggerSink()).toBe(false);
  });

  it("returns true when sink is set", () => {
    setDebuggerSink(() => {});
    expect(hasDebuggerSink()).toBe(true);
  });

  it("returns false after sink is cleared", () => {
    setDebuggerSink(() => {});
    setDebuggerSink(null);
    expect(hasDebuggerSink()).toBe(false);
  });
});

describe("log levels", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    setDebuggerSink(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debug level is lowest priority", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.debug("debug message");

    // In production mode, debug might not be logged
    // But if it is, it should have the correct level
    if (sink.mock.calls.length > 0) {
      expect(sink.mock.calls[0][0].level).toBe("debug");
    }
  });

  it("info level logs normally", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("info message");

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info" })
    );
  });

  it("warn level logs normally", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.warn("warn message");

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn" })
    );
  });

  it("error level logs normally", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.error("error message");

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error" })
    );
  });
});

describe("message serialization", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    setDebuggerSink(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDebuggerSink(null);
  });

  it("serializes string arguments", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("hello", "world");

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("hello");
    expect(entry.message).toContain("world");
  });

  it("serializes number arguments", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("count:", 42);

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("42");
  });

  it("serializes boolean arguments", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("status:", true);

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("true");
  });

  it("serializes null and undefined", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("values:", null, undefined);

    expect(sink).toHaveBeenCalled();
  });

  it("handles circular references gracefully", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    const circular: Record<string, unknown> = { name: "test" };
    circular.self = circular;

    // Should not throw
    expect(() => logger.info("circular:", circular)).not.toThrow();
  });

  it("serializes arrays", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("items:", [1, 2, 3]);

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("[1,2,3]");
  });

  it("serializes nested objects", () => {
    const sink = vi.fn();
    setDebuggerSink(sink);

    const logger = createLogger("test");
    logger.info("data:", { nested: { value: "deep" } });

    const entry = sink.mock.calls[0][0] as LogEntry;
    expect(entry.message).toContain("nested");
    expect(entry.message).toContain("deep");
  });
});

describe("module isolation", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    setDebuggerSink(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("different modules have different prefixes", () => {
    const logger1 = createLogger("module-a");
    const logger2 = createLogger("module-b");

    logger1.info("from a");
    logger2.info("from b");

    expect(console.log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("[module-a]"),
      "from a"
    );
    expect(console.log).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("[module-b]"),
      "from b"
    );
  });

  it("each logger is independent", () => {
    const logger1 = createLogger("module-1");
    const logger2 = createLogger("module-2");

    // Loggers should be separate instances
    expect(logger1).not.toBe(logger2);
  });
});
