import { describe, expect, it } from "vitest";
import { resolveTabFromHash, truncate } from "./utils";

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

describe("resolveTabFromHash", () => {
  it('maps "permissions" to "extensions"', () => {
    expect(resolveTabFromHash("permissions")).toBe("extensions");
  });

  it("returns valid tab as-is", () => {
    expect(resolveTabFromHash("services")).toBe("services");
    expect(resolveTabFromHash("extensions")).toBe("extensions");
    expect(resolveTabFromHash("alerts")).toBe("alerts");
    expect(resolveTabFromHash("settings")).toBe("settings");
  });

  it("returns null for invalid tab", () => {
    expect(resolveTabFromHash("invalid")).toBeNull();
    expect(resolveTabFromHash("")).toBeNull();
    expect(resolveTabFromHash("overview")).toBeNull();
    expect(resolveTabFromHash("timeline")).toBeNull();
  });
});
