import type {
  AIMonitorConfig,
  CapturedAIPrompt,
  DetectedService,
} from "@pleno-audit/detectors";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import {
  analyzePrompt,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
} from "@pleno-audit/detectors";

interface AIPromptEvent {
  type: "ai_prompt_sent" | "ai_sensitive_data_detected" | "ai_response_received";
  domain: string;
  timestamp: number;
  details: unknown;
}

interface AIPromptMonitorStorage {
  detectionConfig?: DetectionConfig;
  aiMonitorConfig?: AIMonitorConfig;
  services?: Record<string, DetectedService>;
}

interface AIPromptMonitorDefaults {
  detectionConfig: DetectionConfig;
  aiMonitorConfig: AIMonitorConfig;
}

interface AIPromptMonitorDependencies {
  defaults: AIPromptMonitorDefaults;
  getStorage: () => Promise<AIPromptMonitorStorage>;
  storeAIPrompt: (prompt: CapturedAIPrompt) => Promise<void>;
  addEvent: (event: AIPromptEvent) => Promise<unknown>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
  alertAISensitive: (params: {
    domain: string;
    provider: string;
    model?: string;
    dataTypes: string[];
  }) => Promise<unknown>;
  alertShadowAI: (params: {
    domain: string;
    provider: string;
    providerDisplayName: string;
    category: string;
    riskLevel: string;
    confidence: string;
    model?: string;
  }) => Promise<unknown>;
  checkAIServicePolicy: (params: {
    domain: string;
    provider?: string;
    dataTypes?: string[];
  }) => Promise<void>;
}

function getPromptPreview(prompt: CapturedAIPrompt["prompt"]): string {
  if (prompt.messages?.length) {
    const lastUserMessage = [...prompt.messages]
      .reverse()
      .find((message) => message.role === "user");
    return lastUserMessage?.content.substring(0, 100) || "";
  }

  return prompt.text?.substring(0, 100) || prompt.rawBody?.substring(0, 100) || "";
}

function resolveHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export function createAIPromptMonitorHandler(
  deps: AIPromptMonitorDependencies,
): (data: CapturedAIPrompt) => Promise<{ success: boolean }> {
  return async (data: CapturedAIPrompt): Promise<{ success: boolean }> => {
    const storage = await deps.getStorage();
    const detectionConfig = storage.detectionConfig || deps.defaults.detectionConfig;
    const aiMonitorConfig = storage.aiMonitorConfig || deps.defaults.aiMonitorConfig;

    if (!detectionConfig.enableAI || !aiMonitorConfig.enabled) {
      return { success: false };
    }

    const analysis = analyzePrompt(data.prompt);
    const providerClassification = classifyProvider({
      modelName: data.model,
      url: data.apiEndpoint,
      responseText: data.response?.text,
    });

    const provider = providerClassification.provider;
    const providerInfo = getProviderInfo(provider);
    const isShadowAIDetected = isShadowAI(provider);

    await deps.storeAIPrompt({ ...data, provider: provider as CapturedAIPrompt["provider"] });

    const apiDomain = resolveHostname(data.apiEndpoint);

    await deps.addEvent({
      type: "ai_prompt_sent",
      domain: apiDomain,
      timestamp: data.timestamp,
      details: {
        provider,
        model: data.model,
        promptPreview: getPromptPreview(data.prompt),
        contentSize: data.prompt.contentSize,
        messageCount: data.prompt.messages?.length,
        isShadowAI: isShadowAIDetected,
        providerConfidence: providerClassification.confidence,
      },
    });

    if (analysis.pii.hasSensitiveData) {
      await deps.addEvent({
        type: "ai_sensitive_data_detected",
        domain: apiDomain,
        timestamp: data.timestamp,
        details: {
          provider,
          model: data.model,
          classifications: analysis.pii.classifications,
          highestRisk: analysis.pii.highestRisk,
          detectionCount: analysis.pii.detectionCount,
          riskScore: analysis.risk.riskScore,
          riskLevel: analysis.risk.riskLevel,
        },
      });

      if (analysis.risk.shouldAlert) {
        await deps.alertAISensitive({
          domain: apiDomain,
          provider,
          model: data.model,
          dataTypes: analysis.pii.classifications,
        });
      }
    }

    if (isShadowAIDetected) {
      await deps.alertShadowAI({
        domain: apiDomain,
        provider,
        providerDisplayName: providerInfo.displayName,
        category: providerInfo.category,
        riskLevel: providerInfo.riskLevel,
        confidence: providerClassification.confidence,
        model: data.model,
      });
    }

    if (data.response) {
      await deps.addEvent({
        type: "ai_response_received",
        domain: apiDomain,
        timestamp: data.responseTimestamp || Date.now(),
        details: {
          provider,
          model: data.model,
          responsePreview: data.response.text?.substring(0, 100) || "",
          contentSize: data.response.contentSize,
          latencyMs: data.response.latencyMs,
          isStreaming: data.response.isStreaming,
        },
      });
    }

    const pageDomain = resolveHostname(data.pageUrl);
    if (pageDomain !== "unknown") {
      const currentStorage = await deps.getStorage();
      const existingService = currentStorage.services?.[pageDomain];

      const existingProviders = existingService?.aiDetected?.providers || [];
      const providers = existingProviders.includes(provider)
        ? existingProviders
        : [...existingProviders, provider];

      const existingShadowProviders = existingService?.aiDetected?.shadowAIProviders || [];
      const shadowAIProviders = isShadowAIDetected && !existingShadowProviders.includes(provider)
        ? [...existingShadowProviders, provider]
        : existingShadowProviders;

      await deps.updateService(pageDomain, {
        aiDetected: {
          hasAIActivity: true,
          lastActivityAt: data.timestamp,
          providers,
          hasSensitiveData: analysis.pii.hasSensitiveData || existingService?.aiDetected?.hasSensitiveData,
          sensitiveDataTypes: analysis.pii.hasSensitiveData
            ? [...new Set([...(existingService?.aiDetected?.sensitiveDataTypes || []), ...analysis.pii.classifications])]
            : existingService?.aiDetected?.sensitiveDataTypes,
          riskLevel: analysis.risk.riskLevel === "critical" || analysis.risk.riskLevel === "high"
            ? analysis.risk.riskLevel
            : existingService?.aiDetected?.riskLevel,
          hasShadowAI: isShadowAIDetected || existingService?.aiDetected?.hasShadowAI,
          shadowAIProviders: shadowAIProviders.length > 0 ? shadowAIProviders : undefined,
        },
      });
    }

    deps.checkAIServicePolicy({
      domain: apiDomain,
      provider,
      dataTypes: analysis.pii.hasSensitiveData ? analysis.pii.classifications : undefined,
    }).catch(() => {
      // Policy check failure does not block prompt processing.
    });

    return { success: true };
  };
}
