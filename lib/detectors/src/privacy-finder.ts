import {
  isPrivacyUrl,
  isPrivacyText,
  OG_PRIVACY_PATTERNS,
  JSONLD_PRIVACY_KEYS,
  LINK_REL_PRIVACY_VALUES,
} from "./patterns.js";
import type { DOMAdapter, PrivacyPolicyResult } from "./types.js";
import { createPolicyFinder } from "./policy-finder-base.js";

export function createPrivacyFinder(dom: DOMAdapter) {
  return createPolicyFinder(dom, {
    isTargetUrl: isPrivacyUrl,
    isTargetText: isPrivacyText,
    linkRelValues: LINK_REL_PRIVACY_VALUES,
    jsonLdKeys: JSONLD_PRIVACY_KEYS,
    ogPatterns: OG_PRIVACY_PATTERNS,
  }) as () => PrivacyPolicyResult;
}
