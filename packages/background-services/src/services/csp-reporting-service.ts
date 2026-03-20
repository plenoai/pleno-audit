import type {
  CSPConfig,
  CSPGenerationOptions,
  CSPReport,
  CSPViolation,
  GeneratedCSPPolicy,
  NetworkRequest,
} from "@pleno-audit/csp";
import { CSPAnalyzer, CSPReporter, DEFAULT_CSP_CONFIG, type GeneratedCSPByDomain } from "@pleno-audit/csp";
import type { QueryOptions } from "@pleno-audit/extension-runtime";
import { resolveEventTimestamp } from "./event-timestamp.js";

interface MessageSenderLike {
  tab?: {
    url?: string;
  };
}

interface CSPServiceLogger {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
}

interface ReportsClient {
  postReports: (reports: CSPReport[]) => Promise<void>;
  clearReports: () => Promise<void>;
  getViolations: (options?: QueryOptions) => Promise<{ violations: CSPViolation[]; total: number; hasMore: boolean }>;
  getNetworkRequests: (options?: QueryOptions) => Promise<{ requests: NetworkRequest[]; total: number; hasMore: boolean }>;
  getReports: (options?: QueryOptions) => Promise<{ reports: CSPReport[]; total: number; hasMore: boolean }>;
}

interface CreateCSPReportingServiceParams {
  logger: CSPServiceLogger;
  ensureApiClient: () => Promise<ReportsClient>;
  initStorage: () => Promise<{ cspConfig?: CSPConfig }>;
  saveStorage: (data: { cspConfig: CSPConfig }) => Promise<void>;
  addEvent: (event: {
    type: "csp_violation";
    domain: string;
    timestamp: number;
    details: {
      directive?: string;
      blockedURL?: string;
      disposition?: string;
    };
  }) => Promise<unknown>;
  devReportEndpoint: string;
}

function extractReportsArray(
  result: CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean },
): CSPReport[] {
  return Array.isArray(result) ? result : result.reports;
}

function buildCSPReportsResponse(
  reports: CSPReport[],
  options: { total?: number; hasMore?: boolean; withPagination: boolean },
): CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean } {
  if (!options.withPagination) {
    return reports;
  }
  return {
    reports,
    total: options.total ?? 0,
    hasMore: options.hasMore ?? false,
  };
}

export function createCSPReportingService(params: CreateCSPReportingServiceParams) {
  let cspReporter: CSPReporter | null = null;
  let reportQueue: CSPReport[] = [];
  let cspGenerationTimer: ReturnType<typeof setTimeout> | null = null;

  async function getCSPConfig(): Promise<CSPConfig> {
    const storage = await params.initStorage();
    return storage.cspConfig || DEFAULT_CSP_CONFIG;
  }

  async function saveGeneratedCSPPolicy(result: GeneratedCSPByDomain) {
    await chrome.storage.local.set({ generatedCSPPolicy: result });
  }

  async function getCSPReports(options?: {
    type?: "csp-violation" | "network-request";
    limit?: number;
    offset?: number;
    since?: string;
    until?: string;
  }): Promise<CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean }> {
    try {
      const client = await params.ensureApiClient();

      const queryOptions: QueryOptions = {
        limit: options?.limit,
        offset: options?.offset,
        since: options?.since,
        until: options?.until,
      };

      const hasPaginationParams = Boolean(
        options?.limit !== undefined
        || options?.offset !== undefined
        || options?.since !== undefined
        || options?.until !== undefined,
      );

      if (options?.type === "csp-violation") {
        const result = await client.getViolations(queryOptions);
        return buildCSPReportsResponse(result.violations, {
          total: result.total,
          hasMore: result.hasMore,
          withPagination: hasPaginationParams,
        });
      }

      if (options?.type === "network-request") {
        const result = await client.getNetworkRequests(queryOptions);
        return buildCSPReportsResponse(result.requests, {
          total: result.total,
          hasMore: result.hasMore,
          withPagination: hasPaginationParams,
        });
      }

      const result = await client.getReports(queryOptions);
      return buildCSPReportsResponse(result.reports, {
        total: result.total,
        hasMore: result.hasMore,
        withPagination: hasPaginationParams,
      });
    } catch (error) {
      params.logger.error("Error getting CSP reports:", error);
      return [];
    }
  }

  async function generateCSPPolicy(
    options?: Partial<CSPGenerationOptions>
  ): Promise<GeneratedCSPPolicy> {
    const result = await getCSPReports();
    const cspReports = extractReportsArray(result);
    const analyzer = new CSPAnalyzer(cspReports);
    return analyzer.generatePolicy({
      strictMode: options?.strictMode ?? false,
      includeReportUri: options?.includeReportUri ?? false,
      reportUri: options?.reportUri ?? "",
      defaultSrc: options?.defaultSrc ?? "'self'",
      includeNonce: options?.includeNonce ?? false,
    });
  }

  async function generateCSPPolicyByDomain(
    options?: Partial<CSPGenerationOptions>
  ): Promise<GeneratedCSPByDomain> {
    const result = await getCSPReports();
    const cspReports = extractReportsArray(result);
    const analyzer = new CSPAnalyzer(cspReports);
    return analyzer.generatePolicyByDomain({
      strictMode: options?.strictMode ?? false,
      includeReportUri: options?.includeReportUri ?? false,
      reportUri: options?.reportUri ?? "",
      defaultSrc: options?.defaultSrc ?? "'self'",
      includeNonce: options?.includeNonce ?? false,
    });
  }

  function scheduleCSPPolicyGeneration() {
    if (cspGenerationTimer) {
      clearTimeout(cspGenerationTimer);
    }

    cspGenerationTimer = setTimeout(async () => {
      try {
        const result = await generateCSPPolicyByDomain({
          strictMode: false,
          includeReportUri: true,
        });
        await saveGeneratedCSPPolicy(result);
        params.logger.debug("CSP policy auto-generated", { totalDomains: result.totalDomains });
      } catch (error) {
        params.logger.error("Error auto-generating CSP policy:", error);
      }
    }, 500);
  }

  async function storeCSPReport(report: CSPReport) {
    try {
      const client = await params.ensureApiClient();
      await client.postReports([report]);
      scheduleCSPPolicyGeneration();
    } catch (error) {
      params.logger.error("Error storing report:", error);
    }
  }

  async function handleCSPViolation(
    data: Omit<CSPViolation, "type"> & { type?: string },
    sender: MessageSenderLike
  ): Promise<{ success: boolean; reason?: string }> {
    const config = await getCSPConfig();

    if (!config.enabled || !config.collectCSPViolations) {
      return { success: false, reason: "Disabled" };
    }

    const violation: CSPViolation = {
      type: "csp-violation",
      timestamp: data.timestamp || new Date().toISOString(),
      pageUrl: sender.tab?.url || data.pageUrl,
      directive: data.directive,
      blockedURL: data.blockedURL,
      domain: data.domain,
      disposition: data.disposition,
      originalPolicy: data.originalPolicy,
      sourceFile: data.sourceFile,
      lineNumber: data.lineNumber,
      columnNumber: data.columnNumber,
      statusCode: data.statusCode,
    };

    await storeCSPReport(violation);
    reportQueue.push(violation);

    await params.addEvent({
      type: "csp_violation",
      domain: violation.domain,
      timestamp: resolveEventTimestamp(violation.timestamp, {
        logger: params.logger,
        context: "csp_violation",
      }),
      details: {
        directive: violation.directive,
        blockedURL: violation.blockedURL,
        disposition: violation.disposition,
      },
    });

    return { success: true };
  }

  async function handleNetworkRequest(
    data: Omit<NetworkRequest, "type"> & { type?: string },
    sender: MessageSenderLike
  ): Promise<{ success: boolean; reason?: string }> {
    const config = await getCSPConfig();

    if (!config.enabled || !config.collectNetworkRequests) {
      return { success: false, reason: "Disabled" };
    }

    const request: NetworkRequest = {
      type: "network-request",
      timestamp: data.timestamp || new Date().toISOString(),
      pageUrl: sender.tab?.url || data.pageUrl,
      url: data.url,
      method: data.method,
      initiator: data.initiator,
      domain: data.domain,
      resourceType: data.resourceType,
    };

    await storeCSPReport(request);
    reportQueue.push(request);

    return { success: true };
  }

  async function flushReportQueue() {
    if (!cspReporter || reportQueue.length === 0) {
      return;
    }

    const batch = reportQueue.splice(0, 100);
    const success = await cspReporter.send(batch);

    if (!success) {
      reportQueue.unshift(...batch);
    }
  }

  async function setCSPConfig(
    newConfig: Partial<CSPConfig>
  ): Promise<{ success: boolean }> {
    const current = await getCSPConfig();
    const updated = { ...current, ...newConfig };
    await params.saveStorage({ cspConfig: updated });

    if (cspReporter) {
      const endpoint =
        updated.reportEndpoint ?? (import.meta.env.DEV ? params.devReportEndpoint : null);
      cspReporter.setEndpoint(endpoint);
    }

    return { success: true };
  }

  async function clearCSPData(): Promise<{ success: boolean }> {
    try {
      const client = await params.ensureApiClient();
      await client.clearReports();
      reportQueue = [];
      return { success: true };
    } catch (error) {
      params.logger.error("Error clearing data:", error);
      return { success: false };
    }
  }

  async function initializeReporter(): Promise<void> {
    const config = await getCSPConfig();
    const endpoint = config.reportEndpoint ?? (import.meta.env.DEV ? params.devReportEndpoint : null);
    cspReporter = new CSPReporter(endpoint);
  }

  function clearReportQueue(): void {
    reportQueue = [];
  }

  return {
    handleCSPViolation,
    handleNetworkRequest,
    flushReportQueue,
    getCSPReports,
    generateCSPPolicy,
    generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy,
    getCSPConfig,
    setCSPConfig,
    clearCSPData,
    initializeReporter,
    clearReportQueue,
  };
}
