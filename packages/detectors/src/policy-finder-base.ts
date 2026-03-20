/**
 * プライバシーポリシー/利用規約の共通検出ロジック
 */
import { FOOTER_SELECTORS } from "./patterns.js";
import { decodeUrlSafe, getPathFromUrl, resolveUrl } from "./url-utils.js";
import type { DOMAdapter, DetectionResult } from "./types.js";

export interface PolicyFinderConfig {
  // URL判定
  isTargetUrl: (url: string) => boolean;
  isTargetText: (text: string) => boolean;

  // メタデータキー/パターン
  linkRelValues: string[];
  jsonLdKeys: string[];
  ogPatterns: RegExp[];

  // 除外判定（オプション）
  shouldExclude?: (text: string, url: string) => boolean;
}

/**
 * URLパターンで判定（デコード対応）
 */
export function isUrlWithDecode(
  url: string,
  isTargetUrl: (url: string) => boolean,
  isTargetText: (text: string) => boolean,
  shouldExclude?: (text: string, url: string) => boolean
): boolean {
  const pathname = getPathFromUrl(url);
  const decoded = decodeUrlSafe(pathname);

  if (shouldExclude?.(decoded, pathname)) return false;

  if (isTargetUrl(pathname)) return true;
  if (decoded !== pathname && isTargetUrl(decoded)) return true;
  if (isTargetText(decoded)) return true;

  return false;
}

/**
 * link[rel]からURL取得
 */
export function findFromLinkRel(
  dom: DOMAdapter,
  relValues: string[]
): string | null {
  for (const rel of relValues) {
    const link = dom.querySelector(`link[rel="${rel}"]`);
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        return resolveUrl(href, dom.getLocation().origin);
      }
    }
  }
  return null;
}

/**
 * JSON-LDからURL取得
 */
export function findFromJsonLd(
  dom: DOMAdapter,
  keys: string[]
): string | null {
  const scripts = dom.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      for (const key of keys) {
        if (data[key] && typeof data[key] === "string") {
          return data[key];
        }
        if (data["@graph"] && Array.isArray(data["@graph"])) {
          for (const item of data["@graph"]) {
            if (item[key] && typeof item[key] === "string") {
              return item[key];
            }
          }
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

/**
 * OG MetaタグからURL取得
 */
export function findFromOgMeta(
  dom: DOMAdapter,
  patterns: RegExp[]
): string | null {
  const ogUrl = dom
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content");
  if (ogUrl && patterns.some((p) => p.test(ogUrl))) {
    return ogUrl;
  }
  return null;
}

const MAX_LINKS_TO_SCAN = 500;

/**
 * 汎用ポリシー検出関数を生成
 */
export function createPolicyFinder(
  dom: DOMAdapter,
  config: PolicyFinderConfig
): () => DetectionResult {
  const checkUrl = (url: string) =>
    isUrlWithDecode(
      url,
      config.isTargetUrl,
      config.isTargetText,
      config.shouldExclude
    );

  return function find(): DetectionResult {
    const location = dom.getLocation();

    // 1. 現在のURL
    if (checkUrl(location.pathname)) {
      return { found: true, url: location.href, method: "url_pattern" };
    }

    // 2. link[rel]
    const linkRelUrl = findFromLinkRel(dom, config.linkRelValues);
    if (linkRelUrl) {
      return { found: true, url: linkRelUrl, method: "link_rel" };
    }

    // 3. JSON-LD
    const jsonLdUrl = findFromJsonLd(dom, config.jsonLdKeys);
    if (jsonLdUrl) {
      return { found: true, url: jsonLdUrl, method: "json_ld" };
    }

    // 4. OG Meta
    const ogUrl = findFromOgMeta(dom, config.ogPatterns);
    if (ogUrl) {
      return { found: true, url: ogUrl, method: "og_meta" };
    }

    // 5. フッターリンク
    for (const selector of FOOTER_SELECTORS) {
      const links = dom.querySelectorAll<HTMLAnchorElement>(selector);
      for (const link of links) {
        const text = link.textContent?.trim() || "";
        const href = link.href;

        if (config.shouldExclude?.(text, href)) continue;

        if (config.isTargetText(text)) {
          return { found: true, url: href, method: "link_text" };
        }

        if (href && checkUrl(href)) {
          return { found: true, url: href, method: "url_pattern" };
        }
      }
    }

    // 6. 全リンクスキャン
    let linkCount = 0;
    const allLinks = dom.querySelectorAll<HTMLAnchorElement>("a[href]");
    for (const link of allLinks) {
      if (linkCount >= MAX_LINKS_TO_SCAN) break;
      linkCount++;

      const text = link.textContent?.trim() || "";
      const href = link.href;

      if (config.shouldExclude?.(text, href)) continue;

      if (config.isTargetText(text) || checkUrl(href)) {
        return { found: true, url: href, method: "link_text" };
      }
    }

    return { found: false, url: null, method: "not_found" };
  };
}
