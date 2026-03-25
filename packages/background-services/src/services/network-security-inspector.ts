import type {
  DataExfiltrationData,
  TrackingBeaconData,
} from "./security-event-handlers.js";
import { containsCreditCard } from "@libztbs/ai-detector";

const DATA_EXFILTRATION_THRESHOLD = 10 * 1024;
const TRACKING_BEACON_SIZE_LIMIT = 2048;
// Stricter URL patterns: require tracking-specific path segments (not generic terms like /collect or /metrics)
const TRACKING_URL_PATTERNS = /\/tracking[/.]|\/beacon[/.]|\/analytics[/.]|\/pixel[/.]|\/telemetry[/.]|[?&](?:utm_|_ga=|fbclid=)/i;
// Payload patterns: require 2+ tracking-specific keys together (single "event" is too common)
const TRACKING_PAYLOAD_PATTERNS = /(?:["'](?:user_id|visitor_id|tracking_id|_ga|utm_source|fbclid|gclid)["'])/i;

// Each entry: [cheapGuard, regex] — guard is checked with indexOf before running regex
const SENSITIVE_CHECKS: ReadonlyArray<
  readonly [guard: string, pattern: RegExp, type: string]
> = [
  // Email: rewrite to avoid catastrophic backtracking on long strings.
  // Original `[A-Za-z0-9.-]+` ate dots greedily, causing exponential
  // backtracking against the trailing `\.[A-Za-z]{2,}`.
  // Fix: domain part uses `[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*`
  // which never backtracks because each segment is anchored by non-dot chars.
  [
    "@",
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/,
    "email",
  ],
  // credit_card is handled separately via containsCreditCard() from @libztbs/ai-detector
  ["-", /\d{3}-\d{2}-\d{4}/, "ssn"],
  ["password", /["']password["']\s*:\s*["'][^"']+["']/i, "password"],
  ["api", /["']api[_-]?key["']\s*:\s*["'][^"']+["']/i, "api_key"],
  ["secret", /["']secret["']\s*:\s*["'][^"']+["']/i, "secret"],
  ["token", /["']token["']\s*:\s*["'][^"']+["']/i, "token"],
];

interface LoggerLike {
  debug?: (...args: unknown[]) => void;
}

type DetectionOutcome = {
  hasDataExfiltration: boolean;
  hasTrackingBeacon: boolean;
  sensitiveDataTypes: string[];
  normalizedUrl: string;
  targetDomain: string;
  method: string;
  bodySize: number;
};

type CacheEntry = {
  expiresAt: number;
  outcome: DetectionOutcome;
};

export interface NetworkInspectionRequest {
  source?: string;
  timestamp?: number | string;
  pageUrl: string;
  url: string;
  method: string;
  initiator: string;
  bodySize?: number;
  bodySample?: string;
}

interface NetworkSecurityInspectorDependencies {
  handleDataExfiltration: (
    data: DataExfiltrationData,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
  handleTrackingBeacon: (
    data: TrackingBeaconData,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
  logger?: LoggerLike;
  cacheTtlMs?: number;
  maxSampleLength?: number;
}

function normalizeMethod(method: unknown): string {
  if (typeof method !== "string" || method.trim().length === 0) {
    return "GET";
  }
  return method.toUpperCase();
}

function normalizeBodySize(bodySize: unknown): number {
  if (typeof bodySize === "number" && Number.isFinite(bodySize) && bodySize >= 0) {
    return bodySize;
  }
  return 0;
}

function normalizeBodySample(
  bodySample: unknown,
  maxSampleLength: number,
): string {
  if (typeof bodySample !== "string") {
    return "";
  }
  if (bodySample.length <= maxSampleLength) {
    return bodySample;
  }
  return bodySample.slice(0, maxSampleLength);
}

function resolveAbsoluteUrl(url: string, pageUrl: string): string | null {
  try {
    return new URL(url, pageUrl).href;
  } catch {
    return null;
  }
}

function getTargetDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** @internal exported for testing */
export function detectSensitiveData(bodySample: string): string[] {
  if (!bodySample) {
    return [];
  }
  const types: string[] = [];
  const seen = new Set<string>();

  // Credit card: delegated to @libztbs/ai-detector (Luhn-validated, boundary-checked)
  if (containsCreditCard(bodySample)) {
    types.push("credit_card");
    seen.add("credit_card");
  }

  for (const [guard, pattern, type] of SENSITIVE_CHECKS) {
    if (seen.has(type)) continue;
    if (!bodySample.includes(guard)) continue;
    if (pattern.test(bodySample)) {
      types.push(type);
      seen.add(type);
    }
  }
  return types;
}

function isTrackingBeacon(
  absoluteUrl: string,
  bodySize: number,
  bodySample: string,
  pageUrl?: string,
): boolean {
  if (bodySize >= TRACKING_BEACON_SIZE_LIMIT) {
    return false;
  }
  // Skip same-origin beacons (first-party analytics is legitimate)
  if (pageUrl) {
    try {
      const targetHost = new URL(absoluteUrl).hostname;
      const pageHost = new URL(pageUrl).hostname;
      if (targetHost === pageHost) return false;
    } catch { /* ignore */ }
  }
  return TRACKING_URL_PATTERNS.test(absoluteUrl)
    || TRACKING_PAYLOAD_PATTERNS.test(bodySample);
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildCacheKey(
  input: NetworkInspectionRequest,
  maxSampleLength: number,
): string {
  const method = normalizeMethod(input.method);
  const bodySize = normalizeBodySize(input.bodySize);
  const bodySample = normalizeBodySample(input.bodySample, maxSampleLength);
  return `${method}|${input.url}|${bodySize}|${hashText(bodySample)}`;
}

export function createNetworkSecurityInspector(
  deps: NetworkSecurityInspectorDependencies,
) {
  const cacheTtlMs = deps.cacheTtlMs ?? 5000;
  const maxSampleLength = deps.maxSampleLength ?? 4096;
  const maxCacheEntries = 512;
  const inspectionCache = new Map<string, CacheEntry>();

  function trimCache(now: number): void {
    if (inspectionCache.size <= maxCacheEntries) {
      return;
    }
    for (const [key, entry] of inspectionCache.entries()) {
      if (entry.expiresAt <= now) {
        inspectionCache.delete(key);
      }
    }
    while (inspectionCache.size > maxCacheEntries) {
      const firstKey = inspectionCache.keys().next().value;
      if (typeof firstKey !== "string") {
        break;
      }
      inspectionCache.delete(firstKey);
    }
  }

  function inspectRequest(input: NetworkInspectionRequest): DetectionOutcome {
    const method = normalizeMethod(input.method);
    const bodySize = normalizeBodySize(input.bodySize);
    const bodySample = normalizeBodySample(input.bodySample, maxSampleLength);
    const normalizedUrl = resolveAbsoluteUrl(input.url, input.pageUrl);

    if (!normalizedUrl) {
      return {
        hasDataExfiltration: false,
        hasTrackingBeacon: false,
        sensitiveDataTypes: [],
        normalizedUrl: "",
        targetDomain: "",
        method,
        bodySize,
      };
    }

    const shouldEvaluateExfiltration = method !== "GET" && method !== "HEAD";
    const sensitiveDataTypes = shouldEvaluateExfiltration
      ? (bodySize >= DATA_EXFILTRATION_THRESHOLD
        ? []
        : detectSensitiveData(bodySample))
      : [];
    const hasDataExfiltration = shouldEvaluateExfiltration
      ? bodySize >= DATA_EXFILTRATION_THRESHOLD || sensitiveDataTypes.length > 0
      : false;
    const hasTrackingBeacon = isTrackingBeacon(normalizedUrl, bodySize, bodySample, input.pageUrl);

    return {
      hasDataExfiltration,
      hasTrackingBeacon,
      sensitiveDataTypes,
      normalizedUrl,
      targetDomain: getTargetDomain(normalizedUrl),
      method,
      bodySize,
    };
  }

  async function handleNetworkInspection(
    rawData: unknown,
    sender: chrome.runtime.MessageSender,
  ): Promise<{ success: boolean; detected?: number; reason?: string }> {
    if (!rawData || typeof rawData !== "object") {
      return { success: false, reason: "invalid_data" };
    }

    const input = rawData as NetworkInspectionRequest;
    if (typeof input.url !== "string" || typeof input.pageUrl !== "string") {
      return { success: false, reason: "missing_url_or_page" };
    }

    const now = Date.now();
    const cacheKey = buildCacheKey(input, maxSampleLength);
    const cached = inspectionCache.get(cacheKey);
    let outcome: DetectionOutcome;

    if (cached && cached.expiresAt > now) {
      outcome = cached.outcome;
    } else {
      outcome = inspectRequest(input);
      trimCache(now);
      inspectionCache.set(cacheKey, {
        outcome,
        expiresAt: now + cacheTtlMs,
      });
    }

    if (!outcome.hasDataExfiltration && !outcome.hasTrackingBeacon) {
      return { success: true, detected: 0 };
    }

    const eventTimestamp = input.timestamp ?? now;
    let detected = 0;

    if (outcome.hasTrackingBeacon) {
      await deps.handleTrackingBeacon({
        source: input.source,
        timestamp: eventTimestamp,
        pageUrl: input.pageUrl,
        url: outcome.normalizedUrl,
        targetDomain: outcome.targetDomain,
        bodySize: outcome.bodySize,
        initiator: input.initiator || "unknown",
      }, sender);
      detected += 1;
    }

    if (outcome.hasDataExfiltration) {
      await deps.handleDataExfiltration({
        source: input.source,
        timestamp: eventTimestamp,
        pageUrl: input.pageUrl,
        targetUrl: outcome.normalizedUrl,
        targetDomain: outcome.targetDomain,
        method: outcome.method,
        bodySize: outcome.bodySize,
        initiator: input.initiator || "unknown",
        sensitiveDataTypes: outcome.sensitiveDataTypes,
      }, sender);
      detected += 1;
    }

    deps.logger?.debug?.("Network inspection processed.", {
      url: outcome.normalizedUrl,
      method: outcome.method,
      detected,
    });

    return { success: true, detected };
  }

  return {
    inspectRequest,
    handleNetworkInspection,
  };
}
