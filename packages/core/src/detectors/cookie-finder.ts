import {
  isCookiePolicyUrl,
  isCookiePolicyText,
  isPrivacyText,
  isTosText,
  COOKIE_OG_PATTERNS,
  COOKIE_JSONLD_KEYS,
  COOKIE_LINK_REL_VALUES,
  COOKIE_BANNER_SELECTORS,
  isCookieConsentButton,
} from "./patterns.js";
import { decodeUrlSafe, getPathFromUrl } from "./url-utils.js";
import type { DOMAdapter, CookiePolicyResult, CookieBannerResult } from "./types.js";
import { createPolicyFinder } from "./policy-finder-base.js";

/**
 * プライバシー/利用規約関連のリンクを除外（Cookie検出時に誤検知しないため）
 */
function shouldExcludeOtherPolicies(text: string, url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decodedPath = decodeUrlSafe(pathname);
  const decodedText = decodeUrlSafe(text);

  // Privacy PolicyやToSを除外
  const isPrivacy =
    isPrivacyText(text) ||
    isPrivacyText(decodedText) ||
    isPrivacyText(pathname) ||
    isPrivacyText(decodedPath);

  const isTos =
    isTosText(text) ||
    isTosText(decodedText) ||
    isTosText(pathname) ||
    isTosText(decodedPath);

  return isPrivacy || isTos;
}

/**
 * クッキーポリシー検出関数を生成
 */
export function createCookiePolicyFinder(dom: DOMAdapter) {
  return createPolicyFinder(dom, {
    isTargetUrl: isCookiePolicyUrl,
    isTargetText: isCookiePolicyText,
    linkRelValues: COOKIE_LINK_REL_VALUES,
    jsonLdKeys: COOKIE_JSONLD_KEYS,
    ogPatterns: COOKIE_OG_PATTERNS,
    shouldExclude: shouldExcludeOtherPolicies,
  }) as () => CookiePolicyResult;
}

/**
 * クッキー同意バナー検出関数を生成
 */
export function createCookieBannerFinder(dom: DOMAdapter) {
  return function findCookieBanner(): CookieBannerResult {
    // 1. Check for consent banner elements
    for (const selector of COOKIE_BANNER_SELECTORS) {
      try {
        const element = dom.querySelector(selector);
        if (element) {
          // Check if visible
          const style = (element as HTMLElement).style;
          const isHidden =
            style?.display === "none" ||
            style?.visibility === "hidden" ||
            style?.opacity === "0";

          if (!isHidden) {
            // Look for consent buttons within the banner
            const buttons = element.querySelectorAll("button, a, [role='button']");
            let hasAcceptButton = false;
            let hasRejectButton = false;
            let hasSettingsButton = false;

            for (const button of buttons) {
              const text = button.textContent?.trim() || "";
              if (isCookieConsentButton(text)) {
                hasAcceptButton = true;
              }
              if (/reject|decline|refuse|ablehnen|refuser|rechazar|拒否/i.test(text)) {
                hasRejectButton = true;
              }
              if (/settings|preferences|customize|設定|anpassen|personnaliser/i.test(text)) {
                hasSettingsButton = true;
              }
            }

            return {
              found: true,
              selector,
              hasAcceptButton,
              hasRejectButton,
              hasSettingsButton,
              isGDPRCompliant: hasAcceptButton && (hasRejectButton || hasSettingsButton),
            };
          }
        }
      } catch {
        // Selector might not be valid, skip
        continue;
      }
    }

    return {
      found: false,
      selector: null,
      hasAcceptButton: false,
      hasRejectButton: false,
      hasSettingsButton: false,
      isGDPRCompliant: false,
    };
  };
}
