export interface DOMAdapter {
  querySelector(selector: string): Element | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T>;
  getLocation(): { origin: string; pathname: string; href: string };
}

export type DetectionMethod =
  | "url_pattern"
  | "link_text"
  | "link_rel"
  | "json_ld"
  | "og_meta"
  | "not_found";

export interface DetectionResult {
  found: boolean;
  url: string | null;
  method: DetectionMethod;
}

export interface PrivacyPolicyResult extends DetectionResult {}

export interface TosResult extends DetectionResult {}

export interface CookiePolicyResult extends DetectionResult {}

export interface CookieBannerResult {
  found: boolean;
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

export interface LoginDetectionResult {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
  hasSocialLogin: boolean;
  hasWebAuthn: boolean;
}
