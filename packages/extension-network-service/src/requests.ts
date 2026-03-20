import type { NetworkRequestRecord } from "@pleno-audit/extension-runtime";
import {
  filterRequestsWithExtensionId,
  queryNetworkRequests,
  type NetworkRequestQueryOptions,
} from "./helpers.js";
import { parquetRecordToNetworkRequestRecord } from "@pleno-audit/parquet-storage";
import type { ExtensionNetworkContext } from "./types.js";

export async function getNetworkRequests(
  context: ExtensionNetworkContext,
  options?: NetworkRequestQueryOptions
): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  try {
    const store = await context.deps.getOrInitParquetStore();
    const allRecords = await store.queryRows("network-requests");
    const parsedRecords = allRecords.map((record) =>
      parquetRecordToNetworkRequestRecord(record)
    );
    return queryNetworkRequests(parsedRecords, options);
  } catch (error) {
    context.deps.logger.error("Failed to query network requests:", error);
    return { requests: [], total: 0 };
  }
}

export async function getExtensionRequests(
  context: ExtensionNetworkContext,
  options?: { limit?: number; offset?: number }
): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  return getNetworkRequests(context, {
    limit: options?.limit ?? 500,
    offset: options?.offset ?? 0,
    initiatorType: "extension",
  });
}

export async function getExtensionInitiatedRequests(
  context: ExtensionNetworkContext,
  limit = 10000
): Promise<NetworkRequestRecord[]> {
  const result = await getNetworkRequests(context, { limit, initiatorType: "extension" });
  return filterRequestsWithExtensionId(result.requests);
}
