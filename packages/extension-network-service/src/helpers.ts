import {
  analyzeInstalledExtension,
  type NetworkRequestRecord,
} from "@libztbs/extension-runtime";

export type ExtensionAnalysisRequest =
  Parameters<typeof analyzeInstalledExtension>[1][number];

export interface NetworkRequestQueryOptions {
  limit?: number;
  offset?: number;
  since?: number;
  initiatorType?: NetworkRequestRecord["initiatorType"];
}

export interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[]; lastActivityTime: number }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

export function mapToExtensionAnalysisRequest(
  request: NetworkRequestRecord
): ExtensionAnalysisRequest {
  if (!request.extensionId) {
    throw new Error(
      `Missing extensionId on NetworkRequestRecord id=${request.id}`
    );
  }

  return {
    id: request.id,
    extensionId: request.extensionId,
    extensionName: request.extensionName || "Unknown",
    timestamp: request.timestamp,
    url: request.url,
    method: request.method,
    resourceType: request.resourceType,
    domain: request.domain,
    detectedBy: request.detectedBy,
  };
}

export function groupRequestsByExtensionId(
  requests: NetworkRequestRecord[]
): Map<string, NetworkRequestRecord[]> {
  const grouped = new Map<string, NetworkRequestRecord[]>();
  for (const request of requests) {
    if (!request.extensionId) continue;
    const existing = grouped.get(request.extensionId) || [];
    existing.push(request);
    grouped.set(request.extensionId, existing);
  }
  return grouped;
}

export function queryNetworkRequests(
  records: NetworkRequestRecord[],
  options?: NetworkRequestQueryOptions
): { requests: NetworkRequestRecord[]; total: number } {
  let filtered = records;

  if (options?.since != null) {
    filtered = filtered.filter((record) => record.timestamp >= options.since!);
  }
  if (options?.initiatorType) {
    filtered = filtered.filter(
      (record) => record.initiatorType === options.initiatorType
    );
  }

  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  const total = sorted.length;
  const offset = options?.offset || 0;
  const limit = options?.limit || 500;
  const requests = sorted.slice(offset, offset + limit);
  return { requests, total };
}

export function filterRequestsWithExtensionId(
  requests: NetworkRequestRecord[]
): NetworkRequestRecord[] {
  return requests.filter((request) => !!request.extensionId);
}

export function summarizeExtensionStats(
  requests: NetworkRequestRecord[]
): ExtensionStats {
  const byExtension: Record<
    string,
    { name: string; count: number; domains: Set<string>; lastActivityTime: number }
  > = {};
  const byDomain: Record<string, { count: number; extensions: Set<string> }> = {};

  for (const request of requests) {
    if (!request.extensionId) continue;

    if (!byExtension[request.extensionId]) {
      byExtension[request.extensionId] = {
        name: request.extensionName || "Unknown",
        count: 0,
        domains: new Set(),
        lastActivityTime: 0,
      };
    }
    byExtension[request.extensionId].count++;
    byExtension[request.extensionId].domains.add(request.domain);
    if (request.timestamp > byExtension[request.extensionId].lastActivityTime) {
      byExtension[request.extensionId].lastActivityTime = request.timestamp;
    }

    if (!byDomain[request.domain]) {
      byDomain[request.domain] = { count: 0, extensions: new Set() };
    }
    byDomain[request.domain].count++;
    byDomain[request.domain].extensions.add(request.extensionId);
  }

  const byExtensionResult: ExtensionStats["byExtension"] = {};
  for (const [id, data] of Object.entries(byExtension)) {
    byExtensionResult[id] = {
      name: data.name,
      count: data.count,
      domains: Array.from(data.domains),
      lastActivityTime: data.lastActivityTime,
    };
  }

  const byDomainResult: ExtensionStats["byDomain"] = {};
  for (const [domain, data] of Object.entries(byDomain)) {
    byDomainResult[domain] = {
      count: data.count,
      extensions: Array.from(data.extensions),
    };
  }

  return { byExtension: byExtensionResult, byDomain: byDomainResult, total: requests.length };
}

export function getUniqueDomains(requests: NetworkRequestRecord[]): string[] {
  return [...new Set(requests.map((request) => request.domain))];
}
