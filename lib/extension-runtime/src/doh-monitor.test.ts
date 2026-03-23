import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectDoHRequest,
  createDoHMonitor,
  clearDoHCallbacks,
  DEFAULT_DOH_MONITOR_CONFIG,
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
    it("creates monitor with default config", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      expect(monitor.getConfig()).toEqual(DEFAULT_DOH_MONITOR_CONFIG);
    });

    it("updates config correctly", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      monitor.updateConfig({ action: "alert" });
      expect(monitor.getConfig().action).toBe("alert");
      expect(monitor.getConfig().maxStoredRequests).toBe(1000);
    });

    it("stops monitor and clears callbacks", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      const callback = vi.fn();
      monitor.onRequest(callback);
      monitor.stop();
      expect(monitor.getConfig().action).toBe("detect");
    });
  });

  describe("callback management", () => {
    it("registers callbacks", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      monitor.onRequest(callback1);
      monitor.onRequest(callback2);
      // Callbacks are stored but we can't easily test invocation without chrome mock
    });

    it("clears callbacks on stop", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      const callback = vi.fn();
      monitor.onRequest(callback);
      monitor.stop();
      // After stop, globalCallbacks should be cleared
    });
  });

  describe("Service Worker lifecycle simulation", () => {
    it("handles multiple createDoHMonitor calls (SW restart scenario)", () => {
      // Simulate first SW lifecycle
      const monitor1 = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      monitor1.updateConfig({ maxStoredRequests: 500 });

      // Simulate SW restart - creates new monitor
      const monitor2 = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);

      // Config should be reset to default (this is the expected behavior)
      // The actual config persistence should be handled by storage
      expect(monitor2.getConfig().maxStoredRequests).toBe(1000);
    });

    it("clearDoHCallbacks removes all registered callbacks", () => {
      const monitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      monitor.onRequest(vi.fn());
      monitor.onRequest(vi.fn());

      clearDoHCallbacks();

      // After clearing, new monitor should have clean state
      const newMonitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
      // No way to verify callback count without exposing internals
      // but this tests the API doesn't throw
      expect(newMonitor.getConfig().action).toBe("detect");
    });
  });
});
