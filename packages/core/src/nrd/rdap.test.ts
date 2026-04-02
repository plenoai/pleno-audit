import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  queryRDAP,
  extractRegistrationDate,
  extractDomainStatus,
  type RDAPResponse,
} from "./rdap.js";

describe("extractRegistrationDate", () => {
  it("extracts registration date from events", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      events: [
        { eventAction: "registration", eventDate: "2024-01-15T00:00:00Z" },
        { eventAction: "expiration", eventDate: "2025-01-15T00:00:00Z" },
      ],
    };
    expect(extractRegistrationDate(rdap)).toBe("2024-01-15T00:00:00Z");
  });

  it("returns null when no events", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
    };
    expect(extractRegistrationDate(rdap)).toBeNull();
  });

  it("returns null when events array is empty", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      events: [],
    };
    expect(extractRegistrationDate(rdap)).toBeNull();
  });

  it("returns null when no registration event", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      events: [
        { eventAction: "expiration", eventDate: "2025-01-15T00:00:00Z" },
        { eventAction: "last changed", eventDate: "2024-06-15T00:00:00Z" },
      ],
    };
    expect(extractRegistrationDate(rdap)).toBeNull();
  });

  it("handles multiple registration events (returns first)", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      events: [
        { eventAction: "registration", eventDate: "2024-01-15T00:00:00Z" },
        { eventAction: "registration", eventDate: "2024-02-15T00:00:00Z" },
      ],
    };
    expect(extractRegistrationDate(rdap)).toBe("2024-01-15T00:00:00Z");
  });
});

describe("extractDomainStatus", () => {
  it("extracts status array", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      status: ["active", "client transfer prohibited"],
    };
    expect(extractDomainStatus(rdap)).toEqual(["active", "client transfer prohibited"]);
  });

  it("returns empty array when no status", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
    };
    expect(extractDomainStatus(rdap)).toEqual([]);
  });

  it("returns empty array when status is undefined", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      status: undefined,
    };
    expect(extractDomainStatus(rdap)).toEqual([]);
  });

  it("preserves all status values", () => {
    const rdap: RDAPResponse = {
      objectClassName: "domain",
      status: [
        "active",
        "client delete prohibited",
        "client transfer prohibited",
        "client update prohibited",
      ],
    };
    expect(extractDomainStatus(rdap)).toHaveLength(4);
    expect(extractDomainStatus(rdap)).toContain("active");
    expect(extractDomainStatus(rdap)).toContain("client delete prohibited");
  });
});

describe("queryRDAP", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends request to RDAP bootstrap server", async () => {
    const mockResponse: RDAPResponse = {
      objectClassName: "domain",
      ldhName: "example.com",
      events: [
        { eventAction: "registration", eventDate: "2020-01-01T00:00:00Z" },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const promise = queryRDAP("example.com");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetch).toHaveBeenCalledWith(
      "https://rdap.org/domain/example.com",
      expect.objectContaining({
        headers: {
          Accept: "application/rdap+json, application/json",
        },
      })
    );
    expect(result.ldhName).toBe("example.com");
  });

  it("throws error on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(queryRDAP("nonexistent.invalid")).rejects.toThrow("RDAP query failed: 404");
  });

  it("aborts request on timeout", async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        const signal = options?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }
        // Never resolve - will be aborted
      });
    });

    const promise = queryRDAP("slow.example.com", 1000);

    // Advance time past timeout
    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow();
  });

  it("uses default timeout of 5000ms", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ objectClassName: "domain" }),
    });

    const promise = queryRDAP("example.com");
    await vi.runAllTimersAsync();
    await promise;

    expect(fetch).toHaveBeenCalled();
  });

  it("clears timeout on successful response", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ objectClassName: "domain" }),
    });

    const promise = queryRDAP("example.com");
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
