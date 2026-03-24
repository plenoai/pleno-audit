import type {
  CSPGenerationOptions,
  CSPReport,
  CSPViolation,
  GeneratedCSPPolicy,
  NetworkRequest,
} from "@libztbs/csp";
import { CSPAnalyzer, type GeneratedCSPByDomain } from "@libztbs/csp";
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

interface CreateCSPReportingServiceParams {
  logger: CSPServiceLogger;
}

export function createCSPReportingService(params: CreateCSPReportingServiceParams) {
  let cspGenerationTimer: ReturnType<typeof setTimeout> | null = null;
  const reports: CSPReport[] = [];

  async function saveGeneratedCSPPolicy(result: GeneratedCSPByDomain) {
    await chrome.storage.local.set({ generatedCSPPolicy: result });
  }

  function getCSPReports(options?: {
    type?: "csp-violation" | "network-request";
    limit?: number;
    offset?: number;
    since?: string;
    until?: string;
  }): CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean } {
    let filtered = reports;

    if (options?.type) {
      filtered = filtered.filter((r) => r.type === options.type);
    }
    if (options?.since) {
      const sinceTime = new Date(options.since).getTime();
      filtered = filtered.filter((r) => new Date(r.timestamp).getTime() >= sinceTime);
    }
    if (options?.until) {
      const untilTime = new Date(options.until).getTime();
      filtered = filtered.filter((r) => new Date(r.timestamp).getTime() <= untilTime);
    }

    const hasPaginationParams = Boolean(
      options?.limit !== undefined
      || options?.offset !== undefined
      || options?.since !== undefined
      || options?.until !== undefined,
    );

    if (!hasPaginationParams) {
      return filtered;
    }

    const total = filtered.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? total;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      reports: paginated,
      total,
      hasMore: offset + limit < total,
    };
  }

  function getAllCSPReports(): CSPReport[] {
    const result = getCSPReports();
    return Array.isArray(result) ? result : result.reports;
  }

  function generateCSPPolicy(
    options?: Partial<CSPGenerationOptions>
  ): GeneratedCSPPolicy {
    const cspReports = getAllCSPReports();
    const analyzer = new CSPAnalyzer(cspReports);
    return analyzer.generatePolicy({
      strictMode: options?.strictMode ?? false,
      includeReportUri: options?.includeReportUri ?? false,
      reportUri: options?.reportUri ?? "",
      defaultSrc: options?.defaultSrc ?? "'self'",
      includeNonce: options?.includeNonce ?? false,
    });
  }

  function generateCSPPolicyByDomain(
    options?: Partial<CSPGenerationOptions>
  ): GeneratedCSPByDomain {
    const cspReports = getAllCSPReports();
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
        const result = generateCSPPolicyByDomain({
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

  async function handleCSPViolation(
    data: Omit<CSPViolation, "type"> & { type?: string },
    sender: MessageSenderLike
  ): Promise<{ success: boolean; reason?: string }> {
    const pageUrl = sender.tab?.url || data.pageUrl;
    const timestamp = resolveEventTimestamp(data.timestamp, {
      logger: params.logger,
      context: "csp_violation",
    });

    reports.push({
      type: "csp-violation",
      timestamp: new Date(timestamp).toISOString(),
      pageUrl: pageUrl || "",
      directive: data.directive,
      blockedURL: data.blockedURL,
      domain: data.domain,
      disposition: data.disposition,
      originalPolicy: data.originalPolicy,
      sourceFile: data.sourceFile,
      lineNumber: data.lineNumber,
      columnNumber: data.columnNumber,
      statusCode: data.statusCode,
    });

    scheduleCSPPolicyGeneration();

    return { success: true };
  }

  async function handleNetworkRequest(
    data: Omit<NetworkRequest, "type"> & { type?: string },
    sender: MessageSenderLike
  ): Promise<{ success: boolean; reason?: string }> {
    const pageUrl = sender.tab?.url || data.pageUrl;
    const timestamp = resolveEventTimestamp(data.timestamp, {
      logger: params.logger,
      context: "network_request",
    });

    reports.push({
      type: "network-request",
      timestamp: new Date(timestamp).toISOString(),
      pageUrl: pageUrl || "",
      url: data.url,
      method: data.method,
      initiator: data.initiator,
      domain: data.domain,
      resourceType: data.resourceType,
    });

    return { success: true };
  }

  function clearCSPData(): { success: boolean } {
    reports.length = 0;
    return { success: true };
  }

  return {
    handleCSPViolation,
    handleNetworkRequest,
    getCSPReports,
    generateCSPPolicy,
    generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy,
    clearCSPData,
  };
}
