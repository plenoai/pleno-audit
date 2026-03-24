import type { CookieInfo, DetectedService } from "@libztbs/types";
import type { Logger } from "@libztbs/extension-runtime";
import { queryExistingCookies } from "@libztbs/extension-runtime";
import type { PageAnalysis, StorageData } from "./types.js";

export interface PageAnalysisDependencies {
  logger: Logger;
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
