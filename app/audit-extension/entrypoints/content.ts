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
import { browserAdapter, createLogger } from "@pleno-audit/extension-runtime";
import { createProducer, type StorageAdapter } from "@pleno-audit/event-queue";

const logger = createLogger("content");

// Create detector instances with browser adapter
const loginDetector = createLoginDetector(browserAdapter);
const findPrivacyPolicy = createPrivacyFinder(browserAdapter);
const findTermsOfService = createTosFinder(browserAdapter);
const findCookiePolicy = createCookiePolicyFinder(browserAdapter);
const findCookieBanner = createCookieBannerFinder(browserAdapter);

const storageAdapter: StorageAdapter = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

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

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function analyzePage(): Promise<PageAnalysis> {
  const url = window.location.href;
  const domain = window.location.hostname;
  const timestamp = Date.now();

  const login = loginDetector.detectLoginPage();
  await yieldToMain();
  const privacy = findPrivacyPolicy();
  await yieldToMain();
  const tos = findTermsOfService();
  await yieldToMain();
  const cookiePolicy = findCookiePolicy();
  await yieldToMain();
  const cookieBanner = findCookieBanner();
  const faviconUrl = findFaviconFromDOM();

  return { url, domain, timestamp, login, privacy, tos, cookiePolicy, cookieBanner, faviconUrl };
}

async function runAnalysis(producer: ReturnType<typeof createProducer>) {
  const analysis = await analyzePage();
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
    await producer.enqueue("PAGE_ANALYZED", { payload: analysis });
  }

  // Check NRD in background (non-blocking)
  producer.enqueue("CHECK_NRD", { data: { domain } });

  // Check Typosquatting in background (non-blocking)
  producer.enqueue("CHECK_TYPOSQUAT", { data: { domain } });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // Content scripts have a stable tab ID available via runtime
    const tabId = Date.now() % 1_000_000;
    const producer = createProducer(storageAdapter, tabId);
    producer.setContext({ senderUrl: window.location.href });

    if (document.readyState === "complete") {
      runAnalysis(producer).catch((error) => {
        logger.warn("initial runAnalysis failed", error);
      });
    } else {
      window.addEventListener("load", () => {
        runAnalysis(producer).catch((error) => {
          logger.warn("load runAnalysis failed", error);
        });
      });
    }
  },
});
