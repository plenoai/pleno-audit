import { summarizeExtensionStats, type ExtensionStats } from "./helpers.js";
import type { ExtensionNetworkContext } from "./types.js";
import { getExtensionInitiatedRequests } from "./requests.js";

export async function getExtensionStats(context: ExtensionNetworkContext): Promise<ExtensionStats> {
  const requests = await getExtensionInitiatedRequests(context);
  return summarizeExtensionStats(requests);
}
