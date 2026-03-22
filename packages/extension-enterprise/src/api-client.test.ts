import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";

// Mock logger
vi.mock("@pleno-audit/extension-runtime", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock sso-manager
vi.mock("./sso-manager.js", () => ({
  getSSOManager: vi.fn().mockResolvedValue({
    getSession: vi.fn().mockResolvedValue(null),
  }),
}));

// Mock chrome API
vi.stubGlobal("chrome", {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    getContexts: vi.fn(),
    sendMessage: vi.fn(),
    lastError: null,
  },
  offscreen: {
    createDocument: vi.fn(),
    Reason: { LOCAL_STORAGE: "LOCAL_STORAGE" },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { ApiClient, type QueryOptions } from "./api-client.js";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient({ mode: "remote", remoteEndpoint: "https://api.example.com" });
  });

  describe("constructor", () => {
    it("creates client in remote mode", () => {
      const c = new ApiClient({ mode: "remote", remoteEndpoint: "https://api.test.com" });
      expect(c.getMode()).toBe("remote");
      expect(c.getEndpoint()).toBe("https://api.test.com");
    });

    it("creates client in local mode", () => {
      const c = new ApiClient({ mode: "local" });
      expect(c.getMode()).toBe("local");
      expect(c.getEndpoint()).toBeNull();
    });

    it("handles missing endpoint", () => {
      const c = new ApiClient({ mode: "remote" });
      expect(c.getEndpoint()).toBeNull();
    });
  });

  describe("setMode", () => {
    it("changes mode to local", () => {
      client.setMode("local");
      expect(client.getMode()).toBe("local");
      expect(client.getEndpoint()).toBeNull();
    });

    it("changes mode to remote with endpoint", () => {
      client.setMode("remote", "https://new.api.com");
      expect(client.getMode()).toBe("remote");
      expect(client.getEndpoint()).toBe("https://new.api.com");
    });
  });

  describe("remote requests", () => {
    describe("getReports", () => {
      it("fetches reports without options", async () => {
        const mockResponse = {
          reports: [{ id: "r1", domain: "example.com", timestamp: "2024-01-01", violations: [], requests: [] }],
          lastUpdated: "2024-01-01T00:00:00.000Z",
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await client.getReports();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports",
          expect.objectContaining({
            method: "GET",
            headers: { "Content-Type": "application/json" },
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it("fetches reports with query options", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ reports: [], lastUpdated: "" }),
        });

        await client.getReports({ limit: 10, offset: 5, since: "2024-01-01", until: "2024-12-31" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports?limit=10&offset=5&since=2024-01-01&until=2024-12-31",
          expect.any(Object)
        );
      });
    });

    describe("postReports", () => {
      it("posts reports to server", async () => {
        const reports: CSPReport[] = [
          { id: "r1", domain: "example.com", timestamp: "2024-01-01", violations: [], requests: [] },
        ];
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, totalReports: 1 }),
        });

        const result = await client.postReports(reports);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ reports }),
          })
        );
        expect(result).toEqual({ success: true, totalReports: 1 });
      });
    });

    describe("clearReports", () => {
      it("sends DELETE request", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await client.clearReports();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports",
          expect.objectContaining({ method: "DELETE" })
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe("getStats", () => {
      it("fetches stats from server", async () => {
        const stats = { violations: 10, requests: 20, uniqueDomains: 5 };
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(stats),
        });

        const result = await client.getStats();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/stats",
          expect.any(Object)
        );
        expect(result).toEqual(stats);
      });
    });

    describe("getViolations", () => {
      it("fetches violations with pagination", async () => {
        const violations: CSPViolation[] = [
          { domain: "example.com", directive: "script-src", blockedURL: "https://evil.com", timestamp: "2024-01-01", disposition: "enforce" },
        ];
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ violations, total: 1, hasMore: false }),
        });

        const result = await client.getViolations({ limit: 10 });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports/violations?limit=10",
          expect.any(Object)
        );
        expect(result.violations).toEqual(violations);
      });
    });

    describe("getNetworkRequests", () => {
      it("fetches network requests", async () => {
        const requests: NetworkRequest[] = [
          { url: "https://api.example.com", domain: "api.example.com", method: "GET", timestamp: "2024-01-01" },
        ];
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ requests, total: 1, hasMore: false }),
        });

        const result = await client.getNetworkRequests();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports/network",
          expect.any(Object)
        );
        expect(result.requests).toEqual(requests);
      });
    });

    describe("sync", () => {
      it("syncs without since parameter", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ reports: [], serverTime: "2024-01-01T00:00:00.000Z" }),
        });

        await client.sync();

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/sync",
          expect.any(Object)
        );
      });

      it("syncs with since parameter", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ reports: [], serverTime: "2024-01-01T00:00:00.000Z" }),
        });

        await client.sync("2024-01-01T00:00:00.000Z");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/sync?since=2024-01-01T00%3A00%3A00.000Z",
          expect.any(Object)
        );
      });
    });

    describe("pushAndPull", () => {
      it("sends reports and receives server reports", async () => {
        const reports: CSPReport[] = [
          { id: "local1", domain: "local.com", timestamp: "2024-01-01", violations: [], requests: [] },
        ];
        const serverReports: CSPReport[] = [
          { id: "server1", domain: "server.com", timestamp: "2024-01-02", violations: [], requests: [] },
        ];
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ serverReports, serverTime: "2024-01-02T00:00:00.000Z" }),
        });

        const result = await client.pushAndPull(reports, "2024-01-01T00:00:00.000Z");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/sync",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ reports, clientTime: "2024-01-01T00:00:00.000Z" }),
          })
        );
        expect(result.serverReports).toEqual(serverReports);
      });
    });

    describe("deleteOldReports", () => {
      it("deletes reports before timestamp", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ deleted: 5 }),
        });

        const result = await client.deleteOldReports("2024-01-01T00:00:00.000Z");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/api/v1/reports/old?before=2024-01-01T00%3A00%3A00.000Z",
          expect.objectContaining({ method: "DELETE" })
        );
        expect(result).toBe(5);
      });
    });

    describe("error handling", () => {
      it("throws error on non-ok response", async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

        await expect(client.getReports()).rejects.toThrow("Remote request failed: 500 Internal Server Error");
      });

      it("throws error on network failure", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        await expect(client.getReports()).rejects.toThrow("Network error");
      });
    });

    describe("SSO integration", () => {
      it("adds Authorization header when SSO session exists", async () => {
        const { getSSOManager } = await import("./sso-manager.js");
        vi.mocked(getSSOManager).mockResolvedValue({
          getSession: vi.fn().mockResolvedValue({
            provider: "oidc",
            accessToken: "sso-access-token",
          }),
        } as ReturnType<typeof getSSOManager> extends Promise<infer T> ? T : never);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ reports: [], lastUpdated: "" }),
        });

        await client.getReports();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              "Authorization": "Bearer sso-access-token",
            }),
          })
        );
      });

      it("does not add Authorization header when no SSO session", async () => {
        const { getSSOManager } = await import("./sso-manager.js");
        vi.mocked(getSSOManager).mockResolvedValue({
          getSession: vi.fn().mockResolvedValue(null),
        } as ReturnType<typeof getSSOManager> extends Promise<infer T> ? T : never);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ reports: [], lastUpdated: "" }),
        });

        await client.getReports();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { "Content-Type": "application/json" },
          })
        );
      });
    });
  });

  describe("buildQueryString", () => {
    it("builds empty string for undefined options", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ reports: [], lastUpdated: "" }),
      });

      await client.getReports(undefined);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/reports",
        expect.any(Object)
      );
    });

    it("builds query string with partial options", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ reports: [], lastUpdated: "" }),
      });

      await client.getReports({ limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/v1/reports?limit=50",
        expect.any(Object)
      );
    });
  });

  describe("local mode", () => {
    it("throws error for local mode (no longer supported)", async () => {
      const localClient = new ApiClient({ mode: "local" });

      await expect(localClient.getReports()).rejects.toThrow(
        "Local API mode is no longer supported"
      );
    });
  });
});
