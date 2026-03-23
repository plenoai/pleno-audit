/**
 * @fileoverview Favicon Detector
 *
 * ネットワークリクエストからfaviconのURLを検出する。
 * 外部通信なしで、既存の通信記録からfaviconを特定する。
 */

/**
 * Extract filename from URL path (last segment after /)
 */
function getFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSlash = pathname.lastIndexOf("/");
    return lastSlash >= 0 ? pathname.slice(lastSlash + 1).toLowerCase() : pathname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Check if a filename matches favicon patterns
 * Uses string methods instead of regex to avoid ReDoS
 */
function isFaviconFile(url: string): boolean {
  const filename = getFilename(url);
  if (!filename) return false;

  // .ico files
  if (filename.endsWith(".ico")) return true;

  // favicon*.png or favicon*.svg
  if (filename.startsWith("favicon") && (filename.endsWith(".png") || filename.endsWith(".svg"))) {
    return true;
  }

  // apple-touch-icon*.png
  if (filename.startsWith("apple-touch-icon") && filename.endsWith(".png")) {
    return true;
  }

  // icon*.png (including icon-32x32.png, icon32.png, etc.)
  if (filename.startsWith("icon") && filename.endsWith(".png")) {
    return true;
  }

  // android-chrome*.png
  if (filename.startsWith("android-chrome") && filename.endsWith(".png")) {
    return true;
  }

  // Check for /icons/ directory pattern
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes("/icons/") || pathname.includes("/icon/")) {
      if (filename.endsWith(".png") || filename.endsWith(".ico") || filename.endsWith(".svg")) {
        return true;
      }
    }
  } catch {
    // Ignore URL parsing errors
  }

  return false;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export interface FaviconRequest {
  url: string;
  domain: string;
  pageUrl?: string;
}

/**
 * ネットワークリクエストからfaviconのURLを検出する
 * pageUrl（リクエスト元ページ）が対象ドメインの場合も検出対象とする
 * @param domain 対象ドメイン
 * @param requests ネットワークリクエストの配列
 * @returns faviconのURL、見つからない場合はundefined
 */
export function findFaviconUrl(
  domain: string,
  requests: FaviconRequest[]
): string | undefined {
  for (const req of requests) {
    // リクエスト先が同じドメイン、またはpageUrl（リクエスト元）が同じドメインの場合
    const reqDomain = extractDomain(req.url);
    const pageDomain = req.pageUrl ? extractDomain(req.pageUrl) : null;

    const isFromTargetDomain = reqDomain === domain || pageDomain === domain;

    if (isFromTargetDomain && isFaviconFile(req.url)) {
      return req.url;
    }
  }
  return undefined;
}

/**
 * 複数ドメインのfaviconを一括検出する
 * @param domains 対象ドメインの配列
 * @param requests ネットワークリクエストの配列
 * @returns ドメインをキーとしたfaviconURLのマップ
 */
export function findFavicons(
  domains: string[],
  requests: FaviconRequest[]
): Map<string, string> {
  const result = new Map<string, string>();

  for (const domain of domains) {
    const faviconUrl = findFaviconUrl(domain, requests);
    if (faviconUrl) {
      result.set(domain, faviconUrl);
    }
  }

  return result;
}
