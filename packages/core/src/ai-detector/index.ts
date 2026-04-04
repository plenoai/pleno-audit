/**
 * @libztbs/ai-detector
 *
 * AIプロンプト検出パッケージ
 * AIサービスへのリクエスト/レスポンスを検出・解析
 */

// Types
export type {
  InferredProvider,
  AIDetectionMethod,
  RawAICapture,
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
} from "./types.js";

export { DEFAULT_AI_MONITOR_CONFIG } from "./types.js";

// Detector
export {
  isAIRequestBody,
  extractPromptContent,
  extractModel,
  extractResponseContent,
  inferProviderFromResponse,
  parseRawAICapture,
} from "./detector.js";

// PII Analyzer
export {
  analyzePromptPII,
  calculatePromptRiskScore,
  analyzePrompt,
  type AIPromptPIIResult,
  type AIPromptRiskAssessment,
  type AIPromptAnalysisResult,
} from "./pii-analyzer.js";

// Provider Classifier (Shadow AI Detection)
export {
  classifyByModelName,
  classifyByUrl,
  classifyByResponseStructure,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
  PROVIDER_INFO,
  type ExtendedProvider,
  type ProviderClassification,
  type ProviderInfo,
} from "./provider-classifier.js";

// DLP Rules (includes sensitive data detection)
export {
  createDLPManager,
  ALL_DLP_RULES,
  EXTENDED_DLP_RULES,
  DEFAULT_DLP_CONFIG,
  calculateShannonEntropy,
  passesLuhn,
  CREDIT_CARD_PATTERN,
  containsCreditCard,
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type DataClassification,
  type SensitiveDataResult,
  type DLPRule,
  type DLPConfig,
  type DLPDetectionResult,
  type DLPAnalysisResult,
  type DLPManager,
} from "./dlp-rules.js";

// Policy Generator
export {
  createPolicyGenerator,
  type PolicyRule,
  type PolicyCategory,
  type AIPolicyAction,
  type PolicyCondition,
  type ConditionType,
  type PolicyGenerationInput,
  type PolicyGenerationResult,
  type PolicyGenerator,
  type AIUsageData,
  type DLPDetectionData,
  type ExtensionRiskData,
  type DomainVisitData,
} from "./policy-generator.js";

// DLP Client (pleno-anonymize DLP — detect only)
export {
  createDLPClient,
  type DLPClient,
  type DLPClientConfig,
  type DLPEntity,
  type DLPAnalyzeRequest,
} from "./dlp-client.js";

// DLP Scanner
export {
  createDLPScanner,
  getEntityLabel,
  DEFAULT_DLP_SERVER_CONFIG,
  type DLPScanner,
  type DLPServerConfig,
  type WasmTokenizerLike,
  type ScanContext,
  type DLPScanResult,
} from "./dlp-scanner.js";

// DLP Tokenizer (local NER)
export { tokenize, murmurhash2_64a, convertWasmTokens, type WasmTokenResult } from "./dlp-tokenizer.js";

// DLP Local NER
export {
  loadNERModel,
  type NERModel,
  type NEREntity,
  type NERModelConfig,
} from "./dlp-local-ner.js";

// DLP Model Manager
export {
  createDLPModelManager,
  type DLPModelManager,
  type ModelStatus,
} from "./dlp-model-manager.js";

// AI Pattern Analyzer
export {
  createAIPatternAnalyzer,
  type AIUsageEvent,
  type ProviderDistribution,
  type AIPatternAnalysis,
  type AIAnomaly,
  type AIRiskMetrics,
  type OrganizationAITrend,
} from "./ai-pattern-analyzer.js";
