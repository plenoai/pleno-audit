/**
 * Base error class for all pleno-audit errors.
 * Provides error code for programmatic handling.
 */
export class PlenoAuditError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PlenoAuditError";
    this.code = code;
  }
}

/**
 * Indicates the operation can be retried.
 * Used for transient failures like message channel disconnections.
 */
export class RetryableError extends PlenoAuditError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "RETRYABLE", options);
    this.name = "RetryableError";
  }
}

/**
 * Storage operation failures (chrome.storage, IndexedDB, ParquetStore).
 */
export class StorageError extends PlenoAuditError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "STORAGE_ERROR", options);
    this.name = "StorageError";
  }
}

/**
 * Configuration validation/access failures.
 */
export class ConfigError extends PlenoAuditError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "CONFIG_ERROR", options);
    this.name = "ConfigError";
  }
}

/**
 * Type-safe extraction of error message from unknown error.
 * Replaces the pattern: error instanceof Error ? error.message : String(error)
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
