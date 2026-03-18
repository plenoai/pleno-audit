import {
  createLoginDetector,
  createPrivacyFinder,
  createTosFinder,
  createCookiePolicyFinder,
  createCookieBannerFinder,
  type LoginDetectionResult,
  type PrivacyPolicyResult,
  type TosResult,
  type CookiePolicyResult,
  type CookieBannerResult,
} from "@pleno-audit/detectors";
import { browserAdapter } from "@pleno-audit/extension-runtime";

// Create detector instances with browser adapter
const loginDetector = createLoginDetector(browserAdapter);
const findPrivacyPolicy = createPrivacyFinder(browserAdapter);
const findTermsOfService = createTosFinder(browserAdapter);
const findCookiePolicy = createCookiePolicyFinder(browserAdapter);
const findCookieBanner = createCookieBannerFinder(browserAdapter);

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectionResult;
  privacy: PrivacyPolicyResult;
  tos: TosResult;
  cookiePolicy: CookiePolicyResult;
  cookieBanner: CookieBannerResult;
  faviconUrl: string | null;
}

function findFaviconFromDOM(): string | null {
  // <link rel="icon"> または <link rel="shortcut icon"> を探す
  const iconLinks = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel*="apple-touch-icon"]'
  );

  for (const link of iconLinks) {
    if (link.href) {
      return link.href;
    }
  }

  // デフォルトの /favicon.ico を試す
  return `${window.location.origin}/favicon.ico`;
}

function analyzePage(): PageAnalysis {
  const url = window.location.href;
  const domain = window.location.hostname;

  return {
    url,
    domain,
    timestamp: Date.now(),
    login: loginDetector.detectLoginPage(),
    privacy: findPrivacyPolicy(),
    tos: findTermsOfService(),
    cookiePolicy: findCookiePolicy(),
    cookieBanner: findCookieBanner(),
    faviconUrl: findFaviconFromDOM(),
  };
}

async function safeSendMessage(type: string, data?: Record<string, unknown>) {
  try {
    await chrome.runtime.sendMessage(
      data !== undefined ? { type, ...data } : { type }
    );
  } catch (error) {
    console.warn(`[content] ${type} send failed`, error);
  }
}

async function runAnalysis() {
  const analysis = analyzePage();
  const { login, privacy, tos, cookiePolicy, cookieBanner, domain, faviconUrl } = analysis;

  // Send to background if any info found (including favicon and cookie detection)
  if (
    login.hasPasswordInput ||
    login.isLoginUrl ||
    privacy.found ||
    tos.found ||
    cookiePolicy.found ||
    cookieBanner.found ||
    faviconUrl
  ) {
    await safeSendMessage("PAGE_ANALYZED", { payload: analysis });
  }

  // Check NRD in background (non-blocking)
  safeSendMessage("CHECK_NRD", { data: { domain } });

  // Check Typosquatting in background (non-blocking)
  safeSendMessage("CHECK_TYPOSQUAT", { data: { domain } });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if (document.readyState === "complete") {
      runAnalysis().catch((error) => {
        console.warn("[content] initial runAnalysis failed", error);
      });
    } else {
      window.addEventListener("load", () => {
        runAnalysis().catch((error) => {
          console.warn("[content] load runAnalysis failed", error);
        });
      });
    }
  },
});
