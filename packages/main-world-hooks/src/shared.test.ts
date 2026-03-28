/**
 * shared.ts の純粋ロジック部分のテスト
 *
 * テスト対象: getBodySize（body サイズ推定）
 * テスト対象外: emitSecurityEvent（window.dispatchEvent依存）、
 *              scheduleNetworkInspection（requestIdleCallback依存）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// window / DOM のモックを最小限で設定
const mockDispatchEvent = vi.fn();
vi.stubGlobal("window", {
  dispatchEvent: mockDispatchEvent,
  requestIdleCallback: (cb: () => void) => { cb(); return 0; },
});
vi.stubGlobal("CustomEvent", class MockCustomEvent {
  constructor(public type: string, public options?: unknown) {}
});
vi.stubGlobal("dispatchEvent", mockDispatchEvent);

import { createSharedHookUtils } from "./shared.js";

describe("getBodySize", () => {
  const { getBodySize } = createSharedHookUtils();

  it("returns 0 for null/undefined", () => {
    expect(getBodySize(null)).toBe(0);
    expect(getBodySize(undefined)).toBe(0);
  });

  it("returns string length for string body", () => {
    expect(getBodySize("hello")).toBe(5);
    expect(getBodySize("")).toBe(0);
  });

  it("returns blob.size for Blob body", () => {
    const blob = new Blob(["test data"], { type: "text/plain" });
    expect(getBodySize(blob)).toBe(9);
  });

  it("returns byteLength for ArrayBuffer body", () => {
    const buffer = new ArrayBuffer(16);
    expect(getBodySize(buffer)).toBe(16);
  });

  it("returns byteLength for TypedArray body", () => {
    const arr = new Uint8Array(32);
    expect(getBodySize(arr)).toBe(32);
  });

  it("returns 0 for FormData (cannot estimate without iteration)", () => {
    const fd = new FormData();
    fd.append("key", "value");
    expect(getBodySize(fd)).toBe(0);
  });

  it("returns 0 for plain objects", () => {
    expect(getBodySize({ key: "value" })).toBe(0);
  });
});

describe("scheduleNetworkInspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips GET requests (no event emitted)", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/data",
      method: "GET",
      initiator: "fetch",
      body: null,
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it("skips HEAD requests", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/data",
      method: "HEAD",
      initiator: "fetch",
      body: null,
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it("normalizes method to uppercase", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/data",
      method: "get",
      initiator: "fetch",
      body: null,
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it("emits event for POST requests", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/submit",
      method: "POST",
      initiator: "fetch",
      body: "data",
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("emits event for PUT requests", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/update",
      method: "PUT",
      initiator: "xhr",
      body: "data",
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("defaults empty method to GET (skipped)", () => {
    const { scheduleNetworkInspection } = createSharedHookUtils();
    scheduleNetworkInspection({
      url: "https://api.example.com/data",
      method: "",
      initiator: "fetch",
      body: null,
      pageUrl: "https://example.com",
    });
    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });
});
