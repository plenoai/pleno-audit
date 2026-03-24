import type { AlertManager } from "@libztbs/alerts";
import type { CookieInfo, DetectedService } from "@libztbs/types";
import type { Logger } from "@libztbs/extension-runtime";
import { queryExistingCookies } from "@libztbs/extension-runtime";
import type { PageAnalysis, StorageData } from "./types.js";

export interface PageAnalysisDependencies {
  logger: Logger;
  getAlertManager: () => AlertManager;
  initStorage: () => Promise<StorageData>;
  updateService: (domain: string, update: Partial<DetectedService>) => Promise<void>;
  addCookieToService: (domain: string, cookie: CookieInfo) => Promise<void>;
  queryExistingCookies: typeof queryExistingCookies;
}

export function createPageAnalysisHandler(deps: PageAnalysisDependencies) {
  return async (analysis: PageAnalysis) => {
  const { domain, login, privacy, tos, cookiePolicy, cookieBanner, faviconUrl } = analysis;
  const storage = await deps.initStorage();
  const isNewDomain = !storage.services[domain];

  // Batch all service field updates into a single write
  const serviceUpdate: Partial<DetectedService> = {};

  if (faviconUrl) {
    serviceUpdate.faviconUrl = faviconUrl;
  }

  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;

  if (hasLoginForm) {
    serviceUpdate.hasLoginPage = true;
  }

  if (privacy.found && privacy.url) {
    serviceUpdate.privacyPolicyUrl = privacy.url;
  }

  if (tos.found && tos.url) {
    serviceUpdate.termsOfServiceUrl = tos.url;
  }

  // Single storage write for all service updates
  if (Object.keys(serviceUpdate).length > 0) {
    await deps.updateService(domain, serviceUpdate);
  }

  const hasPrivacyPolicy = privacy.found;
  const hasTermsOfService = tos.found;
  const hasCookiePolicy = cookiePolicy?.found ?? false;
  const hasCookieBanner = cookieBanner?.found ?? false;
  const isCookieBannerGDPRCompliant = cookieBanner?.isGDPRCompliant ?? false;

  // Skip compliance checks for local/development environments
  const isLocal = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/.test(domain)
    || domain.endsWith(".local")
    || domain.endsWith(".localhost");

  const hasViolations = !isLocal && (
    (hasLoginForm && (!hasPrivacyPolicy || !hasTermsOfService)) ||
    !hasCookiePolicy ||
    !hasCookieBanner ||
    (hasCookieBanner && !isCookieBannerGDPRCompliant)
  );

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
