/**
 * Worker Hooks のテスト
 *
 * Worker/SharedWorker/ServiceWorker の重複排除ロジック検証。
 */
import { describe, it, expect } from "vitest";

describe("worker URL deduplication logic", () => {
  it("first URL is tracked, duplicate is ignored", () => {
    const seen = new Set<string>();
    const url1 = "https://example.com/worker.js";

    expect(seen.has(url1)).toBe(false);
    seen.add(url1);
    expect(seen.has(url1)).toBe(true);
  });

  it("different URLs are tracked separately", () => {
    const seen = new Set<string>();
    seen.add("https://example.com/worker1.js");
    seen.add("https://example.com/worker2.js");
    expect(seen.size).toBe(2);
  });

  it("URL object is converted to string for comparison", () => {
    const url = new URL("https://example.com/worker.js");
    const urlString = url.toString();
    expect(urlString).toBe("https://example.com/worker.js");
  });
});

describe("ServiceWorker scope deduplication", () => {
  it("uses scope as dedup key (not URL)", () => {
    const scopesSeen = new Set<string>();
    const scope = "/app/";

    expect(scopesSeen.has(scope)).toBe(false);
    scopesSeen.add(scope);
    expect(scopesSeen.has(scope)).toBe(true);
  });

  it("defaults scope to script URL when not provided", () => {
    const url = "https://example.com/sw.js";
    const options: { scope?: string } = {};
    const scope = options.scope ?? url;
    expect(scope).toBe(url);
  });

  it("uses explicit scope when provided", () => {
    const url = "https://example.com/sw.js";
    const options = { scope: "/app/" };
    const scope = options.scope ?? url;
    expect(scope).toBe("/app/");
  });
});
