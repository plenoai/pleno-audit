import { describe, expect, it } from "vitest";
import { getPeriodMs, getStatusBadge, resolveTabFromHash, truncate } from "./utils";

describe("truncate", () => {
  it("truncates long strings with ellipsis", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcde...");
  });

  it("returns unchanged string when within limit", () => {
    expect(truncate("abc", 5)).toBe("abc");
  });

  it("returns empty string for empty input", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("returns empty string for falsy input", () => {
    expect(truncate(undefined as unknown as string, 5)).toBe("");
    expect(truncate(null as unknown as string, 5)).toBe("");
  });
});

describe("getPeriodMs", () => {
  it("returns correct ms for 1h", () => {
    expect(getPeriodMs("1h")).toBe(3_600_000);
  });

  it("returns correct ms for 24h", () => {
    expect(getPeriodMs("24h")).toBe(86_400_000);
  });

  it("returns correct ms for 7d", () => {
    expect(getPeriodMs("7d")).toBe(604_800_000);
  });

  it("returns correct ms for 30d", () => {
    expect(getPeriodMs("30d")).toBe(2_592_000_000);
  });

  it("returns MAX_SAFE_INTEGER for all", () => {
    expect(getPeriodMs("all")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("getStatusBadge", () => {
  it('returns danger when nrd > 0', () => {
    expect(getStatusBadge(1, 0, 0).variant).toBe("danger");
  });

  it('returns warning when violations > 50', () => {
    expect(getStatusBadge(0, 51, 0).variant).toBe("warning");
  });

  it('returns info when ai > 0', () => {
    expect(getStatusBadge(0, 0, 1).variant).toBe("info");
  });

  it('returns success when all zero', () => {
    const result = getStatusBadge(0, 0, 0);
    expect(result.variant).toBe("success");
    expect(result.dot).toBe(true);
  });
});

describe("resolveTabFromHash", () => {
  it('maps "permissions" to "extensions"', () => {
    expect(resolveTabFromHash("permissions")).toBe("extensions");
  });

  it("returns valid tab as-is", () => {
    expect(resolveTabFromHash("overview")).toBe("overview");
    expect(resolveTabFromHash("timeline")).toBe("timeline");
    expect(resolveTabFromHash("connections")).toBe("connections");
  });

  it("returns null for invalid tab", () => {
    expect(resolveTabFromHash("invalid")).toBeNull();
    expect(resolveTabFromHash("")).toBeNull();
  });
});
