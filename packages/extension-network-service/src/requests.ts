import type { NetworkRequestRecord } from "@pleno-audit/extension-runtime";
import {
  filterRequestsWithExtensionId,
  queryNetworkRequests,
  type NetworkRequestQueryOptions,
} from "./helpers.js";
import type { ExtensionNetworkContext } from "./types.js";

/**
 * ネットワークリクエストを取得する。
 * parquet-storage廃止後、リアルタイム監視のみ。保存済みデータの問い合わせは空を返す。
 */
export async function getNetworkRequests(
  _context: ExtensionNetworkContext,
  options?: NetworkRequestQueryOptions
): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  return queryNetworkRequests([], options);
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
