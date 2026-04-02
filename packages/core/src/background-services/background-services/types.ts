import type {
  CookieBannerDetectedDetails,
  CookieInfo,
  CookiePolicyFoundDetails,
  DetectedService,
  LoginDetectedDetails,
} from "../../types/index.js";
import type { CookieBannerResult, DetectionResult } from "../../detectors/index.js";
import type { DetectionConfig, NotificationConfig } from "../../extension-runtime/index.js";
import type { PolicyConfig } from "../../alerts/index.js";

export interface StorageData {
  services: Record<string, DetectedService>;
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
