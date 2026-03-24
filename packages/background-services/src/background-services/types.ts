import type {
  CookieBannerDetectedDetails,
  CookieInfo,
  CookiePolicyFoundDetails,
  DetectedService,
  LoginDetectedDetails,
} from "@libztbs/types";
import type { CookieBannerResult, DetectionResult } from "@libztbs/detectors";
import type { CSPConfig } from "@libztbs/csp";
import type { DetectionConfig, NotificationConfig } from "@libztbs/extension-runtime";
import type { PolicyConfig } from "@libztbs/alerts";

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
