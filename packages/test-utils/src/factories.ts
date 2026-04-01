import { vi } from "vitest";

export interface MockLogger {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

export function createMockLogger(): MockLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

export interface NetworkRequestRecordData {
  id?: string;
  url?: string;
  method?: string;
  timestamp?: number;
  domain?: string;
  resourceType?: string;
  initiator?: string | null;
  initiatorType?: string;
  tabId?: number;
  frameId?: number;
  detectedBy?: string;
}

export function createNetworkRequestRecord(
  overrides: NetworkRequestRecordData = {},
): NetworkRequestRecordData {
  return {
    id: "req-1",
    url: "https://example.com/api",
    method: "GET",
    timestamp: 1000,
    domain: "example.com",
    resourceType: "xmlhttprequest",
    initiator: null,
    initiatorType: "extension",
    tabId: 1,
    frameId: 0,
    detectedBy: "webRequest",
    ...overrides,
  };
}

export interface ServiceData {
  domain?: string;
  detectedAt?: number;
  hasLoginPage?: boolean;
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;
  cookies?: unknown[];
}

export function createService(overrides: ServiceData = {}): ServiceData {
  return {
    domain: "example.com",
    detectedAt: 1700000000000,
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
    ...overrides,
  };
}
