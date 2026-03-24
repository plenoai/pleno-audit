/**
 * @fileoverview Alert Builders
 *
 * Pure builders for alert payload creation logic.
 */

import type {
  AlertAction,
  AlertDetails,
  AlertSeverity,
  AlertCategory,
  NRDAlertDetails,
  TyposquatAlertDetails,
  AISensitiveAlertDetails,
  ShadowAIAlertDetails,
  ExtensionAlertDetails,
  CSPAlertDetails,
  DataExfiltrationAlertDetails,
  CredentialTheftAlertDetails,
  SupplyChainAlertDetails,
  ComplianceAlertDetails,
  PolicyViolationAlertDetails,
  TrackingBeaconAlertDetails,
  ClipboardHijackAlertDetails,
  CookieAccessAlertDetails,
  XSSInjectionAlertDetails,
  DOMScrapingAlertDetails,
  SuspiciousDownloadAlertDetails,
  CanvasFingerprintAlertDetails,
  WebGLFingerprintAlertDetails,
  AudioFingerprintAlertDetails,
  DynamicCodeExecutionAlertDetails,
  FullscreenPhishingAlertDetails,
  ClipboardReadAlertDetails,
  GeolocationAccessAlertDetails,
  WebSocketConnectionAlertDetails,
  WebRTCConnectionAlertDetails,
  BroadcastChannelAlertDetails,
  SendBeaconAlertDetails,
  MediaCaptureAlertDetails,
  NotificationPhishingAlertDetails,
  CredentialAPIAlertDetails,
  DeviceSensorAlertDetails,
  DeviceEnumerationAlertDetails,
  StorageExfiltrationAlertDetails,
  PrototypePollutionAlertDetails,
  DNSPrefetchLeakAlertDetails,
  FormHijackAlertDetails,
  CSSKeyloggingAlertDetails,
  PerformanceObserverAlertDetails,
  PostMessageExfilAlertDetails,
  DOMClobberingAlertDetails,
  CacheAPIAbuseAlertDetails,
  FetchExfiltrationAlertDetails,
  WASMExecutionAlertDetails,
  IntersectionObserverAlertDetails,
  IndexedDBAbuseAlertDetails,
  HistoryManipulationAlertDetails,
} from "./types.js";

export interface CreateAlertInput {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  details: AlertDetails;
  actions?: AlertAction[];
}

interface AlertBuildOutput<Details extends AlertDetails> {
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  details: Omit<Details, "type">;
  actions?: AlertAction[];
}

interface AlertDefinition<Params, Details extends AlertDetails> {
  category: AlertCategory;
  detailsType: Details["type"];
  build: (
    params: Params,
    helpers: AlertBuilderHelpers
  ) => AlertBuildOutput<Details> | null;
}

interface AlertBuilderHelpers {
  resolveSeverity: typeof resolveSeverity;
  severityFromConfidence: typeof severityFromConfidence;
  buildRiskDescription: typeof buildRiskDescription;
  translateViolations: typeof translateViolations;
  violationDescriptions: typeof VIOLATION_DESCRIPTIONS;
}

// ============================================================================
// Severity Resolution Utilities
// ============================================================================

/**
 * 条件に基づいてseverityを決定するユーティリティ
 *
 * @param conditions - [condition, severityIfTrue] のペア配列（優先度順）
 * @param defaultSeverity - どの条件も満たさない場合のデフォルト
 */
export function resolveSeverity(
  conditions: [boolean, AlertSeverity][],
  defaultSeverity: AlertSeverity
): AlertSeverity {
  for (const [condition, severity] of conditions) {
    if (condition) return severity;
  }
  return defaultSeverity;
}

/**
 * confidence レベルから severity を決定
 *
 * high -> criticalOrHigh, それ以外 -> defaultSeverity
 */
export function severityFromConfidence(
  confidence: "high" | "medium" | "low" | "unknown",
  criticalOrHigh: AlertSeverity,
  defaultSeverity: AlertSeverity
): AlertSeverity {
  return confidence === "high" ? criticalOrHigh : defaultSeverity;
}

// ============================================================================
// Description Building Utilities
// ============================================================================

/**
 * 条件付きでリスク説明を収集し結合
 *
 * @param items - [condition, description] のペア配列
 * @param separator - 結合文字（デフォルト: ", "）
 * @param fallback - 空の場合のフォールバック
 */
export function buildRiskDescription(
  items: [boolean, string][],
  separator = ", ",
  fallback = ""
): string {
  const descriptions = items.filter(([cond]) => cond).map(([, desc]) => desc);
  return descriptions.length > 0 ? descriptions.join(separator) : fallback;
}

/**
 * 違反コードを日本語の説明に変換
 */
export const VIOLATION_DESCRIPTIONS: Record<string, string> = {
  missing_privacy_policy: "プライバシーポリシーなし",
  missing_terms_of_service: "利用規約なし",
  missing_cookie_policy: "クッキーポリシーなし",
  missing_cookie_banner: "クッキーバナーなし",
  non_compliant_cookie_banner: "GDPR非準拠バナー",
};

/**
 * 違反コードリストを日本語説明に変換
 */
export function translateViolations(violations: string[]): string[] {
  return violations.map((v) => VIOLATION_DESCRIPTIONS[v] || v);
}

const ALERT_BUILDER_HELPERS: AlertBuilderHelpers = {
  resolveSeverity,
  severityFromConfidence,
  buildRiskDescription,
  translateViolations,
  violationDescriptions: VIOLATION_DESCRIPTIONS,
};

function createAlertBuilder<Params, Details extends AlertDetails>(
  definition: AlertDefinition<Params, Details>
): (params: Params) => CreateAlertInput | null {
  return (params) => {
    const built = definition.build(params, ALERT_BUILDER_HELPERS);
    if (!built) {
      return null;
    }

    const { actions, details, ...alertCore } = built;

    return {
      ...alertCore,
      category: definition.category,
      details: { type: definition.detailsType, ...details } as Details,
      actions,
    };
  };
}

export interface NRDAlertParams {
  domain: string;
  domainAge: number | null;
  registrationDate: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
}

const NRD_ALERT_DEFINITION: AlertDefinition<NRDAlertParams, NRDAlertDetails> = {
  category: "nrd",
  detailsType: "nrd",
  build: (params, helpers) => {
    const severity = helpers.severityFromConfidence(params.confidence, "high", "medium");

    return {
      severity,
      title: `NRD検出: ${params.domain}`,
      description: `新規登録ドメイン（${params.domainAge !== null ? `${params.domainAge}日前` : "日数不明"}）`,
      domain: params.domain,
      details: {
        domainAge: params.domainAge,
        registrationDate: params.registrationDate,
        confidence: params.confidence,
      },
    };
  },
};

export const buildNRDAlert = createAlertBuilder(NRD_ALERT_DEFINITION);

export interface TyposquatAlertParams {
  domain: string;
  targetDomain?: string;
  homoglyphCount: number;
  confidence: "high" | "medium" | "low" | "none";
}

const TYPOSQUAT_ALERT_DEFINITION: AlertDefinition<
  TyposquatAlertParams,
  TyposquatAlertDetails
> = {
  category: "typosquat",
  detailsType: "typosquat",
  build: (params, helpers) => {
    if (params.confidence === "none") {
      return null;
    }

    const severity = helpers.severityFromConfidence(params.confidence, "critical", "high");

    return {
      severity,
      title: `タイポスクワット検出: ${params.domain}`,
      description: params.targetDomain
        ? `${params.targetDomain}の偽装の可能性`
        : `ホモグリフ ${params.homoglyphCount}個検出`,
      domain: params.domain,
      details: {
        targetDomain: params.targetDomain,
        homoglyphCount: params.homoglyphCount,
        confidence: params.confidence,
      },
    };
  },
};

export const buildTyposquatAlert = createAlertBuilder(TYPOSQUAT_ALERT_DEFINITION);

export interface CSPViolationAlertParams {
  domain: string;
  directive: string;
  blockedURL: string;
  violationCount: number;
}

const CSP_VIOLATION_ALERT_DEFINITION: AlertDefinition<
  CSPViolationAlertParams,
  CSPAlertDetails
> = {
  category: "csp_violation",
  detailsType: "csp",
  build: (params, helpers) => {
    const isCriticalDirective = ["script-src", "default-src"].includes(params.directive);
    const severity = helpers.resolveSeverity(
      [[isCriticalDirective, "high"]],
      "medium"
    );

    return {
      severity,
      title: `CSP違反: ${params.directive}`,
      description: `${params.blockedURL}が${params.directive}ポリシーに違反（${params.violationCount}回）`,
      domain: params.domain,
      details: {
        directive: params.directive,
        blockedURL: params.blockedURL,
        violationCount: params.violationCount,
      },
    };
  },
};

export const buildCSPViolationAlert = createAlertBuilder(CSP_VIOLATION_ALERT_DEFINITION);

export interface AISensitiveAlertParams {
  domain: string;
  provider: string;
  model?: string;
  dataTypes: string[];
}

const AI_SENSITIVE_ALERT_DEFINITION: AlertDefinition<
  AISensitiveAlertParams,
  AISensitiveAlertDetails
> = {
  category: "ai_sensitive",
  detailsType: "ai_sensitive",
  build: (params, helpers) => {
    const hasCredentials = params.dataTypes.includes("credentials");
    const severity = helpers.resolveSeverity([[hasCredentials, "critical"]], "high");
    const displayedDataTypes =
      params.dataTypes.length > 0 ? params.dataTypes : ["不明なデータ"];

    return {
      severity,
      title: `機密情報をAIに送信: ${params.domain}`,
      description: `${params.provider}に${displayedDataTypes.join(", ")}を送信`,
      domain: params.domain,
      details: {
        provider: params.provider,
        model: params.model,
        dataTypes: displayedDataTypes,
      },
    };
  },
};

export const buildAISensitiveAlert = createAlertBuilder(AI_SENSITIVE_ALERT_DEFINITION);

export interface ShadowAIAlertParams {
  domain: string;
  provider: string;
  providerDisplayName: string;
  category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
  riskLevel: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  model?: string;
}

const SHADOW_AI_ALERT_DEFINITION: AlertDefinition<
  ShadowAIAlertParams,
  ShadowAIAlertDetails
> = {
  category: "shadow_ai",
  detailsType: "shadow_ai",
  build: (params, helpers) => {
    const severity = helpers.resolveSeverity(
      [
        [params.provider === "unknown", "high"],
        [params.riskLevel === "high", "high"],
      ],
      "medium"
    );

    const isUnknown = params.provider === "unknown";
    const title = isUnknown
      ? `未知のAIサービス検出: ${params.domain}`
      : `Shadow AI検出: ${params.providerDisplayName}`;

    const description = isUnknown
      ? "未承認のAIサービスへのアクセスを検出しました"
      : `${params.providerDisplayName}（${params.category}）へのアクセスを検出`;

    return {
      severity,
      title,
      description,
      domain: params.domain,
      details: {
        provider: params.provider,
        providerDisplayName: params.providerDisplayName,
        category: params.category,
        riskLevel: params.riskLevel,
        confidence: params.confidence,
        model: params.model,
      },
    };
  },
};

export const buildShadowAIAlert = createAlertBuilder(SHADOW_AI_ALERT_DEFINITION);

export interface ExtensionAlertParams {
  extensionId: string;
  extensionName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskScore: number;
  flags: string[];
  requestCount: number;
  targetDomains: string[];
}

const EXTENSION_ALERT_DEFINITION: AlertDefinition<
  ExtensionAlertParams,
  ExtensionAlertDetails
> = {
  category: "extension",
  detailsType: "extension",
  build: (params) => {
    const severity: AlertSeverity = params.riskLevel;

    const flagsPreview = params.flags.slice(0, 2).join(", ");

    return {
      severity,
      title: `危険な拡張機能: ${params.extensionName}`,
      description: flagsPreview
        ? `リスクフラグ: ${flagsPreview}`
        : `リスクスコア: ${params.riskScore}`,
      domain: "chrome-extension://" + params.extensionId,
      details: {
        extensionId: params.extensionId,
        extensionName: params.extensionName,
        requestCount: params.requestCount,
        targetDomains: params.targetDomains,
      },
    };
  },
};

export const buildExtensionAlert = createAlertBuilder(EXTENSION_ALERT_DEFINITION);

export interface DataExfiltrationAlertParams {
  sourceDomain: string;
  targetDomain: string;
  bodySize: number;
  method: string;
  initiator: string;
  sensitiveDataTypes?: string[];
}

const DATA_EXFILTRATION_ALERT_DEFINITION: AlertDefinition<
  DataExfiltrationAlertParams,
  DataExfiltrationAlertDetails
> = {
  category: "data_exfiltration",
  detailsType: "data_exfiltration",
  build: (params, helpers) => {
    const sizeKB = Math.round(params.bodySize / 1024);
    const hasSensitiveData = (params.sensitiveDataTypes?.length ?? 0) > 0;
    const severity = helpers.resolveSeverity(
      [
        [hasSensitiveData, "critical"],
        [sizeKB > 500, "critical"],
      ],
      "high"
    );

    const sensitiveLabel = hasSensitiveData
      ? params.sensitiveDataTypes!.join(", ")
      : null;
    const title = hasSensitiveData
      ? `機密データ送信検出: ${params.targetDomain}`
      : `大量データ送信検出: ${params.targetDomain}`;
    const description = hasSensitiveData
      ? `${params.sourceDomain}から${params.targetDomain}に${sensitiveLabel}を含むデータを送信`
      : `${params.sourceDomain}から${sizeKB}KBのデータを${params.targetDomain}に送信`;

    return {
      severity,
      title,
      description,
      domain: params.targetDomain,
      details: {
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        bodySize: params.bodySize,
        sizeKB,
        method: params.method,
        initiator: params.initiator,
        sensitiveDataTypes: params.sensitiveDataTypes,
      },
    };
  },
};

export const buildDataExfiltrationAlert = createAlertBuilder(
  DATA_EXFILTRATION_ALERT_DEFINITION
);

export interface CredentialTheftAlertParams {
  sourceDomain: string;
  targetDomain: string;
  formAction: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
}

const CREDENTIAL_THEFT_ALERT_DEFINITION: AlertDefinition<
  CredentialTheftAlertParams,
  CredentialTheftAlertDetails
> = {
  category: "credential_theft",
  detailsType: "credential_theft",
  build: (params, helpers) => {
    const hasInsecureProtocol = params.risks.includes("insecure_protocol");
    const severity = helpers.resolveSeverity([[hasInsecureProtocol, "critical"]], "high");

    const transportDescription = helpers.buildRiskDescription(
      [
        [hasInsecureProtocol, "非HTTPS通信"],
        [params.isCrossOrigin, "クロスオリジン送信"],
      ],
      ", ",
      "不明な経路"
    );

    return {
      severity,
      title: `認証情報リスク: ${params.targetDomain}`,
      description: `${params.fieldType}フィールドが${transportDescription}で送信されます`,
      domain: params.targetDomain,
      details: {
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        formAction: params.formAction,
        isSecure: params.isSecure,
        isCrossOrigin: params.isCrossOrigin,
        fieldType: params.fieldType,
        risks: params.risks,
      },
    };
  },
};

export const buildCredentialTheftAlert = createAlertBuilder(
  CREDENTIAL_THEFT_ALERT_DEFINITION
);

export interface SupplyChainRiskAlertParams {
  pageDomain: string;
  resourceUrl: string;
  resourceDomain: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
}

const SUPPLY_CHAIN_ALERT_DEFINITION: AlertDefinition<
  SupplyChainRiskAlertParams,
  SupplyChainAlertDetails
> = {
  category: "supply_chain",
  detailsType: "supply_chain",
  build: (params, helpers) => {
    const isCDNWithoutSRI = params.isCDN && !params.hasIntegrity;
    const severity = helpers.resolveSeverity([[isCDNWithoutSRI, "high"]], "medium");

    const riskPart = helpers.buildRiskDescription([
      [!params.hasIntegrity, "SRIなし"],
      [params.isCDN, "CDN"],
      [!params.hasCrossorigin, "crossorigin属性なし"],
    ]);

    const description = riskPart
      ? `${params.resourceType}が${riskPart}で読み込まれています`
      : `${params.resourceType}が読み込まれています`;

    return {
      severity,
      title: `サプライチェーンリスク: ${params.resourceDomain}`,
      description,
      domain: params.resourceDomain,
      details: {
        pageDomain: params.pageDomain,
        resourceUrl: params.resourceUrl,
        resourceDomain: params.resourceDomain,
        resourceType: params.resourceType,
        hasIntegrity: params.hasIntegrity,
        hasCrossorigin: params.hasCrossorigin,
        isCDN: params.isCDN,
        risks: params.risks,
      },
    };
  },
};

export const buildSupplyChainRiskAlert = createAlertBuilder(SUPPLY_CHAIN_ALERT_DEFINITION);

export interface ComplianceAlertParams {
  pageDomain: string;
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasCookiePolicy: boolean;
  hasCookieBanner: boolean;
  isCookieBannerGDPRCompliant: boolean;
  hasLoginForm: boolean;
}

const COMPLIANCE_ALERT_DEFINITION: AlertDefinition<
  ComplianceAlertParams,
  ComplianceAlertDetails
> = {
  category: "compliance",
  detailsType: "compliance",
  build: (params, helpers) => {
    const violations: string[] = [];

    if (params.hasLoginForm) {
      if (!params.hasPrivacyPolicy) {
        violations.push("missing_privacy_policy");
      }
      if (!params.hasTermsOfService) {
        violations.push("missing_terms_of_service");
      }
    }

    if (!params.hasCookiePolicy) {
      violations.push("missing_cookie_policy");
    }

    if (!params.hasCookieBanner) {
      violations.push("missing_cookie_banner");
    }

    if (params.hasCookieBanner && !params.isCookieBannerGDPRCompliant) {
      violations.push("non_compliant_cookie_banner");
    }

    if (violations.length === 0) {
      return null;
    }

    const hasLoginViolations =
      params.hasLoginForm &&
      (!params.hasPrivacyPolicy || !params.hasTermsOfService);
    const severity = helpers.resolveSeverity([[hasLoginViolations, "high"]], "medium");

    const violationDescriptions = helpers.translateViolations(violations);

    return {
      severity,
      title: `コンプライアンス違反: ${params.pageDomain}`,
      description: violationDescriptions.join(", "),
      domain: params.pageDomain,
      details: {
        pageDomain: params.pageDomain,
        hasPrivacyPolicy: params.hasPrivacyPolicy,
        hasTermsOfService: params.hasTermsOfService,
        hasCookiePolicy: params.hasCookiePolicy,
        hasCookieBanner: params.hasCookieBanner,
        isCookieBannerGDPRCompliant: params.isCookieBannerGDPRCompliant,
        hasLoginForm: params.hasLoginForm,
        violations,
      },
    };
  },
};

export const buildComplianceAlert = createAlertBuilder(COMPLIANCE_ALERT_DEFINITION);

export interface PolicyViolationAlertParams {
  domain: string;
  ruleId: string;
  ruleName: string;
  ruleType: "domain" | "tool" | "ai" | "data_transfer";
  action: "allow" | "warn";
  matchedPattern: string;
  target: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  domain: "ドメイン",
  tool: "ツール",
  ai: "AI",
  data_transfer: "データ転送",
};

const POLICY_VIOLATION_ALERT_DEFINITION: AlertDefinition<
  PolicyViolationAlertParams,
  PolicyViolationAlertDetails
> = {
  category: "policy_violation",
  detailsType: "policy_violation",
  build: (params, helpers) => {
    if (params.action === "allow") {
      return null;
    }

    const severity: AlertSeverity = "medium";
    const actionLabel = "警告";
    const ruleTypeLabel = RULE_TYPE_LABELS[params.ruleType] || params.ruleType;

    return {
      severity,
      title: `ポリシー違反${actionLabel}: ${params.ruleName}`,
      description: `${ruleTypeLabel}ルール「${params.ruleName}」に違反: ${params.target}`,
      domain: params.domain,
      details: {
        ruleId: params.ruleId,
        ruleName: params.ruleName,
        ruleType: params.ruleType,
        action: params.action,
        matchedPattern: params.matchedPattern,
        target: params.target,
      },
    };
  },
};

export const buildPolicyViolationAlert = createAlertBuilder(
  POLICY_VIOLATION_ALERT_DEFINITION
);

export interface TrackingBeaconAlertParams {
  sourceDomain: string;
  targetDomain: string;
  url: string;
  bodySize: number;
  initiator: string;
}

const TRACKING_BEACON_ALERT_DEFINITION: AlertDefinition<
  TrackingBeaconAlertParams,
  TrackingBeaconAlertDetails
> = {
  category: "tracking_beacon",
  detailsType: "tracking_beacon",
  build: (params) => ({
    severity: "medium",
    title: `トラッキングビーコン検出: ${params.targetDomain}`,
    description: `${params.sourceDomain}から${params.targetDomain}へビーコン送信`,
    domain: params.targetDomain,
    details: {
      sourceDomain: params.sourceDomain,
      targetDomain: params.targetDomain,
      url: params.url,
      bodySize: params.bodySize,
      initiator: params.initiator,
    },
  }),
};

export const buildTrackingBeaconAlert = createAlertBuilder(TRACKING_BEACON_ALERT_DEFINITION);

export interface ClipboardHijackAlertParams {
  domain: string;
  cryptoType: string;
  textPreview: string;
}

const CLIPBOARD_HIJACK_ALERT_DEFINITION: AlertDefinition<
  ClipboardHijackAlertParams,
  ClipboardHijackAlertDetails
> = {
  category: "clipboard_hijack",
  detailsType: "clipboard_hijack",
  build: (params) => ({
    severity: "critical",
    title: `クリップボード乗っ取り検出: ${params.domain}`,
    description: `${params.cryptoType}アドレスがクリップボードに書き込まれました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      cryptoType: params.cryptoType,
      textPreview: params.textPreview,
    },
  }),
};

export const buildClipboardHijackAlert = createAlertBuilder(
  CLIPBOARD_HIJACK_ALERT_DEFINITION
);

export interface CookieAccessAlertParams {
  domain: string;
  readCount: number;
}

const COOKIE_ACCESS_ALERT_DEFINITION: AlertDefinition<
  CookieAccessAlertParams,
  CookieAccessAlertDetails
> = {
  category: "cookie_access",
  detailsType: "cookie_access",
  build: (params) => ({
    severity: "medium",
    title: `Cookie盗取の可能性: ${params.domain}`,
    description: "スクリプトがCookieにアクセスしました",
    domain: params.domain,
    details: {
      domain: params.domain,
      readCount: params.readCount,
    },
  }),
};

export const buildCookieAccessAlert = createAlertBuilder(COOKIE_ACCESS_ALERT_DEFINITION);

export interface XSSInjectionAlertParams {
  domain: string;
  injectionType: string;
  payloadPreview: string;
}

const XSS_INJECTION_ALERT_DEFINITION: AlertDefinition<
  XSSInjectionAlertParams,
  XSSInjectionAlertDetails
> = {
  category: "xss_injection",
  detailsType: "xss_injection",
  build: (params) => ({
    severity: "critical",
    title: `XSS検出: ${params.domain}`,
    description: `${params.injectionType}経由で悪意あるスクリプトを検出`,
    domain: params.domain,
    details: {
      domain: params.domain,
      injectionType: params.injectionType,
      payloadPreview: params.payloadPreview,
    },
  }),
};

export const buildXSSInjectionAlert = createAlertBuilder(XSS_INJECTION_ALERT_DEFINITION);

export interface DOMScrapingAlertParams {
  domain: string;
  selector: string;
  callCount: number;
}

const DOM_SCRAPING_ALERT_DEFINITION: AlertDefinition<
  DOMScrapingAlertParams,
  DOMScrapingAlertDetails
> = {
  category: "dom_scraping",
  detailsType: "dom_scraping",
  build: (params) => ({
    severity: "medium",
    title: `DOMスクレイピング検出: ${params.domain}`,
    description: `短時間に${params.callCount}回のDOM操作を検出`,
    domain: params.domain,
    details: {
      domain: params.domain,
      selector: params.selector,
      callCount: params.callCount,
    },
  }),
};

export const buildDOMScrapingAlert = createAlertBuilder(DOM_SCRAPING_ALERT_DEFINITION);

export interface SuspiciousDownloadAlertParams {
  domain: string;
  downloadType: string;
  filename: string;
  extension: string;
  size: number;
  mimeType: string;
}

/** 実行可能ファイルの拡張子リスト */
const EXECUTABLE_EXTENSIONS = [".exe", ".msi", ".bat", ".ps1"];

const SUSPICIOUS_DOWNLOAD_ALERT_DEFINITION: AlertDefinition<
  SuspiciousDownloadAlertParams,
  SuspiciousDownloadAlertDetails
> = {
  category: "suspicious_download",
  detailsType: "suspicious_download",
  build: (params, helpers) => {
    const normalizedExtension = (params.extension || "").toLowerCase();
    const isExecutable = EXECUTABLE_EXTENSIONS.includes(normalizedExtension);
    const severity = helpers.resolveSeverity([[isExecutable, "critical"]], "high");

    return {
      severity,
      title: `疑わしいダウンロード検出: ${params.filename || params.downloadType}`,
      description: `${params.domain}から疑わしいファイルをダウンロード`,
      domain: params.domain,
      details: {
        domain: params.domain,
        downloadType: params.downloadType,
        filename: params.filename,
        extension: params.extension,
        size: params.size,
        mimeType: params.mimeType,
      },
    };
  },
};

export const buildSuspiciousDownloadAlert = createAlertBuilder(
  SUSPICIOUS_DOWNLOAD_ALERT_DEFINITION
);

export interface CanvasFingerprintAlertParams {
  domain: string;
  callCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

const CANVAS_FINGERPRINT_ALERT_DEFINITION: AlertDefinition<
  CanvasFingerprintAlertParams,
  CanvasFingerprintAlertDetails
> = {
  category: "canvas_fingerprint",
  detailsType: "canvas_fingerprint",
  build: (params) => ({
    severity: "high",
    title: `Canvas指紋採取検出: ${params.domain}`,
    description: `Canvas APIを${params.callCount}回呼び出してフィンガープリントを収集`,
    domain: params.domain,
    details: {
      domain: params.domain,
      callCount: params.callCount,
      canvasWidth: params.canvasWidth,
      canvasHeight: params.canvasHeight,
    },
  }),
};

export const buildCanvasFingerprintAlert = createAlertBuilder(
  CANVAS_FINGERPRINT_ALERT_DEFINITION
);

export interface WebGLFingerprintAlertParams {
  domain: string;
  parameter: number;
}

const WEBGL_FINGERPRINT_ALERT_DEFINITION: AlertDefinition<
  WebGLFingerprintAlertParams,
  WebGLFingerprintAlertDetails
> = {
  category: "webgl_fingerprint",
  detailsType: "webgl_fingerprint",
  build: (params) => ({
    severity: "high",
    title: `WebGL指紋採取検出: ${params.domain}`,
    description: "WebGLパラメータを取得してフィンガープリントを収集",
    domain: params.domain,
    details: {
      domain: params.domain,
      parameter: params.parameter,
    },
  }),
};

export const buildWebGLFingerprintAlert = createAlertBuilder(
  WEBGL_FINGERPRINT_ALERT_DEFINITION
);

export interface AudioFingerprintAlertParams {
  domain: string;
  contextCount: number;
  sampleRate?: number;
}

const AUDIO_FINGERPRINT_ALERT_DEFINITION: AlertDefinition<
  AudioFingerprintAlertParams,
  AudioFingerprintAlertDetails
> = {
  category: "audio_fingerprint",
  detailsType: "audio_fingerprint",
  build: (params) => ({
    severity: "high",
    title: `Audio指紋採取検出: ${params.domain}`,
    description: `AudioContextを${params.contextCount}回生成してフィンガープリントを収集`,
    domain: params.domain,
    details: {
      domain: params.domain,
      contextCount: params.contextCount,
      sampleRate: params.sampleRate,
    },
  }),
};

export const buildAudioFingerprintAlert = createAlertBuilder(
  AUDIO_FINGERPRINT_ALERT_DEFINITION
);

// ============================================================================
// Dynamic Code Execution
// ============================================================================

export interface DynamicCodeExecutionAlertParams {
  domain: string;
  method: string;
  codeLength: number;
}

const DYNAMIC_CODE_EXECUTION_ALERT_DEFINITION: AlertDefinition<
  DynamicCodeExecutionAlertParams,
  DynamicCodeExecutionAlertDetails
> = {
  category: "dynamic_code_execution",
  detailsType: "dynamic_code_execution",
  build: (params) => ({
    severity: "high",
    title: `動的コード実行検出: ${params.domain}`,
    description: `${params.method}による動的コード実行（${params.codeLength}文字）`,
    domain: params.domain,
    details: {
      domain: params.domain,
      method: params.method,
      codeLength: params.codeLength,
    },
  }),
};

export const buildDynamicCodeExecutionAlert = createAlertBuilder(
  DYNAMIC_CODE_EXECUTION_ALERT_DEFINITION
);

// ============================================================================
// Fullscreen Phishing
// ============================================================================

export interface FullscreenPhishingAlertParams {
  domain: string;
  element: string;
}

const FULLSCREEN_PHISHING_ALERT_DEFINITION: AlertDefinition<
  FullscreenPhishingAlertParams,
  FullscreenPhishingAlertDetails
> = {
  category: "fullscreen_phishing",
  detailsType: "fullscreen_phishing",
  build: (params) => ({
    severity: "critical",
    title: `フルスクリーンフィッシング検出: ${params.domain}`,
    description: `${params.element}要素がフルスクリーン表示を要求`,
    domain: params.domain,
    details: {
      domain: params.domain,
      element: params.element,
    },
  }),
};

export const buildFullscreenPhishingAlert = createAlertBuilder(
  FULLSCREEN_PHISHING_ALERT_DEFINITION
);

// ============================================================================
// Clipboard Read
// ============================================================================

export interface ClipboardReadAlertParams {
  domain: string;
}

const CLIPBOARD_READ_ALERT_DEFINITION: AlertDefinition<
  ClipboardReadAlertParams,
  ClipboardReadAlertDetails
> = {
  category: "clipboard_read",
  detailsType: "clipboard_read",
  build: (params) => ({
    severity: "medium",
    title: `クリップボード読み取り検出: ${params.domain}`,
    description: "スクリプトがクリップボードの内容を読み取りました",
    domain: params.domain,
    details: {
      domain: params.domain,
    },
  }),
};

export const buildClipboardReadAlert = createAlertBuilder(
  CLIPBOARD_READ_ALERT_DEFINITION
);

// ============================================================================
// Geolocation Access
// ============================================================================

export interface GeolocationAccessAlertParams {
  domain: string;
  method: string;
  highAccuracy: boolean;
}

const GEOLOCATION_ACCESS_ALERT_DEFINITION: AlertDefinition<
  GeolocationAccessAlertParams,
  GeolocationAccessAlertDetails
> = {
  category: "geolocation_access",
  detailsType: "geolocation_access",
  build: (params, helpers) => {
    const severity = helpers.resolveSeverity(
      [[params.highAccuracy, "high"]],
      "medium"
    );

    return {
      severity,
      title: `位置情報アクセス検出: ${params.domain}`,
      description: `${params.method}${params.highAccuracy ? "（高精度）" : ""}で位置情報を取得`,
      domain: params.domain,
      details: {
        domain: params.domain,
        method: params.method,
        highAccuracy: params.highAccuracy,
      },
    };
  },
};

export const buildGeolocationAccessAlert = createAlertBuilder(
  GEOLOCATION_ACCESS_ALERT_DEFINITION
);

// ============================================================================
// WebSocket Connection
// ============================================================================

export interface WebSocketConnectionAlertParams {
  domain: string;
  hostname: string;
  isExternal: boolean;
}

const WEBSOCKET_CONNECTION_ALERT_DEFINITION: AlertDefinition<
  WebSocketConnectionAlertParams,
  WebSocketConnectionAlertDetails
> = {
  category: "websocket_connection",
  detailsType: "websocket_connection",
  build: (params, helpers) => {
    const severity = helpers.resolveSeverity(
      [[params.isExternal, "high"]],
      "medium"
    );

    return {
      severity,
      title: `WebSocket接続検出: ${params.hostname}`,
      description: params.isExternal
        ? `外部ホスト${params.hostname}へのWebSocket接続`
        : `${params.hostname}へのWebSocket接続`,
      domain: params.domain,
      details: {
        domain: params.domain,
        hostname: params.hostname,
        isExternal: params.isExternal,
      },
    };
  },
};

export const buildWebSocketConnectionAlert = createAlertBuilder(
  WEBSOCKET_CONNECTION_ALERT_DEFINITION
);

// ============================================================================
// WebRTC Connection
// ============================================================================

export interface WebRTCConnectionAlertParams {
  domain: string;
}

const WEBRTC_CONNECTION_ALERT_DEFINITION: AlertDefinition<
  WebRTCConnectionAlertParams,
  WebRTCConnectionAlertDetails
> = {
  category: "webrtc_connection",
  detailsType: "webrtc_connection",
  build: (params) => ({
    severity: "medium",
    title: `WebRTC接続検出: ${params.domain}`,
    description: "WebRTCピア接続が作成されました（IP漏洩リスク）",
    domain: params.domain,
    details: {
      domain: params.domain,
    },
  }),
};

export const buildWebRTCConnectionAlert = createAlertBuilder(
  WEBRTC_CONNECTION_ALERT_DEFINITION
);

// ============================================================================
// BroadcastChannel
// ============================================================================

export interface BroadcastChannelAlertParams {
  domain: string;
  channelName: string;
}

const BROADCAST_CHANNEL_ALERT_DEFINITION: AlertDefinition<
  BroadcastChannelAlertParams,
  BroadcastChannelAlertDetails
> = {
  category: "broadcast_channel",
  detailsType: "broadcast_channel",
  build: (params) => ({
    severity: "medium",
    title: `BroadcastChannel検出: ${params.domain}`,
    description: `チャネル「${params.channelName}」によるタブ間通信`,
    domain: params.domain,
    details: {
      domain: params.domain,
      channelName: params.channelName,
    },
  }),
};

export const buildBroadcastChannelAlert = createAlertBuilder(
  BROADCAST_CHANNEL_ALERT_DEFINITION
);

// ============================================================================
// Send Beacon (Covert Exfiltration)
// ============================================================================

export interface SendBeaconAlertParams {
  domain: string;
  url: string;
  dataSize: number;
}

const SEND_BEACON_ALERT_DEFINITION: AlertDefinition<
  SendBeaconAlertParams,
  SendBeaconAlertDetails
> = {
  category: "send_beacon",
  detailsType: "send_beacon",
  build: (params, helpers) => {
    const severity = helpers.resolveSeverity(
      [[params.dataSize > 1024, "high"]],
      "medium"
    );

    return {
      severity,
      title: `Beacon送信検出: ${params.domain}`,
      description: `sendBeaconで${params.dataSize}バイトのデータを送信`,
      domain: params.domain,
      details: {
        domain: params.domain,
        url: params.url,
        dataSize: params.dataSize,
      },
    };
  },
};

export const buildSendBeaconAlert = createAlertBuilder(
  SEND_BEACON_ALERT_DEFINITION
);

// ============================================================================
// Media Capture
// ============================================================================

export interface MediaCaptureAlertParams {
  domain: string;
  method: string;
  audio: boolean;
  video: boolean;
}

const MEDIA_CAPTURE_ALERT_DEFINITION: AlertDefinition<
  MediaCaptureAlertParams,
  MediaCaptureAlertDetails
> = {
  category: "media_capture",
  detailsType: "media_capture",
  build: (params, helpers) => {
    const isScreenCapture = params.method === "getDisplayMedia";
    const severity = helpers.resolveSeverity(
      [[isScreenCapture, "critical"]],
      "high"
    );

    const mediaTypes = [
      params.video ? (isScreenCapture ? "画面" : "カメラ") : "",
      params.audio ? "マイク" : "",
    ].filter(Boolean).join("・");

    return {
      severity,
      title: `メディアキャプチャ検出: ${params.domain}`,
      description: `${mediaTypes}へのアクセスを要求`,
      domain: params.domain,
      details: {
        domain: params.domain,
        method: params.method,
        audio: params.audio,
        video: params.video,
      },
    };
  },
};

export const buildMediaCaptureAlert = createAlertBuilder(
  MEDIA_CAPTURE_ALERT_DEFINITION
);

// ============================================================================
// Notification Phishing
// ============================================================================

export interface NotificationPhishingAlertParams {
  domain: string;
  title: string;
}

const NOTIFICATION_PHISHING_ALERT_DEFINITION: AlertDefinition<
  NotificationPhishingAlertParams,
  NotificationPhishingAlertDetails
> = {
  category: "notification_phishing",
  detailsType: "notification_phishing",
  build: (params) => ({
    severity: "high",
    title: `通知フィッシング検出: ${params.domain}`,
    description: `偽の通知「${params.title}」を表示`,
    domain: params.domain,
    details: {
      domain: params.domain,
      title: params.title,
    },
  }),
};

export const buildNotificationPhishingAlert = createAlertBuilder(
  NOTIFICATION_PHISHING_ALERT_DEFINITION
);

// ============================================================================
// Credential API
// ============================================================================

export interface CredentialAPIAlertParams {
  domain: string;
  method: string;
}

const CREDENTIAL_API_ALERT_DEFINITION: AlertDefinition<
  CredentialAPIAlertParams,
  CredentialAPIAlertDetails
> = {
  category: "credential_api",
  detailsType: "credential_api",
  build: (params) => ({
    severity: "high",
    title: `認証情報API検出: ${params.domain}`,
    description: `Credential Management APIの${params.method}が呼び出されました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      method: params.method,
    },
  }),
};

export const buildCredentialAPIAlert = createAlertBuilder(
  CREDENTIAL_API_ALERT_DEFINITION
);

// ============================================================================
// Device Sensor
// ============================================================================

export interface DeviceSensorAlertParams {
  domain: string;
  sensorType: string;
}

const DEVICE_SENSOR_ALERT_DEFINITION: AlertDefinition<
  DeviceSensorAlertParams,
  DeviceSensorAlertDetails
> = {
  category: "device_sensor",
  detailsType: "device_sensor",
  build: (params) => ({
    severity: "medium",
    title: `デバイスセンサー検出: ${params.domain}`,
    description: `${params.sensorType}イベントのリスナーが登録されました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      sensorType: params.sensorType,
    },
  }),
};

export const buildDeviceSensorAlert = createAlertBuilder(
  DEVICE_SENSOR_ALERT_DEFINITION
);

// ============================================================================
// Device Enumeration
// ============================================================================

export interface DeviceEnumerationAlertParams {
  domain: string;
}

const DEVICE_ENUMERATION_ALERT_DEFINITION: AlertDefinition<
  DeviceEnumerationAlertParams,
  DeviceEnumerationAlertDetails
> = {
  category: "device_enumeration",
  detailsType: "device_enumeration",
  build: (params) => ({
    severity: "medium",
    title: `デバイス列挙検出: ${params.domain}`,
    description: "接続されたメディアデバイスが列挙されました",
    domain: params.domain,
    details: {
      domain: params.domain,
    },
  }),
};

export const buildDeviceEnumerationAlert = createAlertBuilder(
  DEVICE_ENUMERATION_ALERT_DEFINITION
);

// ============================================================================
// Storage Exfiltration
// ============================================================================

export interface StorageExfiltrationAlertParams {
  domain: string;
  storageType: string;
  accessCount: number;
}

const STORAGE_EXFILTRATION_ALERT_DEFINITION: AlertDefinition<
  StorageExfiltrationAlertParams,
  StorageExfiltrationAlertDetails
> = {
  category: "storage_exfiltration",
  detailsType: "storage_exfiltration",
  build: (params) => ({
    severity: "high",
    title: `ストレージ大量アクセス検出: ${params.domain}`,
    description: `${params.storageType}に短時間で${params.accessCount}回アクセス`,
    domain: params.domain,
    details: {
      domain: params.domain,
      storageType: params.storageType,
      accessCount: params.accessCount,
    },
  }),
};

export const buildStorageExfiltrationAlert = createAlertBuilder(
  STORAGE_EXFILTRATION_ALERT_DEFINITION
);

// ============================================================================
// Prototype Pollution
// ============================================================================

export interface PrototypePollutionAlertParams {
  domain: string;
  target: string;
  property: string;
  method: string;
}

const PROTOTYPE_POLLUTION_ALERT_DEFINITION: AlertDefinition<
  PrototypePollutionAlertParams,
  PrototypePollutionAlertDetails
> = {
  category: "prototype_pollution",
  detailsType: "prototype_pollution",
  build: (params) => ({
    severity: "critical",
    title: `プロトタイプ汚染攻撃検出: ${params.domain}`,
    description: `${params.method}を使用して${params.target}.${params.property}が変更されました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      target: params.target,
      property: params.property,
      method: params.method,
    },
  }),
};

export const buildPrototypePollutionAlert = createAlertBuilder(
  PROTOTYPE_POLLUTION_ALERT_DEFINITION
);

// ============================================================================
// DNS Prefetch Leak
// ============================================================================

export interface DNSPrefetchLeakAlertParams {
  domain: string;
  rel: string;
  href: string;
}

const DNS_PREFETCH_LEAK_ALERT_DEFINITION: AlertDefinition<
  DNSPrefetchLeakAlertParams,
  DNSPrefetchLeakAlertDetails
> = {
  category: "dns_prefetch_leak",
  detailsType: "dns_prefetch_leak",
  build: (params) => ({
    severity: "medium",
    title: `DNSプリフェッチリーク検出: ${params.domain}`,
    description: `動的に追加された<link rel="${params.rel}">が外部ドメインへの情報漏洩経路になる可能性があります`,
    domain: params.domain,
    details: {
      domain: params.domain,
      rel: params.rel,
      href: params.href,
    },
  }),
};

export const buildDNSPrefetchLeakAlert = createAlertBuilder(
  DNS_PREFETCH_LEAK_ALERT_DEFINITION
);

// ============================================================================
// Form Hijack
// ============================================================================

export interface FormHijackAlertParams {
  domain: string;
  originalAction: string;
  newAction: string;
  targetDomain: string;
}

const FORM_HIJACK_ALERT_DEFINITION: AlertDefinition<
  FormHijackAlertParams,
  FormHijackAlertDetails
> = {
  category: "form_hijack",
  detailsType: "form_hijack",
  build: (params) => ({
    severity: "critical",
    title: `フォームハイジャック検出: ${params.domain}`,
    description: `フォームの送信先が${params.originalAction}から${params.targetDomain}へ変更されました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      originalAction: params.originalAction,
      newAction: params.newAction,
      targetDomain: params.targetDomain,
    },
  }),
};

export const buildFormHijackAlert = createAlertBuilder(
  FORM_HIJACK_ALERT_DEFINITION
);

// ============================================================================
// CSS Keylogging
// ============================================================================

export interface CSSKeyloggingAlertParams {
  domain: string;
  sampleRule: string;
}

const CSS_KEYLOGGING_ALERT_DEFINITION: AlertDefinition<
  CSSKeyloggingAlertParams,
  CSSKeyloggingAlertDetails
> = {
  category: "css_keylogging",
  detailsType: "css_keylogging",
  build: (params) => ({
    severity: "critical",
    title: `CSSキーロギング検出: ${params.domain}`,
    description: "input[value]属性セレクタとbackground-imageを組み合わせたCSSキーロギングを検出",
    domain: params.domain,
    details: {
      domain: params.domain,
      sampleRule: params.sampleRule,
    },
  }),
};

export const buildCSSKeyloggingAlert = createAlertBuilder(
  CSS_KEYLOGGING_ALERT_DEFINITION
);

// ============================================================================
// PerformanceObserver Side Channel
// ============================================================================

export interface PerformanceObserverAlertParams {
  domain: string;
  entryType: string;
}

const PERFORMANCE_OBSERVER_ALERT_DEFINITION: AlertDefinition<
  PerformanceObserverAlertParams,
  PerformanceObserverAlertDetails
> = {
  category: "performance_observer",
  detailsType: "performance_observer",
  build: (params) => ({
    severity: "medium",
    title: `PerformanceObserverサイドチャネル検出: ${params.domain}`,
    description: `PerformanceObserverが「${params.entryType}」エントリを監視しています（タイミング情報によるサイドチャネル攻撃の可能性）`,
    domain: params.domain,
    details: {
      domain: params.domain,
      entryType: params.entryType,
    },
  }),
};

export const buildPerformanceObserverAlert = createAlertBuilder(
  PERFORMANCE_OBSERVER_ALERT_DEFINITION
);

// ============================================================================
// postMessage Exfiltration
// ============================================================================

export interface PostMessageExfilAlertParams {
  domain: string;
  targetOrigin: string;
}

const POSTMESSAGE_EXFIL_ALERT_DEFINITION: AlertDefinition<
  PostMessageExfilAlertParams,
  PostMessageExfilAlertDetails
> = {
  category: "postmessage_exfil",
  detailsType: "postmessage_exfil",
  build: (params) => ({
    severity: "high",
    title: `postMessageクロスオリジン送信検出: ${params.domain}`,
    description: `window.postMessageで別オリジン「${params.targetOrigin}」へデータを送信しています`,
    domain: params.domain,
    details: {
      domain: params.domain,
      targetOrigin: params.targetOrigin,
    },
  }),
};

export const buildPostMessageExfilAlert = createAlertBuilder(
  POSTMESSAGE_EXFIL_ALERT_DEFINITION
);

// ============================================================================
// DOM Clobbering
// ============================================================================

export interface DOMClobberingAlertParams {
  domain: string;
  attributeName: string;
  attributeValue: string;
}

const DOM_CLOBBERING_ALERT_DEFINITION: AlertDefinition<
  DOMClobberingAlertParams,
  DOMClobberingAlertDetails
> = {
  category: "dom_clobbering",
  detailsType: "dom_clobbering",
  build: (params) => ({
    severity: "high",
    title: `DOMクロッバリング検出: ${params.domain}`,
    description: `${params.attributeName}="${params.attributeValue}"を持つ要素がグローバル変数を上書きする可能性があります`,
    domain: params.domain,
    details: {
      domain: params.domain,
      attributeName: params.attributeName,
      attributeValue: params.attributeValue,
    },
  }),
};

export const buildDOMClobberingAlert = createAlertBuilder(
  DOM_CLOBBERING_ALERT_DEFINITION
);

// ============================================================================
// Cache API Abuse
// ============================================================================

export interface CacheAPIAbuseAlertParams {
  domain: string;
  operation: string;
  cacheName: string;
  url?: string;
}

const CACHE_API_ABUSE_ALERT_DEFINITION: AlertDefinition<
  CacheAPIAbuseAlertParams,
  CacheAPIAbuseAlertDetails
> = {
  category: "cache_api_abuse",
  detailsType: "cache_api_abuse",
  build: (params, helpers) => {
    const isPut = params.operation === "put";
    const severity = helpers.resolveSeverity([[isPut, "high"]], "medium");
    const description = isPut
      ? `キャッシュ「${params.cacheName}」にデータを書き込みました（URL: ${params.url ?? "不明"}）`
      : `Cache APIで「${params.cacheName}」を開きました`;

    return {
      severity,
      title: `Cache APIの不正使用を検出: ${params.domain}`,
      description,
      domain: params.domain,
      details: {
        domain: params.domain,
        operation: params.operation,
        cacheName: params.cacheName,
        url: params.url,
      },
    };
  },
};

export const buildCacheAPIAbuseAlert = createAlertBuilder(
  CACHE_API_ABUSE_ALERT_DEFINITION
);

// ============================================================================
// Fetch Exfiltration
// ============================================================================

export interface FetchExfiltrationAlertParams {
  domain: string;
  url: string;
  mode: string;
  reason: string;
  bodySize?: number;
}

const FETCH_EXFILTRATION_ALERT_DEFINITION: AlertDefinition<
  FetchExfiltrationAlertParams,
  FetchExfiltrationAlertDetails
> = {
  category: "fetch_exfiltration",
  detailsType: "fetch_exfiltration",
  build: (params, helpers) => {
    const isNoCors = params.reason === "cross_origin_no_cors";
    const severity = helpers.resolveSeverity([[isNoCors, "high"]], "medium");
    const description = isNoCors
      ? `no-corsモードでクロスオリジンfetch: ${params.url}`
      : `クロスオリジンfetchで${params.bodySize ?? 0}バイトのデータを送信: ${params.url}`;

    return {
      severity,
      title: `fetchによるデータ流出を検出: ${params.domain}`,
      description,
      domain: params.domain,
      details: {
        domain: params.domain,
        url: params.url,
        mode: params.mode,
        reason: params.reason,
        bodySize: params.bodySize,
      },
    };
  },
};

export const buildFetchExfiltrationAlert = createAlertBuilder(
  FETCH_EXFILTRATION_ALERT_DEFINITION
);

// ============================================================================
// WASM Execution
// ============================================================================

export interface WASMExecutionAlertParams {
  domain: string;
  method: string;
  byteLength: number | null;
}

const WASM_EXECUTION_ALERT_DEFINITION: AlertDefinition<
  WASMExecutionAlertParams,
  WASMExecutionAlertDetails
> = {
  category: "wasm_execution",
  detailsType: "wasm_execution",
  build: (params) => ({
    severity: "high",
    title: `WebAssembly実行を検出: ${params.domain}`,
    description: `WebAssembly.${params.method}${params.byteLength !== null ? `（${params.byteLength}バイト）` : ""}が呼び出されました`,
    domain: params.domain,
    details: {
      domain: params.domain,
      method: params.method,
      byteLength: params.byteLength,
    },
  }),
};

export const buildWASMExecutionAlert = createAlertBuilder(
  WASM_EXECUTION_ALERT_DEFINITION
);

// ============================================================================
// IntersectionObserver Surveillance
// ============================================================================

export interface IntersectionObserverAlertParams {
  domain: string;
  observedCount: number;
}

const INTERSECTION_OBSERVER_ALERT_DEFINITION: AlertDefinition<
  IntersectionObserverAlertParams,
  IntersectionObserverAlertDetails
> = {
  category: "intersection_observer",
  detailsType: "intersection_observer",
  build: (params, helpers) => {
    const isBulk = params.observedCount > 5;
    const severity = helpers.resolveSeverity([[isBulk, "medium"]], "low");
    const description = isBulk
      ? `${params.observedCount}個の要素を一括監視（バルクサーベイランスパターン）`
      : "IntersectionObserverが生成されました";

    return {
      severity,
      title: `IntersectionObserverによるサーベイランスを検出: ${params.domain}`,
      description,
      domain: params.domain,
      details: {
        domain: params.domain,
        observedCount: params.observedCount,
      },
    };
  },
};

export const buildIntersectionObserverAlert = createAlertBuilder(
  INTERSECTION_OBSERVER_ALERT_DEFINITION
);

// ============================================================================
// IndexedDB Abuse
// ============================================================================

export interface IndexedDBAbuseAlertParams {
  domain: string;
  dbName: string;
  version: number | null;
}

const INDEXEDDB_ABUSE_ALERT_DEFINITION: AlertDefinition<
  IndexedDBAbuseAlertParams,
  IndexedDBAbuseAlertDetails
> = {
  category: "indexeddb_abuse",
  detailsType: "indexeddb_abuse",
  build: (params) => ({
    severity: "medium",
    title: `IndexedDBへの不審なアクセスを検出: ${params.domain}`,
    description: `データベース「${params.dbName}」${params.version !== null ? `（バージョン${params.version}）` : ""}を開きました — データ永続化の可能性`,
    domain: params.domain,
    details: {
      domain: params.domain,
      dbName: params.dbName,
      version: params.version,
    },
  }),
};

export const buildIndexedDBAbuseAlert = createAlertBuilder(
  INDEXEDDB_ABUSE_ALERT_DEFINITION
);

// ============================================================================
// History API Manipulation
// ============================================================================

export interface HistoryManipulationAlertParams {
  domain: string;
  method: string;
  url: string | null;
  hasState: boolean;
}

const HISTORY_MANIPULATION_ALERT_DEFINITION: AlertDefinition<
  HistoryManipulationAlertParams,
  HistoryManipulationAlertDetails
> = {
  category: "history_manipulation",
  detailsType: "history_manipulation",
  build: (params, helpers) => {
    // An absolute URL with a different origin than the page domain suggests potential address bar spoofing.
    const hasAbsoluteUrl = (() => {
      if (!params.url) return false;
      try {
        const parsed = new URL(params.url);
        // Absolute URL with http/https scheme is a stronger manipulation signal
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        // Relative URL — normal SPA navigation
        return false;
      }
    })();
    const severity = helpers.resolveSeverity([[hasAbsoluteUrl && params.hasState, "high"], [hasAbsoluteUrl, "medium"]], "low");
    const description = params.url
      ? `history.${params.method}でURLを「${params.url}」に変更${params.hasState ? "（状態データあり）" : ""}`
      : `history.${params.method}が呼び出されました${params.hasState ? "（状態データあり）" : ""}`;

    return {
      severity,
      title: `History APIの操作を検出: ${params.domain}`,
      description,
      domain: params.domain,
      details: {
        domain: params.domain,
        method: params.method,
        url: params.url,
        hasState: params.hasState,
      },
    };
  },
};

export const buildHistoryManipulationAlert = createAlertBuilder(
  HISTORY_MANIPULATION_ALERT_DEFINITION
);
