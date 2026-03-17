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
}

const DATA_EXFILTRATION_ALERT_DEFINITION: AlertDefinition<
  DataExfiltrationAlertParams,
  DataExfiltrationAlertDetails
> = {
  category: "data_exfiltration",
  detailsType: "data_exfiltration",
  build: (params, helpers) => {
    const sizeKB = Math.round(params.bodySize / 1024);
    const severity = helpers.resolveSeverity([[sizeKB > 500, "critical"]], "high");

    return {
      severity,
      title: `大量データ送信検出: ${params.targetDomain}`,
      description: `${params.sourceDomain}から${sizeKB}KBのデータを${params.targetDomain}に送信`,
      domain: params.targetDomain,
      details: {
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        bodySize: params.bodySize,
        sizeKB,
        method: params.method,
        initiator: params.initiator,
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
  action: "allow" | "block" | "warn";
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

    const severity = helpers.resolveSeverity([[params.action === "block", "high"]], "medium");
    const actionLabel = params.action === "block" ? "ブロック" : "警告";
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
