import { describe, expect, it } from "vitest";
import { getStatusBadge, resolveTabFromHash, truncate } from "./utils";

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
    expect(resolveTabFromHash("services")).toBe("services");
    expect(resolveTabFromHash("extensions")).toBe("extensions");
  });

  it("returns null for invalid tab", () => {
    expect(resolveTabFromHash("events")).toBeNull();
    expect(resolveTabFromHash("invalid")).toBeNull();
    expect(resolveTabFromHash("")).toBeNull();
    expect(resolveTabFromHash("overview")).toBeNull();
    expect(resolveTabFromHash("timeline")).toBeNull();
  });
});
