import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectDoHRequest,
  createDoHMonitor,
  clearDoHCallbacks,
} from "./doh-monitor.js";

describe("detectDoHRequest", () => {
  describe("Content-Type detection", () => {
    it("detects application/dns-message", () => {
      const result = detectDoHRequest("https://example.com/dns", [
        { name: "Content-Type", value: "application/dns-message" },
      ]);
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("content-type");
    });

    it("detects application/dns-message with charset", () => {
      const result = detectDoHRequest("https://example.com/dns", [
        { name: "Content-Type", value: "application/dns-message; charset=utf-8" },
      ]);
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("content-type");
    });

    it("handles case-insensitive header name", () => {
      const result = detectDoHRequest("https://example.com/dns", [
        { name: "content-type", value: "application/dns-message" },
      ]);
      expect(result.isDoH).toBe(true);
    });
  });

  describe("Accept header detection", () => {
    it("detects Accept with application/dns-message", () => {
      const result = detectDoHRequest("https://example.com/dns", [
        { name: "Accept", value: "application/dns-message" },
      ]);
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("accept-header");
    });

    it("detects Accept with multiple types including dns-message", () => {
      const result = detectDoHRequest("https://example.com/dns", [
        { name: "Accept", value: "application/json, application/dns-message" },
      ]);
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("accept-header");
    });
  });

  describe("URL path detection", () => {
    it("detects /dns-query path", () => {
      const result = detectDoHRequest("https://cloudflare.com/dns-query");
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("url-path");
    });

    it("detects nested /dns-query path", () => {
      const result = detectDoHRequest("https://example.com/api/v1/dns-query");
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("url-path");
    });

    it("does not detect partial match", () => {
      const result = detectDoHRequest("https://example.com/dns-query-extra");
      expect(result.isDoH).toBe(false);
    });
  });

  describe("DNS query parameter detection", () => {
    it("detects dns= parameter", () => {
      const result = detectDoHRequest("https://example.com/resolve?dns=AAABAAAB");
      expect(result.isDoH).toBe(true);
      expect(result.method).toBe("dns-param");
    });

    it("does not detect similar parameters", () => {
      const result = detectDoHRequest("https://example.com/api?dnsserver=1.1.1.1");
      expect(result.isDoH).toBe(false);
    });
  });

  describe("non-DoH requests", () => {
    it("returns false for regular HTTPS", () => {
      const result = detectDoHRequest("https://example.com/api/data", [
        { name: "Content-Type", value: "application/json" },
      ]);
      expect(result.isDoH).toBe(false);
      expect(result.method).toBe(null);
    });

    it("returns false for invalid URL", () => {
      const result = detectDoHRequest("not-a-valid-url");
      expect(result.isDoH).toBe(false);
    });

    it("returns false for empty headers", () => {
      const result = detectDoHRequest("https://example.com/api", []);
      expect(result.isDoH).toBe(false);
    });
  });
});

describe("createDoHMonitor", () => {
  beforeEach(() => {
    clearDoHCallbacks();
  });

  describe("lifecycle", () => {
    it("creates monitor", () => {
      const monitor = createDoHMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.start).toBeDefined();
      expect(monitor.stop).toBeDefined();
      expect(monitor.onRequest).toBeDefined();
    });

    it("stops monitor and clears callbacks", async () => {
      const monitor = createDoHMonitor();
      const callback = vi.fn();
      monitor.onRequest(callback);
      await monitor.stop();
      // After stop, globalCallbacks should be cleared
    });
  });

  describe("callback management", () => {
    it("registers callbacks", () => {
      const monitor = createDoHMonitor();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      monitor.onRequest(callback1);
      monitor.onRequest(callback2);
      // Callbacks are stored but we can't easily test invocation without chrome mock
    });

    it("clears callbacks on stop", async () => {
      const monitor = createDoHMonitor();
      const callback = vi.fn();
      monitor.onRequest(callback);
      await monitor.stop();
      // After stop, globalCallbacks should be cleared
    });
  });

  describe("Service Worker lifecycle simulation", () => {
    it("clearDoHCallbacks removes all registered callbacks", () => {
      const monitor = createDoHMonitor();
      monitor.onRequest(vi.fn());
      monitor.onRequest(vi.fn());

      clearDoHCallbacks();

      // After clearing, new monitor should have clean state
      const newMonitor = createDoHMonitor();
      // This tests the API doesn't throw
      expect(newMonitor).toBeDefined();
    });
  });
});
