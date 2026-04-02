import { isSessionCookie } from "../detectors/index.js";
import type { CookieInfo } from "../types/index.js";

export type CookieChangeCallback = (cookie: CookieInfo, removed: boolean) => void;

let listeners: CookieChangeCallback[] = [];
let isStarted = false;

export function startCookieMonitor() {
  if (isStarted) {
    return;
  }

  isStarted = true;

  chrome.cookies.onChanged.addListener((changeInfo: chrome.cookies.CookieChangeInfo) => {
    const { cookie, removed } = changeInfo;

    if (!isSessionCookie(cookie.name)) {
      return;
    }

    const cookieInfo: CookieInfo = {
      name: cookie.name,
      domain: cookie.domain,
      detectedAt: Date.now(),
      isSession: !cookie.expirationDate,
    };

    for (const listener of listeners) {
      listener(cookieInfo, removed);
    }
  });
}

export function onCookieChange(callback: CookieChangeCallback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

/**
 * Proactively query existing cookies for a domain.
 * Complements the reactive onChanged listener by fetching cookies
 * that were already set before monitoring started.
 */
export async function queryExistingCookies(domain: string): Promise<CookieInfo[]> {
  const urls = [`https://${domain}`, `http://${domain}`];
  const seen = new Set<string>();
  const results: CookieInfo[] = [];

  for (const url of urls) {
    let cookies: chrome.cookies.Cookie[];
    try {
      cookies = await chrome.cookies.getAll({ url });
    } catch {
      continue;
    }

    for (const cookie of cookies) {
      if (seen.has(cookie.name)) continue;
      if (!isSessionCookie(cookie.name)) continue;

      seen.add(cookie.name);
      results.push({
        name: cookie.name,
        domain: cookie.domain,
        detectedAt: Date.now(),
        isSession: !cookie.expirationDate,
      });
    }
  }

  return results;
}
