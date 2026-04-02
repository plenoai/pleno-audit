import {
  isTosUrl,
  isTosText,
  isPrivacyText,
  TOS_OG_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
} from "./patterns.js";
import { decodeUrlSafe, getPathFromUrl } from "./url-utils.js";
import type { DOMAdapter, TosResult } from "./types.js";
import { createPolicyFinder } from "./policy-finder-base.js";

/**
 * プライバシー関連のリンクを除外（ToS検出時にprivacyを誤検知しないため）
 */
function shouldExcludePrivacy(text: string, url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decodedPath = decodeUrlSafe(pathname);
  const decodedText = decodeUrlSafe(text);

  // isPrivacyTextはPRIVACY_TEXT_PATTERNSを使用（多言語対応済み）
  return (
    isPrivacyText(text) ||
    isPrivacyText(decodedText) ||
    isPrivacyText(pathname) ||
    isPrivacyText(decodedPath)
  );
}

export function createTosFinder(dom: DOMAdapter) {
  return createPolicyFinder(dom, {
    isTargetUrl: isTosUrl,
    isTargetText: isTosText,
    linkRelValues: TOS_LINK_REL_VALUES,
    jsonLdKeys: TOS_JSONLD_KEYS,
    ogPatterns: TOS_OG_PATTERNS,
    shouldExclude: shouldExcludePrivacy,
  }) as () => TosResult;
}
