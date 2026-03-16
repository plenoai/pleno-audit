import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";
import type { LocalApiResponse } from "./offscreen/db-schema.js";
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

const LOCAL_REQUEST_MAX_RETRIES = 1;

type OffscreenPhase = "idle" | "creating" | "ready";

class OffscreenDocGuard {
  private phase: OffscreenPhase = "idle";
  private createPromise: Promise<void> | null = null;
  private readyResolvers: (() => void)[] = [];

  markReady(): void {
    this.phase = "ready";
    this.createPromise = null;
    const resolvers = this.readyResolvers;
    this.readyResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }

  reset(): void {
    this.phase = "idle";
    this.createPromise = null;
    this.readyResolvers = [];
  }

  get isReady(): boolean {
    return this.phase === "ready";
  }

  async ensure(): Promise<void> {
    if (this.phase === "ready") return;

    if (this.phase === "creating" && this.createPromise) {
      await this.createPromise;
      return;
    }

    this.phase = "creating";
    this.createPromise = (async () => {
      if (this.phase === "ready") return;

      try {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: [chrome.offscreen.Reason.LOCAL_STORAGE],
          justification: "Running local parquet-storage database",
        });
        await this.waitForReady();
      } catch (error) {
        if (error instanceof Error && (
          error.message.includes("already exists") ||
          error.message.includes("Only a single offscreen document")
        )) {
          this.phase = "ready";
          return;
        }
        this.phase = "idle";
        throw error;
      }
    })();

    try {
      await this.createPromise;
    } finally {
      this.createPromise = null;
    }
  }

  private waitForReady(timeout = 15000): Promise<void> {
    if (this.phase === "ready") return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        logger.error("Offscreen document did not respond within timeout");
        reject(new Error("Offscreen ready timeout"));
      }, timeout);

      this.readyResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

const offscreenGuard = new OffscreenDocGuard();

export function markOffscreenReady(): void {
  offscreenGuard.markReady();
}

function resetOffscreenState(): void {
  offscreenGuard.reset();
}

function isRetryableLocalRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("A listener indicated an asynchronous response by returning true")
    || message.includes("message channel closed before a response was received")
    || message.includes("The message port closed before a response was received")
    || message.includes("Could not establish connection. Receiving end does not exist")
    || message.includes("Local server not initialized")
  );
}

export async function ensureOffscreenDocument(): Promise<void> {
  return offscreenGuard.ensure();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function sendLocalApiMessage<T>(
  request: { method: string; path: string; body?: unknown },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = generateId();

    chrome.runtime.sendMessage(
      {
        type: "LOCAL_API_REQUEST",
        id,
        request,
      },
      (response: LocalApiResponse | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("No response from LOCAL_API_REQUEST"));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.data as T);
      }
    );
  });
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
    return this.localRequest(path, options);
  }

  private async remoteRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Add SSO authentication header if available
    try {
      const ssoManager = await getSSOManager();
      const session = await ssoManager.getSession();
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
        logger.debug("SSO auth header added to remote request");
      }
    } catch (error) {
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

  private async localRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
    await ensureOffscreenDocument();
    const request = {
      method: options.method || "GET",
      path,
      body: options.body,
    };

    let attempt = 0;
    while (true) {
      try {
        return await sendLocalApiMessage<T>(request);
      } catch (error) {
        const canRetry = attempt < LOCAL_REQUEST_MAX_RETRIES && isRetryableLocalRequestError(error);
        if (!canRetry) {
          throw error;
        }

        logger.warn("LOCAL_API_REQUEST failed with message channel error, retrying once");
        attempt += 1;
        resetOffscreenState();
        await ensureOffscreenDocument();
      }
    }
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
    mode: (config.connectionMode as ConnectionMode) || "local",
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
