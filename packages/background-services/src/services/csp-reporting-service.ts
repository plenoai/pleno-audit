import type {
  CSPConfig,
  CSPGenerationOptions,
  CSPReport,
  CSPViolation,
  CSPViolationDetails,
  GeneratedCSPPolicy,
  NetworkRequest,
  NetworkRequestDetails,
} from "@pleno-audit/csp";
import { CSPAnalyzer, DEFAULT_CSP_CONFIG, type GeneratedCSPByDomain } from "@pleno-audit/csp";
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

interface CSPEventRecord {
  type: string;
  domain: string;
  timestamp: number;
  details: CSPViolationDetails | NetworkRequestDetails;
}

interface CSPEventQueryResult {
  events: CSPEventRecord[];
  total: number;
  hasMore: boolean;
}

interface CreateCSPReportingServiceParams {
  logger: CSPServiceLogger;
  initStorage: () => Promise<{ cspConfig?: CSPConfig }>;
  saveStorage: (data: { cspConfig: CSPConfig }) => Promise<void>;
  addEvent: (event: {
    type: "csp_violation" | "network_request";
    domain: string;
    timestamp: number;
    details: CSPViolationDetails | NetworkRequestDetails;
  }) => Promise<unknown>;
  getCSPEvents: (options?: {
    type?: ("csp_violation" | "network_request")[];
    limit?: number;
    offset?: number;
    since?: number;
    until?: number;
  }) => Promise<CSPEventQueryResult>;
  clearCSPEvents: () => Promise<void>;
}

function eventToCSPReport(event: CSPEventRecord): CSPReport | null {
  if (event.type === "csp_violation") {
    const details = event.details as CSPViolationDetails;
    return {
      type: "csp-violation",
      timestamp: new Date(event.timestamp).toISOString(),
      pageUrl: details.pageUrl || "",
      directive: details.directive,
      blockedURL: details.blockedURL,
      domain: event.domain,
      disposition: details.disposition,
      originalPolicy: details.originalPolicy,
      sourceFile: details.sourceFile,
      lineNumber: details.lineNumber,
      columnNumber: details.columnNumber,
      statusCode: details.statusCode,
    };
  }

  if (event.type === "network_request") {
    const details = event.details as NetworkRequestDetails;
    return {
      type: "network-request",
      timestamp: new Date(event.timestamp).toISOString(),
      pageUrl: details.pageUrl || "",
      url: details.url,
      method: details.method,
      initiator: details.initiator as NetworkRequest["initiator"],
      domain: event.domain,
      resourceType: details.resourceType,
    };
  }

  return null;
}

export function createCSPReportingService(params: CreateCSPReportingServiceParams) {
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
      const eventTypes: ("csp_violation" | "network_request")[] = [];
      if (!options?.type || options.type === "csp-violation") {
        eventTypes.push("csp_violation");
      }
      if (!options?.type || options.type === "network-request") {
        eventTypes.push("network_request");
      }

      const result = await params.getCSPEvents({
        type: eventTypes,
        limit: options?.limit,
        offset: options?.offset,
        since: options?.since ? new Date(options.since).getTime() : undefined,
        until: options?.until ? new Date(options.until).getTime() : undefined,
      });

      const reports = result.events
        .map(eventToCSPReport)
        .filter((r): r is CSPReport => r !== null);

      const hasPaginationParams = Boolean(
        options?.limit !== undefined
        || options?.offset !== undefined
        || options?.since !== undefined
        || options?.until !== undefined,
      );

      if (!hasPaginationParams) {
        return reports;
      }

      return {
        reports,
        total: result.total,
        hasMore: result.hasMore,
      };
    } catch (error) {
      params.logger.error("Error getting CSP reports:", error);
      return [];
    }
  }

  async function getAllCSPReports(): Promise<CSPReport[]> {
    const result = await getCSPReports();
    return Array.isArray(result) ? result : result.reports;
  }

  async function generateCSPPolicy(
    options?: Partial<CSPGenerationOptions>
  ): Promise<GeneratedCSPPolicy> {
    const cspReports = await getAllCSPReports();
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
    const cspReports = await getAllCSPReports();
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

  async function handleCSPViolation(
    data: Omit<CSPViolation, "type"> & { type?: string },
    sender: MessageSenderLike
  ): Promise<{ success: boolean; reason?: string }> {
    const config = await getCSPConfig();

    if (!config.enabled || !config.collectCSPViolations) {
      return { success: false, reason: "Disabled" };
    }

    const pageUrl = sender.tab?.url || data.pageUrl;
    const timestamp = resolveEventTimestamp(data.timestamp, {
      logger: params.logger,
      context: "csp_violation",
    });

    await params.addEvent({
      type: "csp_violation",
      domain: data.domain,
      timestamp,
      details: {
        directive: data.directive,
        blockedURL: data.blockedURL,
        disposition: data.disposition,
        pageUrl,
        originalPolicy: data.originalPolicy,
        sourceFile: data.sourceFile,
        lineNumber: data.lineNumber,
        columnNumber: data.columnNumber,
        statusCode: data.statusCode,
      },
    });

    scheduleCSPPolicyGeneration();

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

    const pageUrl = sender.tab?.url || data.pageUrl;
    const timestamp = resolveEventTimestamp(data.timestamp, {
      logger: params.logger,
      context: "network_request",
    });

    await params.addEvent({
      type: "network_request",
      domain: data.domain,
      timestamp,
      details: {
        url: data.url,
        method: data.method,
        initiator: data.initiator,
        pageUrl,
        resourceType: data.resourceType,
      },
    });

    return { success: true };
  }

  async function setCSPConfig(
    newConfig: Partial<CSPConfig>
  ): Promise<{ success: boolean }> {
    const current = await getCSPConfig();
    const updated = { ...current, ...newConfig };
    await params.saveStorage({ cspConfig: updated });
    return { success: true };
  }

  async function clearCSPData(): Promise<{ success: boolean }> {
    try {
      await params.clearCSPEvents();
      return { success: true };
    } catch (error) {
      params.logger.error("Error clearing data:", error);
      return { success: false };
    }
  }

  return {
    handleCSPViolation,
    handleNetworkRequest,
    getCSPReports,
    generateCSPPolicy,
    generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy,
    getCSPConfig,
    setCSPConfig,
    clearCSPData,
  };
}
