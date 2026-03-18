import type { DOMAdapter } from "@pleno-audit/detectors";
import { createLogger } from "./logger.js";

const logger = createLogger("browser-adapter");

/**
 * Browser environment detection
 */
export const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
export const isChrome = typeof navigator !== "undefined" && navigator.userAgent.includes("Chrome");

/**
 * Get the browser API object (browser for Firefox, chrome for Chrome)
 * Firefox uses the standardized browser.* API with Promise support
 * Chrome uses chrome.* API with callback pattern (but WXT polyfills Promises)
 */
export function getBrowserAPI(): typeof chrome {
  // In extension context, prefer `browser` (Firefox standard) if available
  // WXT provides polyfills so both work, but we check for native support
  if (typeof globalThis !== "undefined" && "browser" in globalThis) {
    return (globalThis as unknown as { browser: typeof chrome }).browser;
  }
  if (typeof chrome !== "undefined") {
    return chrome;
  }
  throw new Error("No browser extension API available");
}

/**
 * Check if we're running in an extension context
 */
export function isExtensionContext(): boolean {
  try {
    const api = getBrowserAPI();
    return !!api?.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Check if chrome.storage.session is available (Chrome MV3 only)
 */
export function hasSessionStorage(): boolean {
  try {
    const api = getBrowserAPI();
    return !!api?.storage?.session;
  } catch {
    return false;
  }
}

/**
 * Check if chrome.storage.managed is available (Chrome Enterprise only)
 */
export function hasManagedStorage(): boolean {
  try {
    const api = getBrowserAPI();
    return !!api?.storage?.managed;
  } catch {
    return false;
  }
}

/**
 * Check if chrome.identity API is available (Chrome MV3 only)
 */
export function hasIdentityAPI(): boolean {
  try {
    const api = getBrowserAPI();
    return !!api?.identity?.launchWebAuthFlow;
  } catch {
    return false;
  }
}

/**
 * Check if running in MV3 (Manifest V3)
 */
export function isManifestV3(): boolean {
  try {
    const api = getBrowserAPI();
    const manifest = api?.runtime?.getManifest?.();
    return manifest?.manifest_version === 3;
  } catch {
    return false;
  }
}

const SESSION_STORAGE_PREFIX = "__pleno_session_";

export async function getSessionStorage<T>(key: string): Promise<T | undefined> {
  const api = getBrowserAPI();

  if (api?.storage?.session) {
    const result = await api.storage.session.get(key);
    return result[key] as T | undefined;
  }

  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_PREFIX + key);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

export async function setSessionStorage<T>(key: string, value: T): Promise<void> {
  const api = getBrowserAPI();

  if (api?.storage?.session) {
    await api.storage.session.set({ [key]: value });
    return;
  }

  try {
    sessionStorage.setItem(SESSION_STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    logger.debug("sessionStorage.setItem failed", error);
  }
}

export async function removeSessionStorage(key: string): Promise<void> {
  const api = getBrowserAPI();

  if (api?.storage?.session) {
    await api.storage.session.remove(key);
    return;
  }

  try {
    sessionStorage.removeItem(SESSION_STORAGE_PREFIX + key);
  } catch (error) {
    logger.debug("sessionStorage.removeItem failed", error);
  }
}

/**
 * Browser DOM adapter implementation
 * Provides access to the browser's document and window objects
 */
export function createBrowserAdapter(): DOMAdapter {
  return {
    querySelector(selector: string): Element | null {
      return document.querySelector(selector);
    },
    querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> {
      return document.querySelectorAll<T>(selector);
    },
    getLocation() {
      return {
        origin: window.location.origin,
        pathname: window.location.pathname,
        href: window.location.href,
      };
    },
  };
}

export const browserAdapter = createBrowserAdapter();
