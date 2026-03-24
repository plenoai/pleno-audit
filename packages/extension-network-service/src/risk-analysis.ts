import {
  analyzeInstalledExtension,
  DEFAULT_DETECTION_CONFIG,
  type ExtensionRiskAnalysis,
} from "@libztbs/extension-runtime";
import {
  getUniqueDomains,
  groupRequestsByExtensionId,
  mapToExtensionAnalysisRequest,
} from "./helpers.js";
import type { ExtensionNetworkContext } from "./types.js";
import { getCooldownManager } from "./cooldown.js";
import { getExtensionInitiatedRequests } from "./requests.js";

export async function analyzeExtensionRisks(context: ExtensionNetworkContext): Promise<void> {
  try {
    const storage = await context.deps.getStorage();
    const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

    if (!detectionConfig.enableExtension) {
      return;
    }

    const requests = await getExtensionInitiatedRequests(context);
    if (requests.length === 0) return;

    const manager = getCooldownManager(context);

    for (const [extensionId, extRequests] of groupRequestsByExtensionId(requests)) {
      const cooldownKey = `extension:${extensionId}`;
      if (await manager.isOnCooldown(cooldownKey)) {
        continue;
      }

      const compatRequests = extRequests.map(mapToExtensionAnalysisRequest);
      const analysis = await analyzeInstalledExtension(extensionId, compatRequests);
      if (!analysis) continue;

      if (analysis.riskLevel === "critical" || analysis.riskLevel === "high") {
        const uniqueDomains = getUniqueDomains(extRequests);
        await context.deps.getAlertManager().alertExtension({
          extensionId: analysis.extensionId,
          extensionName: analysis.extensionName,
          riskLevel: analysis.riskLevel,
          riskScore: analysis.riskScore,
          flags: analysis.flags.map((flag) => flag.flag),
          requestCount: extRequests.length,
          targetDomains: uniqueDomains.slice(0, 10),
        });

        await manager.setCooldown(cooldownKey);
        context.deps.logger.info(
          `Extension risk alert fired: ${analysis.extensionName} (score: ${analysis.riskScore})`
        );
      }
    }
  } catch (error) {
    context.deps.logger.error("Extension risk analysis failed:", error);
  }
}

export async function getExtensionRiskAnalysis(
  context: ExtensionNetworkContext,
  extensionId: string
): Promise<ExtensionRiskAnalysis | null> {
  const requests = await getExtensionInitiatedRequests(context);
  const compatRequests = requests
    .filter((request) => request.extensionId === extensionId)
    .map(mapToExtensionAnalysisRequest);

  return analyzeInstalledExtension(extensionId, compatRequests);
}

export async function getAllExtensionRisks(
  context: ExtensionNetworkContext
): Promise<ExtensionRiskAnalysis[]> {
  const requests = await getExtensionInitiatedRequests(context);
  const requestsByExtension = groupRequestsByExtensionId(requests);

  const results: ExtensionRiskAnalysis[] = [];
  for (const [extensionId, extRequests] of requestsByExtension) {
    const compatRequests = extRequests.map(mapToExtensionAnalysisRequest);
    const analysis = await analyzeInstalledExtension(extensionId, compatRequests);
    if (analysis) {
      results.push(analysis);
    }
  }

  return results.sort((a, b) => b.riskScore - a.riskScore);
}
