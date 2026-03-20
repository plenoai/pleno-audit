import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";
import { createLogger } from "./logger.js";
import { getSSOManager } from "./sso-manager.js";

const logger = createLogger("api-client");

export type ConnectionMode = "local" | "remote";

export interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface ApiClientConfig {
  mode: ConnectionMode;
  remoteEndpoint?: string;
}

export class ApiClient {
  private mode: ConnectionMode;
  private endpoint: string | null;

  constructor(config: ApiClientConfig) {
    this.mode = config.mode;
    this.endpoint = config.remoteEndpoint || null;
  }

  async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    if (this.mode === "remote" && this.endpoint) {
      return this.remoteRequest(path, options);
    }
    throw new Error("Local API mode is no longer supported. Use remote mode with an endpoint.");
  }

  private async remoteRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    try {
      const ssoManager = await getSSOManager();
      const session = await ssoManager.getSession();
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
        logger.debug("SSO auth header added to remote request");
      }
    } catch {
      logger.debug("No SSO session available for remote request");
    }

    const response = await fetch(`${this.endpoint}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Remote request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  setMode(mode: ConnectionMode, endpoint?: string): void {
    this.mode = mode;
    this.endpoint = endpoint || null;
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  getEndpoint(): string | null {
    return this.endpoint;
  }

  private buildQueryString(options?: QueryOptions): string {
    if (!options) return "";
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.offset !== undefined) params.set("offset", String(options.offset));
    if (options.since) params.set("since", options.since);
    if (options.until) params.set("until", options.until);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async getReports(options?: QueryOptions): Promise<{ reports: CSPReport[]; total?: number; hasMore?: boolean; lastUpdated: string }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports${qs}`);
  }

  async postReports(reports: CSPReport[]): Promise<{ success: boolean; totalReports: number }> {
    return this.request("/api/v1/reports", {
      method: "POST",
      body: { reports },
    });
  }

  async clearReports(): Promise<{ success: boolean }> {
    return this.request("/api/v1/reports", { method: "DELETE" });
  }

  async getStats(): Promise<{ violations: number; requests: number; uniqueDomains: number }> {
    return this.request("/api/v1/stats");
  }

  async getViolations(options?: QueryOptions): Promise<{ violations: CSPViolation[]; total?: number; hasMore?: boolean }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports/violations${qs}`);
  }

  async getNetworkRequests(options?: QueryOptions): Promise<{ requests: NetworkRequest[]; total?: number; hasMore?: boolean }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports/network${qs}`);
  }

  async sync(since?: string): Promise<{ reports: CSPReport[]; serverTime: string }> {
    const path = since ? `/api/v1/sync?since=${encodeURIComponent(since)}` : "/api/v1/sync";
    return this.request(path);
  }

  async pushAndPull(
    reports: CSPReport[],
    clientTime: string
  ): Promise<{ serverReports: CSPReport[]; serverTime: string }> {
    return this.request("/api/v1/sync", {
      method: "POST",
      body: { reports, clientTime },
    });
  }

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    const result = await this.request<{ deleted: number }>(`/api/v1/reports/old?before=${encodeURIComponent(beforeTimestamp)}`, {
      method: "DELETE",
    });
    return result.deleted;
  }
}

let apiClientInstance: ApiClient | null = null;

export async function getApiClient(): Promise<ApiClient> {
  if (apiClientInstance) return apiClientInstance;

  const config = await chrome.storage.local.get(["connectionMode", "remoteEndpoint"]) as Record<string, unknown>;
  apiClientInstance = new ApiClient({
    mode: (config.connectionMode as ConnectionMode) || "remote",
    remoteEndpoint: config.remoteEndpoint as string | undefined,
  });

  return apiClientInstance;
}

export async function updateApiClientConfig(mode: ConnectionMode, endpoint?: string): Promise<void> {
  await chrome.storage.local.set({
    connectionMode: mode,
    remoteEndpoint: endpoint || null,
  });

  if (apiClientInstance) {
    apiClientInstance.setMode(mode, endpoint);
  }
}
