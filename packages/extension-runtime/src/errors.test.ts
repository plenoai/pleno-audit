import { describe, it, expect } from "vitest";
import {
  PlenoAuditError,
  RetryableError,
  StorageError,
  ConfigError,
  errorMessage,
} from "./errors.js";

describe("PlenoAuditError", () => {
  it("has correct name and code", () => {
    const error = new PlenoAuditError("test", "TEST_CODE");

    expect(error.name).toBe("PlenoAuditError");
    expect(error.code).toBe("TEST_CODE");
    expect(error.message).toBe("test");
  });

  it("preserves cause chain", () => {
    const cause = new Error("root cause");
    const error = new PlenoAuditError("wrapper", "WRAP", { cause });

    expect(error.cause).toBe(cause);
  });

  it("is instanceof Error", () => {
    const error = new PlenoAuditError("test", "CODE");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PlenoAuditError);
  });
});

describe("RetryableError", () => {
  it("is instanceof PlenoAuditError", () => {
    const error = new RetryableError("transient failure");

    expect(error).toBeInstanceOf(PlenoAuditError);
    expect(error).toBeInstanceOf(Error);
  });

  it("has code RETRYABLE", () => {
    const error = new RetryableError("transient failure");

    expect(error.code).toBe("RETRYABLE");
    expect(error.name).toBe("RetryableError");
  });

  it("preserves cause", () => {
    const cause = new Error("channel closed");
    const error = new RetryableError("retry me", { cause });

    expect(error.cause).toBe(cause);
  });
});

describe("StorageError", () => {
  it("is instanceof PlenoAuditError with correct code", () => {
    const error = new StorageError("disk full");

    expect(error).toBeInstanceOf(PlenoAuditError);
    expect(error.code).toBe("STORAGE_ERROR");
    expect(error.name).toBe("StorageError");
  });
});

describe("ConfigError", () => {
  it("is instanceof PlenoAuditError with correct code", () => {
    const error = new ConfigError("invalid config");

    expect(error).toBeInstanceOf(PlenoAuditError);
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.name).toBe("ConfigError");
  });
});

describe("errorMessage", () => {
  it("extracts message from Error", () => {
    expect(errorMessage(new Error("hello"))).toBe("hello");
  });

  it("extracts message from PlenoAuditError", () => {
    expect(errorMessage(new RetryableError("retry"))).toBe("retry");
  });

  it("converts string to string", () => {
    expect(errorMessage("raw string")).toBe("raw string");
  });

  it("converts null to 'null'", () => {
    expect(errorMessage(null)).toBe("null");
  });

  it("converts undefined to 'undefined'", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("converts object to string representation", () => {
    expect(errorMessage({ key: "value" })).toBe("[object Object]");
  });

  it("converts number to string", () => {
    expect(errorMessage(42)).toBe("42");
  });
});
