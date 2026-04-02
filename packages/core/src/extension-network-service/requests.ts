import type { NetworkRequestRecord } from "../extension-runtime/index.js";
import {
  filterRequestsWithExtensionId,
  queryNetworkRequests,
  type NetworkRequestQueryOptions,
} from "./helpers.js";
import type { ExtensionNetworkContext } from "./types.js";

/**
 * ネットワークリクエストを取得する。
 * インメモリバッファから読み取る。
 */
export async function getNetworkRequests(
  context: ExtensionNetworkContext,
  options?: NetworkRequestQueryOptions
): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  return queryNetworkRequests(context.state.requestBuffer, options);
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
