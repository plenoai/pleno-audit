import type { AlertManager } from "@pleno-audit/alerts";
import type { CookieInfo, DetectedService } from "@pleno-audit/detectors";
import type { Logger } from "@pleno-audit/extension-runtime";
import { DEFAULT_DETECTION_CONFIG, queryExistingCookies } from "@pleno-audit/extension-runtime";
import type { NewEvent, PageAnalysis, StorageData } from "./types.js";

export interface PageAnalysisDependencies {
  logger: Logger;
  getAlertManager: () => AlertManager;
  initStorage: () => Promise<StorageData>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
  addEvent: (event: NewEvent) => Promise<unknown>;
  addCookieToService: (domain: string, cookie: CookieInfo) => Promise<void>;
  queryExistingCookies: typeof queryExistingCookies;
}

export function createPageAnalysisHandler(deps: PageAnalysisDependencies) {
  return async (analysis: PageAnalysis) => {
  const { domain, login, privacy, tos, cookiePolicy, cookieBanner, timestamp, faviconUrl } = analysis;
  const storage = await deps.initStorage();
  const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;
  const isNewDomain = !storage.services[domain];

  if (faviconUrl) {
    await deps.updateService(domain, { faviconUrl });
  }

  if (detectionConfig.enableLogin && (login.hasPasswordInput || login.isLoginUrl)) {
    await deps.updateService(domain, { hasLoginPage: true });
    await deps.addEvent({
      type: "login_detected",
      domain,
      timestamp,
      details: login,
    });
  }

  if (detectionConfig.enablePrivacy && privacy.found && privacy.url) {
    await deps.updateService(domain, { privacyPolicyUrl: privacy.url });
    await deps.addEvent({
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }

  if (detectionConfig.enableTos && tos.found && tos.url) {
    await deps.updateService(domain, { termsOfServiceUrl: tos.url });
    await deps.addEvent({
      type: "terms_of_service_found",
      domain,
      timestamp,
      details: { url: tos.url, method: tos.method },
    });
  }

  if (cookiePolicy?.found && cookiePolicy.url) {
    await deps.addEvent({
      type: "cookie_policy_found",
      domain,
      timestamp,
      details: { url: cookiePolicy.url, method: cookiePolicy.method },
    });
  }

  if (cookieBanner?.found) {
    await deps.addEvent({
      type: "cookie_banner_detected",
      domain,
      timestamp,
      details: {
        selector: cookieBanner.selector,
        hasAcceptButton: cookieBanner.hasAcceptButton,
        hasRejectButton: cookieBanner.hasRejectButton,
        hasSettingsButton: cookieBanner.hasSettingsButton,
        isGDPRCompliant: cookieBanner.isGDPRCompliant,
      },
    });
  }

  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;
  const hasPrivacyPolicy = privacy.found;
  const hasTermsOfService = tos.found;
  const hasCookiePolicy = cookiePolicy?.found ?? false;
  const hasCookieBanner = cookieBanner?.found ?? false;
  const isCookieBannerGDPRCompliant = cookieBanner?.isGDPRCompliant ?? false;

  const hasViolations =
    (hasLoginForm && (!hasPrivacyPolicy || !hasTermsOfService)) ||
    !hasCookiePolicy ||
    !hasCookieBanner ||
    (hasCookieBanner && !isCookieBannerGDPRCompliant);

  if (hasViolations) {
    await deps.getAlertManager().alertCompliance({
      pageDomain: domain,
      hasPrivacyPolicy,
      hasTermsOfService,
      hasCookiePolicy,
      hasCookieBanner,
      isCookieBannerGDPRCompliant,
      hasLoginForm,
    });
  }

  // Proactively query existing cookies for newly detected domains
  if (isNewDomain) {
    deps.queryExistingCookies(domain)
      .then(async (cookies) => {
        for (const cookie of cookies) {
          await deps.addCookieToService(domain, cookie);
        }
      })
      .catch((err) => {
        deps.logger?.debug("Failed to query existing cookies:", domain, err);
      });
  }
  };
}
