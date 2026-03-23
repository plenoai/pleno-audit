import type {
  CookieBannerDetectedDetails,
  CookieInfo,
  CookiePolicyFoundDetails,
  DetectedService,
  LoginDetectedDetails,
} from "@pleno-audit/casb-types";
import type { CookieBannerResult, DetectionResult } from "@pleno-audit/detectors";
import type { CSPConfig } from "@pleno-audit/csp";
import type { DetectionConfig, NotificationConfig } from "@pleno-audit/extension-runtime";
import type { PolicyConfig } from "@pleno-audit/alerts";

export interface StorageData {
  services: Record<string, DetectedService>;
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  notificationConfig: NotificationConfig;
  policyConfig: PolicyConfig;
}

export interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectedDetails;
  privacy: DetectionResult;
  tos: DetectionResult;
  cookiePolicy?: DetectionResult;
  cookieBanner?: CookieBannerResult;
  faviconUrl?: string | null;
}

export type {
  CookieBannerDetectedDetails,
  CookieBannerResult,
  CookieInfo,
  CookiePolicyFoundDetails,
  DetectedService,
};
