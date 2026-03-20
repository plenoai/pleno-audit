import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { NRDResult, TyposquatResult } from "@pleno-audit/detectors";
import type { NetworkRequestRecord } from "@pleno-audit/extension-runtime";
import type { ParquetEvent } from "./types.js";

// Parquetスキーマ定義（parquet-wasmで使用可能な形式）
export const SCHEMAS = {
  "csp-violations": {
    type: "struct",
    fields: [
      { name: "timestamp", type: "string" },
      { name: "pageUrl", type: "string" },
      { name: "directive", type: "string" },
      { name: "blockedURL", type: "string" },
      { name: "domain", type: "string" },
      { name: "disposition", type: { type: "option", inner: "string" } },
      { name: "originalPolicy", type: { type: "option", inner: "string" } },
      { name: "sourceFile", type: { type: "option", inner: "string" } },
      { name: "lineNumber", type: { type: "option", inner: "int32" } },
      { name: "columnNumber", type: { type: "option", inner: "int32" } },
      { name: "statusCode", type: { type: "option", inner: "int32" } },
    ],
  },

  "network-requests": {
    type: "struct",
    fields: [
      { name: "id", type: "string" },
      { name: "timestamp", type: "int64" },
      { name: "url", type: "string" },
      { name: "method", type: "string" },
      { name: "domain", type: "string" },
      { name: "resourceType", type: "string" },
      { name: "initiator", type: { type: "option", inner: "string" } },
      { name: "initiatorType", type: "string" },
      { name: "extensionId", type: { type: "option", inner: "string" } },
      { name: "extensionName", type: { type: "option", inner: "string" } },
      { name: "tabId", type: "int32" },
      { name: "frameId", type: "int32" },
      { name: "detectedBy", type: "string" },
    ],
  },

  events: {
    type: "struct",
    fields: [
      { name: "id", type: "string" },
      { name: "type", type: "string" },
      { name: "domain", type: "string" },
      { name: "timestamp", type: "int64" },
      { name: "details", type: "string" },
    ],
  },

  "ai-prompts": {
    type: "struct",
    fields: [
      { name: "id", type: "string" },
      { name: "timestamp", type: "int64" },
      { name: "url", type: "string" },
      { name: "prompt", type: "string" },
      { name: "service", type: { type: "option", inner: "string" } },
    ],
  },

  "nrd-detections": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "checkedAt", type: "int64" },
      { name: "isNRD", type: "bool" },
      { name: "confidence", type: "string" },
      { name: "domainAge", type: { type: "option", inner: "int32" } },
      { name: "registrationDate", type: { type: "option", inner: "string" } },
      { name: "method", type: "string" },
      { name: "suspiciousScore", type: { type: "option", inner: "double" } },
      { name: "isDDNS", type: "bool" },
      { name: "ddnsProvider", type: { type: "option", inner: "string" } },
    ],
  },

  "typosquat-detections": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "checkedAt", type: "int64" },
      { name: "isTyposquat", type: "bool" },
      { name: "confidence", type: "string" },
      { name: "totalScore", type: "double" },
      { name: "homoglyphCount", type: "int32" },
      { name: "hasMixedScript", type: "bool" },
      { name: "detectedScripts", type: "string" },
    ],
  },

  // Phase 8: Cookie検出
  "cookies": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "name", type: "string" },
      { name: "detectedAt", type: "int64" },
      { name: "value", type: { type: "option", inner: "string" } },
      { name: "isSession", type: "bool" },
      { name: "expirationDate", type: { type: "option", inner: "int64" } },
      { name: "secure", type: { type: "option", inner: "bool" } },
      { name: "httpOnly", type: { type: "option", inner: "bool" } },
      { name: "sameSite", type: { type: "option", inner: "string" } },
    ],
  },

  // Phase 9: ページ分析結果
  "login-detections": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "detectedAt", type: "int64" },
      { name: "hasPasswordInput", type: "bool" },
      { name: "isLoginUrl", type: "bool" },
    ],
  },

  "privacy-policies": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "detectedAt", type: "int64" },
      { name: "url", type: "string" },
      { name: "method", type: "string" },
    ],
  },

  "terms-of-service": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "detectedAt", type: "int64" },
      { name: "url", type: "string" },
      { name: "method", type: "string" },
    ],
  },

  // Phase 10: ドメインリスクプロファイル
  "domain-risk-profiles": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "profiledAt", type: "int64" },
      { name: "isNRD", type: "bool" },
      { name: "isTyposquat", type: "bool" },
      { name: "hasLoginPage", type: "bool" },
      { name: "hasPrivacyPolicy", type: "bool" },
      { name: "hasTermsOfService", type: "bool" },
      { name: "hasAIActivity", type: "bool" },
      { name: "cookieCount", type: "int32" },
      { name: "faviconUrl", type: { type: "option", inner: "string" } },
      { name: "aiProviders", type: { type: "option", inner: "string" } },
      { name: "riskLevel", type: "string" },
    ],
  },

  // Phase 11: サービスインベントリスナップショット
  "service-inventory": {
    type: "struct",
    fields: [
      { name: "snapshotId", type: "string" },
      { name: "snapshotAt", type: "int64" },
      { name: "totalServices", type: "int32" },
      { name: "servicesWithLogin", type: "int32" },
      { name: "servicesWithPrivacy", type: "int32" },
      { name: "servicesWithTos", type: "int32" },
      { name: "servicesWithNRD", type: "int32" },
      { name: "servicesWithTyposquat", type: "int32" },
      { name: "servicesWithAI", type: "int32" },
      { name: "totalCookies", type: "int32" },
      { name: "highRiskDomains", type: "string" },
      { name: "criticalRiskDomains", type: "string" },
    ],
  },
};

// CSPViolationをParquetレコードに変換
export function cspViolationToParquetRecord(
  v: CSPViolation
): Record<string, unknown> {
  return {
    timestamp: v.timestamp,
    pageUrl: v.pageUrl,
    directive: v.directive,
    blockedURL: v.blockedURL,
    domain: v.domain,
    disposition: v.disposition || null,
    originalPolicy: v.originalPolicy || null,
    sourceFile: v.sourceFile || null,
    lineNumber: v.lineNumber || null,
    columnNumber: v.columnNumber || null,
    statusCode: v.statusCode || null,
  };
}

// ParquetレコードをCSPViolationに変換
export function parquetRecordToCspViolation(
  record: Record<string, unknown>
): CSPViolation {
  return {
    type: "csp-violation",
    timestamp: record.timestamp as string,
    pageUrl: record.pageUrl as string,
    directive: record.directive as string,
    blockedURL: record.blockedURL as string,
    domain: record.domain as string,
    disposition: (record.disposition as "enforce" | "report" | null) ?? "report",
    originalPolicy: (record.originalPolicy as string | null) || undefined,
    sourceFile: (record.sourceFile as string | null) || undefined,
    lineNumber: (record.lineNumber as number | null) || undefined,
    columnNumber: (record.columnNumber as number | null) || undefined,
    statusCode: (record.statusCode as number | null) || undefined,
  };
}

// NetworkRequestRecordをParquetレコードに変換
export function networkRequestRecordToParquetRecord(
  r: NetworkRequestRecord
): Record<string, unknown> {
  return {
    id: r.id,
    timestamp: r.timestamp,
    url: r.url,
    method: r.method,
    domain: r.domain,
    resourceType: r.resourceType,
    initiator: r.initiator || null,
    initiatorType: r.initiatorType,
    extensionId: r.extensionId || null,
    extensionName: r.extensionName || null,
    tabId: r.tabId,
    frameId: r.frameId,
    detectedBy: r.detectedBy,
  };
}

// ParquetレコードをNetworkRequestRecordに変換
export function parquetRecordToNetworkRequestRecord(
  record: Record<string, unknown>
): NetworkRequestRecord {
  return {
    id: record.id as string,
    timestamp: record.timestamp as number,
    url: record.url as string,
    method: record.method as string,
    domain: record.domain as string,
    resourceType: record.resourceType as string,
    initiator: (record.initiator as string | null) || null,
    initiatorType: record.initiatorType as "extension" | "page" | "browser" | "unknown",
    extensionId: (record.extensionId as string | undefined) || undefined,
    extensionName: (record.extensionName as string | undefined) || undefined,
    tabId: record.tabId as number,
    frameId: record.frameId as number,
    detectedBy: record.detectedBy as "webRequest" | "declarativeNetRequest",
  };
}

// NetworkRequestをParquetレコードに変換（CSP互換性のため保持）
export function networkRequestToParquetRecord(
  r: NetworkRequest
): Record<string, unknown> {
  return {
    timestamp: r.timestamp,
    pageUrl: r.pageUrl,
    url: r.url,
    method: r.method,
    initiator: r.initiator,
    domain: r.domain,
    resourceType: r.resourceType || null,
  };
}

// ParquetレコードをNetworkRequestに変換（CSP互換性のため保持）
export function parquetRecordToNetworkRequest(
  record: Record<string, unknown>
): NetworkRequest {
  return {
    type: "network-request",
    timestamp: record.timestamp as string,
    pageUrl: record.pageUrl as string,
    url: record.url as string,
    method: record.method as string,
    initiator: record.initiator as NetworkRequest["initiator"],
    domain: record.domain as string,
    resourceType: (record.resourceType as string | null) || undefined,
  };
}

// ParquetEventをレコードに変換
export function eventToParquetRecord(
  event: Omit<ParquetEvent, "id"> & { id?: string }
): Record<string, unknown> {
  return {
    id: event.id || generateId(),
    type: event.type,
    domain: event.domain,
    timestamp: event.timestamp,
    details: event.details,
  };
}

// Parquetレコードをイベントに変換
export function parquetRecordToEvent(
  record: Record<string, unknown>
): ParquetEvent {
  return {
    id: record.id as string,
    type: record.type as string,
    domain: record.domain as string,
    timestamp: record.timestamp as number,
    details: record.details as string,
  };
}

// ユーティリティ関数
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getDateString(timestamp?: number | string | Date): string {
  const date =
    timestamp instanceof Date
      ? timestamp
      : new Date(
          typeof timestamp === "number"
            ? timestamp
            : timestamp
              ? new Date(timestamp).getTime()
              : Date.now()
        );
  return date.toISOString().split("T")[0];
}

export function getParquetFileName(
  type: string,
  date: string
): string {
  return `pleno-logs-${type}-${date}.parquet`;
}

export function parseParquetFileName(fileName: string): {
  type: string;
  date: string;
} | null {
  const match = fileName.match(/^pleno-logs-(.+)-(\d{4}-\d{2}-\d{2})\.parquet$/);
  if (!match) return null;
  return { type: match[1], date: match[2] };
}

// NRDResultをParquetレコードに変換
export function nrdResultToParquetRecord(
  result: NRDResult
): Record<string, unknown> {
  return {
    domain: result.domain,
    checkedAt: result.checkedAt,
    isNRD: result.isNRD,
    confidence: result.confidence,
    domainAge: result.domainAge || null,
    registrationDate: result.registrationDate || null,
    method: result.method,
    suspiciousScore: result.suspiciousScores?.totalScore || null,
    isDDNS: result.ddns?.isDDNS || false,
    ddnsProvider: result.ddns?.provider || null,
  };
}

// TyposquatResultをParquetレコードに変換
export function typosquatResultToParquetRecord(
  result: TyposquatResult
): Record<string, unknown> {
  return {
    domain: result.domain,
    checkedAt: result.checkedAt,
    isTyposquat: result.isTyposquat,
    confidence: result.confidence,
    totalScore: result.heuristics?.totalScore || 0,
    homoglyphCount: result.heuristics?.homoglyphs?.length || 0,
    hasMixedScript: result.heuristics?.hasMixedScript || false,
    detectedScripts: (result.heuristics?.detectedScripts || []).join(","),
  };
}

// Cookie型定義（CookieInfo相当）
interface CookieRecord {
  domain: string;
  name: string;
  detectedAt: number;
  value?: string;
  isSession?: boolean;
  expirationDate?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

// Phase 8: CookieをParquetレコードに変換
export function cookieToParquetRecord(
  cookie: CookieRecord
): Record<string, unknown> {
  return {
    domain: cookie.domain,
    name: cookie.name,
    detectedAt: cookie.detectedAt,
    value: cookie.value || null,
    isSession: cookie.isSession || false,
    expirationDate: cookie.expirationDate || null,
    secure: cookie.secure !== undefined ? cookie.secure : null,
    httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : null,
    sameSite: cookie.sameSite || null,
  };
}

// ログイン検出詳細型定義
interface LoginDetectedDetails {
  hasPasswordInput?: boolean;
  isLoginUrl?: boolean;
}

// Phase 9: LoginDetectedDetailsをParquetレコードに変換
export function loginDetectionToParquetRecord(
  domain: string,
  login: LoginDetectedDetails,
  detectedAt: number
): Record<string, unknown> {
  return {
    domain,
    detectedAt,
    hasPasswordInput: login.hasPasswordInput || false,
    isLoginUrl: login.isLoginUrl || false,
  };
}

// Phase 9: PrivacyPolicyDetectionをParquetレコードに変換
export function privacyPolicyToParquetRecord(
  domain: string,
  url: string,
  method: string,
  detectedAt: number
): Record<string, unknown> {
  return { domain, detectedAt, url, method };
}

// Phase 9: TermsOfServiceDetectionをParquetレコードに変換
export function termsOfServiceToParquetRecord(
  domain: string,
  url: string,
  method: string,
  detectedAt: number
): Record<string, unknown> {
  return { domain, detectedAt, url, method };
}

// DetectedService相当の型定義
interface ServiceForRiskProfile {
  domain: string;
  nrdResult?: { isNRD?: boolean };
  typosquatResult?: { isTyposquat?: boolean };
  hasLoginPage?: boolean;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  aiDetected?: { hasAIActivity?: boolean; providers?: string[] };
  cookies?: unknown[];
  faviconUrl?: string;
}

// Phase 10: Domain Risk Profileをレコードに変換
export function domainRiskProfileToParquetRecord(
  service: ServiceForRiskProfile
): Record<string, unknown> {
  // TODO: This ad-hoc risk level calculation diverges from the score-based
  // approach in @pleno-audit/alerts scoring-utils.ts. Consider unifying into
  // a shared risk-level strategy when parquet-storage can depend on alerts,
  // or extract a lightweight shared package.
  let riskLevel = "low";
  const riskFactors = [
    service.nrdResult?.isNRD || false,
    service.typosquatResult?.isTyposquat || false,
  ];
  const criticalFactors = riskFactors.filter(Boolean).length;

  if (criticalFactors >= 2) {
    riskLevel = "critical";
  } else if (criticalFactors === 1) {
    riskLevel = "high";
  } else if (
    service.aiDetected?.hasAIActivity ||
    (service.cookies && service.cookies.length > 0)
  ) {
    riskLevel = "medium";
  }

  return {
    domain: service.domain,
    profiledAt: Date.now(),
    isNRD: service.nrdResult?.isNRD || false,
    isTyposquat: service.typosquatResult?.isTyposquat || false,
    hasLoginPage: service.hasLoginPage || false,
    hasPrivacyPolicy: !!service.privacyPolicyUrl,
    hasTermsOfService: !!service.termsOfServiceUrl,
    hasAIActivity: service.aiDetected?.hasAIActivity || false,
    cookieCount: service.cookies?.length || 0,
    faviconUrl: service.faviconUrl || null,
    aiProviders: service.aiDetected?.providers?.join(",") || null,
    riskLevel,
  };
}

// Phase 11: Service Inventory Snapshotを生成
export function createServiceInventorySnapshot(
  services: Record<string, ServiceForRiskProfile>
): Record<string, unknown> {
  const serviceList = Object.values(services).filter(Boolean);

  const highRiskDomains: string[] = [];
  const criticalRiskDomains: string[] = [];
  let totalCookies = 0;
  let servicesWithLogin = 0;
  let servicesWithPrivacy = 0;
  let servicesWithTos = 0;
  let servicesWithNRD = 0;
  let servicesWithTyposquat = 0;
  let servicesWithAI = 0;

  for (const service of serviceList) {
    const isNRD = service.nrdResult?.isNRD || false;
    const isTyposquat = service.typosquatResult?.isTyposquat || false;

    if (service.hasLoginPage) servicesWithLogin++;
    if (service.privacyPolicyUrl) servicesWithPrivacy++;
    if (service.termsOfServiceUrl) servicesWithTos++;
    if (isNRD) servicesWithNRD++;
    if (isTyposquat) servicesWithTyposquat++;
    if (service.aiDetected?.hasAIActivity) servicesWithAI++;
    totalCookies += service.cookies?.length || 0;

    if (isNRD && isTyposquat) {
      criticalRiskDomains.push(service.domain);
    } else if (isNRD || isTyposquat) {
      highRiskDomains.push(service.domain);
    }
  }

  return {
    snapshotId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    snapshotAt: Date.now(),
    totalServices: serviceList.length,
    servicesWithLogin,
    servicesWithPrivacy,
    servicesWithTos,
    servicesWithNRD,
    servicesWithTyposquat,
    servicesWithAI,
    totalCookies,
    highRiskDomains: highRiskDomains.join(","),
    criticalRiskDomains: criticalRiskDomains.join(","),
  };
}
