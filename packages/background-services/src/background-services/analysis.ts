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

  // Batch all service field updates into a single write
  const serviceUpdate: Partial<DetectedService> = {};
  const events: NewEvent[] = [];

  if (faviconUrl) {
    serviceUpdate.faviconUrl = faviconUrl;
  }

  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;

  if (detectionConfig.enableLogin && hasLoginForm) {
    serviceUpdate.hasLoginPage = true;
    events.push({ type: "login_detected", domain, timestamp, details: login });
  }

  if (detectionConfig.enablePrivacy && privacy.found && privacy.url) {
    serviceUpdate.privacyPolicyUrl = privacy.url;
    events.push({ type: "privacy_policy_found", domain, timestamp, details: { url: privacy.url, method: privacy.method } });
  }

  if (detectionConfig.enableTos && tos.found && tos.url) {
    serviceUpdate.termsOfServiceUrl = tos.url;
    events.push({ type: "terms_of_service_found", domain, timestamp, details: { url: tos.url, method: tos.method } });
  }

  // Single storage write for all service updates
  if (Object.keys(serviceUpdate).length > 0) {
    await deps.updateService(domain, serviceUpdate);
  }

  // Add events to parquet store
  for (const event of events) {
    await deps.addEvent(event);
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
