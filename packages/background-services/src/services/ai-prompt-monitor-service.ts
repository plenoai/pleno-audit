import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  analyzePrompt,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
} from "@pleno-audit/ai-detector";
import type { AIMonitorConfig, CapturedAIPrompt } from "@pleno-audit/ai-detector";

const MAX_AI_PROMPTS = 500;
const AI_RISK_LEVEL_PRIORITY: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

interface AIServiceStorage {
  detectionConfig?: DetectionConfig;
  aiMonitorConfig?: AIMonitorConfig;
  aiPrompts?: CapturedAIPrompt[];
  services?: Record<string, {
    aiDetected?: {
      providers?: string[];
      hasSensitiveData?: boolean;
      sensitiveDataTypes?: string[];
      riskLevel?: string;
      hasShadowAI?: boolean;
      shadowAIProviders?: string[];
    };
  }>;
}

interface CreateAIPromptMonitorServiceParams {
  defaultDetectionConfig: DetectionConfig;
  getStorage: () => Promise<AIServiceStorage>;
  setStorage: (data: Partial<AIServiceStorage>) => Promise<void>;
  clearAIPrompts: () => Promise<void>;
  queueStorageOperation: <T>(operation: () => Promise<T>) => Promise<T>;
  addEvent: (event: {
    type: string;
    domain: string;
    timestamp: number;
    details: Record<string, unknown>;
  }) => Promise<unknown>;
  updateService: (domain: string, update: Record<string, unknown>) => Promise<void>;
  checkAIServicePolicy: (params: {
    domain: string;
    provider?: string;
    dataTypes?: string[];
  }) => Promise<void>;
  getAlertManager: () => {
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
  };
}

function getPromptPreview(prompt: CapturedAIPrompt["prompt"]): string {
  if (prompt.messages?.length) {
    const lastUserMsg = [...prompt.messages]
      .reverse()
      .find((message) => message.role === "user");
    return lastUserMsg?.content.substring(0, 100) || "";
  }
  return prompt.text?.substring(0, 100) || prompt.rawBody?.substring(0, 100) || "";
}

function getHigherRiskLevel(
  current?: string,
  incoming?: string
): string | undefined {
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }

  const currentPriority = AI_RISK_LEVEL_PRIORITY[current] ?? 0;
  const incomingPriority = AI_RISK_LEVEL_PRIORITY[incoming] ?? 0;
  return incomingPriority >= currentPriority ? incoming : current;
}

export function createAIPromptMonitorService(params: CreateAIPromptMonitorServiceParams) {
  async function storeAIPrompt(prompt: CapturedAIPrompt) {
    return params.queueStorageOperation(async () => {
      const storage = await params.getStorage();
      const config = storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;
      const maxPrompts = config.maxStoredRecords || MAX_AI_PROMPTS;

      const aiPrompts = storage.aiPrompts || [];
      aiPrompts.unshift(prompt);

      if (aiPrompts.length > maxPrompts) {
        aiPrompts.splice(maxPrompts);
      }

      await params.setStorage({ aiPrompts });
    });
  }

  async function handleAIPromptCaptured(
    data: CapturedAIPrompt
  ): Promise<{ success: boolean }> {
    const storage = await params.getStorage();
    const detectionConfig = storage.detectionConfig || params.defaultDetectionConfig;
    const config = storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;

    if (!detectionConfig.enableAI || !config.enabled) {
      return { success: false };
    }

    const analysis = analyzePrompt(data.prompt);
    const providerClassification = classifyProvider({
      modelName: data.model,
      url: data.apiEndpoint,
      responseText: data.response?.text,
    });
    const provider = providerClassification.provider;

    const isShadowAIDetected = isShadowAI(provider);
    const providerInfo = getProviderInfo(provider);

    const enhancedData: CapturedAIPrompt = {
      ...data,
      provider: provider as CapturedAIPrompt["provider"],
    };
    await storeAIPrompt(enhancedData);

    let domain = "unknown";
    try {
      domain = new URL(data.apiEndpoint).hostname;
    } catch {
      // ignore
    }

    await params.addEvent({
      type: "ai_prompt_sent",
      domain,
      timestamp: data.timestamp,
      details: {
        provider: providerClassification.provider,
        model: data.model,
        promptPreview: getPromptPreview(data.prompt),
        contentSize: data.prompt.contentSize,
        messageCount: data.prompt.messages?.length,
        isShadowAI: isShadowAIDetected,
        providerConfidence: providerClassification.confidence,
      },
    });

    if (analysis.pii.hasSensitiveData) {
      await params.addEvent({
        type: "ai_sensitive_data_detected",
        domain,
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
        await params.getAlertManager().alertAISensitive({
          domain,
          provider,
          model: data.model,
          dataTypes: analysis.pii.classifications,
        });
      }
    }

    if (isShadowAIDetected) {
      await params.getAlertManager().alertShadowAI({
        domain,
        provider: providerClassification.provider,
        providerDisplayName: providerInfo.displayName,
        category: providerInfo.category,
        riskLevel: providerInfo.riskLevel,
        confidence: providerClassification.confidence,
        model: data.model,
      });
    }

    if (data.response) {
      await params.addEvent({
        type: "ai_response_received",
        domain,
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

    let pageDomain = "unknown";
    try {
      pageDomain = new URL(data.pageUrl).hostname;
    } catch {
      // ignore
    }

    if (pageDomain !== "unknown") {
      await params.queueStorageOperation(async () => {
        const latestStorage = await params.getStorage();
        const existingService = latestStorage.services?.[pageDomain];
        const existingProviders = existingService?.aiDetected?.providers || [];
        const providers = existingProviders.includes(provider)
          ? existingProviders
          : [...existingProviders, provider];

        const existingShadowProviders = existingService?.aiDetected?.shadowAIProviders || [];
        const shadowAIProviders = isShadowAIDetected && !existingShadowProviders.includes(provider)
          ? [...existingShadowProviders, provider]
          : existingShadowProviders;

        await params.updateService(pageDomain, {
          aiDetected: {
            hasAIActivity: true,
            lastActivityAt: data.timestamp,
            providers,
            hasSensitiveData: analysis.pii.hasSensitiveData || existingService?.aiDetected?.hasSensitiveData,
            sensitiveDataTypes: analysis.pii.hasSensitiveData
              ? [...new Set([...(existingService?.aiDetected?.sensitiveDataTypes || []), ...analysis.pii.classifications])]
              : existingService?.aiDetected?.sensitiveDataTypes,
            riskLevel: getHigherRiskLevel(
              existingService?.aiDetected?.riskLevel,
              analysis.risk.riskLevel
            ),
            hasShadowAI: isShadowAIDetected || existingService?.aiDetected?.hasShadowAI,
            shadowAIProviders: shadowAIProviders.length > 0 ? shadowAIProviders : undefined,
          },
        });
      });
    }

    params.checkAIServicePolicy({
      domain,
      provider,
      dataTypes: analysis.pii.hasSensitiveData ? analysis.pii.classifications : undefined,
    }).catch(() => {
      // Ignore policy check errors
    });

    return { success: true };
  }

  async function getAIPrompts(): Promise<CapturedAIPrompt[]> {
    const storage = await params.getStorage();
    return storage.aiPrompts || [];
  }

  async function getAIPromptsCount(): Promise<number> {
    const storage = await params.getStorage();
    return (storage.aiPrompts || []).length;
  }

  async function getAIMonitorConfig(): Promise<AIMonitorConfig> {
    const storage = await params.getStorage();
    return storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;
  }

  async function setAIMonitorConfig(
    newConfig: Partial<AIMonitorConfig>
  ): Promise<{ success: boolean }> {
    const current = await getAIMonitorConfig();
    const updated = { ...current, ...newConfig };
    await params.setStorage({ aiMonitorConfig: updated });
    return { success: true };
  }

  async function clearAIData(): Promise<{ success: boolean }> {
    await params.clearAIPrompts();
    return { success: true };
  }

  return {
    handleAIPromptCaptured,
    getAIPrompts,
    getAIPromptsCount,
    getAIMonitorConfig,
    setAIMonitorConfig,
    clearAIData,
  };
}
