/**
 * @fileoverview Security Detection Hooks
 *
 * Supply Chain, Credential Theft, Clipboard Hijack, Cookie Access,
 * XSS/DOM Scraping, Suspicious Download の検出フック。
 */

import { type SharedHookUtils } from "./shared.js";

// ===== Constants =====

const KNOWN_CDNS = [
  "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "ajax.googleapis.com",
  "code.jquery.com", "stackpath.bootstrapcdn.com", "maxcdn.bootstrapcdn.com",
  "cdn.bootcdn.net", "lib.baomitu.com", "cdn.staticfile.org",
];

const SENSITIVE_TYPES = ["password", "email", "tel", "credit-card"];
const SENSITIVE_NAMES = [
  "password", "passwd", "pwd", "pass", "secret", "token", "api_key", "apikey",
  "credit", "card", "cvv", "ssn", "otp", "pin", "auth", "credential", "2fa", "mfa",
];

const CRYPTO_PATTERNS: Record<string, RegExp> = {
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  litecoin: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
  ripple: /^r[0-9a-zA-Z]{24,34}$/,
};

const XSS_PATTERNS = [
  /<script[^>]*>[^<]+/i,
  /javascript:\s*[^"'\s]/i,
  /on(error|load)\s*=\s*["'][^"']*eval/i,
  /<iframe[^>]*src\s*=\s*["']?javascript:/i,
];

const SUSPICIOUS_EXTENSIONS = [".exe", ".msi", ".bat", ".ps1", ".cmd", ".scr", ".vbs", ".js", ".jar", ".dll"];

// ===== Supply Chain Risk =====

function checkSupplyChainRisk(
  emitSecurityEvent: SharedHookUtils["emitSecurityEvent"],
  element: HTMLScriptElement | HTMLLinkElement,
  resourceType: string,
): void {
  const url = resourceType === "script" ? (element as HTMLScriptElement).src : (element as HTMLLinkElement).href;
  if (!url) return;
  try {
    if (new URL(url, window.location.origin).hostname === window.location.hostname) return;
  } catch {
    return;
  }

  const hasIntegrity = element.hasAttribute("integrity") && (element as HTMLScriptElement).integrity;
  const hasCrossorigin = element.hasAttribute("crossorigin");
  let isCDN = false;
  try {
    const h = new URL(url, window.location.origin).hostname;
    isCDN = KNOWN_CDNS.some((cdn) => h.includes(cdn));
  } catch {
    /* ignore */
  }

  if (!hasIntegrity && isCDN) {
    const risks = ["cdn_without_sri"];
    if (!hasCrossorigin) risks.push("missing_crossorigin");
    emitSecurityEvent("__SUPPLY_CHAIN_RISK_DETECTED__", {
      url, resourceType, hasIntegrity: false, hasCrossorigin, isCDN, risks, timestamp: Date.now(),
    });
  }
}

function hasSensitiveFields(form: HTMLFormElement): { hasSensitive: boolean; fieldType: string | null } {
  for (const input of form.querySelectorAll("input")) {
    const type = (input.type || "").toLowerCase();
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (SENSITIVE_TYPES.includes(type)) return { hasSensitive: true, fieldType: type };
    for (const pattern of SENSITIVE_NAMES) {
      if (name.includes(pattern) || id.includes(pattern)) return { hasSensitive: true, fieldType: pattern };
    }
    if (autocomplete.includes("password") || autocomplete.includes("cc-")) return { hasSensitive: true, fieldType: autocomplete };
  }
  return { hasSensitive: false, fieldType: null };
}

export function initSecurityHooks(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  // ===== Supply Chain Risk - DOM Observer =====
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        if (el.tagName === "SCRIPT" && (el as HTMLScriptElement).src) {
          checkSupplyChainRisk(emitSecurityEvent, el as HTMLScriptElement, "script");
        }
        if (el.tagName === "LINK" && (el as HTMLLinkElement).href) {
          const isStylesheet = (el as HTMLLinkElement).relList
            ? (el as HTMLLinkElement).relList.contains("stylesheet")
            : el.getAttribute("rel")?.split(/\s+/).includes("stylesheet");
          if (isStylesheet) checkSupplyChainRisk(emitSecurityEvent, el as HTMLLinkElement, "stylesheet");
        }
      }
    }
  });

  const startObserving = () => {
    if (document.head) observer.observe(document.head, { childList: true, subtree: true });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      }, { once: true });
    }
  };
  if (document.body || document.head) startObserving();
  else document.addEventListener("DOMContentLoaded", startObserving, { once: true });

  // ===== Credential Theft =====
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    try {
      const actionUrl = new URL(form.action || window.location.href, window.location.origin);
      const isCrossOrigin = actionUrl.hostname !== window.location.hostname;
      const isSecure = actionUrl.protocol === "https:";
      const { hasSensitive, fieldType } = hasSensitiveFields(form);
      if (hasSensitive) {
        const risks: string[] = [];
        if (!isSecure) risks.push("insecure_protocol");
        if (isCrossOrigin) risks.push("cross_origin");
        emitSecurityEvent("__CREDENTIAL_THEFT_DETECTED__", {
          formAction: actionUrl.href, targetDomain: actionUrl.hostname,
          method: (form.method || "GET").toUpperCase(), isSecure, isCrossOrigin,
          fieldType, risks, timestamp: Date.now(),
        });
      }
    } catch {
      /* ignore */
    }
  }, true);

  // ===== Clipboard Hijack =====
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text: string) {
      for (const [type, pattern] of Object.entries(CRYPTO_PATTERNS)) {
        if (pattern.test(text)) {
          emitSecurityEvent("__CLIPBOARD_HIJACK_DETECTED__", {
            text: text.substring(0, 20) + "...", cryptoType: type, fullLength: text.length, timestamp: Date.now(),
          });
          break;
        }
      }
      return originalWriteText(text);
    };
  }

  // ===== Cookie Access =====
  let lastCookieAccessTime = 0;
  try {
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (desc?.get) {
      const originalGet = desc.get;
      Object.defineProperty(document, "cookie", {
        get() {
          const now = Date.now();
          if (now - lastCookieAccessTime > 1000) {
            lastCookieAccessTime = now;
            emitSecurityEvent("__COOKIE_ACCESS_DETECTED__", { timestamp: now, readCount: 1, pageUrl: window.location.href });
          }
          return originalGet.call(document);
        },
        set: desc.set,
        configurable: true,
      });
    }
  } catch {
    /* ignore */
  }

  // ===== XSS / DOM Scraping =====
  let qsaCount = 0;
  let qsaResetTime = Date.now();
  const originalQSA = document.querySelectorAll.bind(document);
  document.querySelectorAll = function (selector: string) {
    const now = Date.now();
    if (now - qsaResetTime > 5000) { qsaCount = 0; qsaResetTime = now; }
    if (++qsaCount === 50) {
      emitSecurityEvent("__DOM_SCRAPING_DETECTED__", { selector, callCount: qsaCount, timestamp: now });
    }
    return originalQSA(selector);
  } as typeof document.querySelectorAll;

  const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (innerHTMLDesc?.set) {
    Object.defineProperty(Element.prototype, "innerHTML", {
      get: innerHTMLDesc.get,
      set(value: string) {
        if (typeof value === "string" && XSS_PATTERNS.some((p) => p.test(value))) {
          emitSecurityEvent("__XSS_DETECTED__", { type: "innerHTML", payloadPreview: value.substring(0, 100), timestamp: Date.now() });
        }
        return innerHTMLDesc.set!.call(this, value);
      },
      configurable: true,
    });
  }

  // ===== Storage Exfiltration (localStorage/sessionStorage mass access) =====
  for (const [storageType, storage] of [["localStorage", localStorage], ["sessionStorage", sessionStorage]] as const) {
    if (!storage) continue;
    let accessCount = 0;
    let accessResetTime = Date.now();
    const originalGetItem = storage.getItem.bind(storage);
    storage.getItem = function (key: string) {
      const now = Date.now();
      if (now - accessResetTime > 3000) { accessCount = 0; accessResetTime = now; }
      if (++accessCount === 10) {
        emitSecurityEvent("__STORAGE_EXFILTRATION_DETECTED__", {
          storageType,
          accessCount,
          timestamp: now,
          pageUrl: window.location.href,
        });
      }
      return originalGetItem(key);
    };
  }

  // ===== Prototype Pollution Detection =====
  try {
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function <T>(
      obj: T,
      prop: PropertyKey,
      descriptor: PropertyDescriptor & ThisType<unknown>,
    ): T {
      if (obj === Object.prototype || obj === Array.prototype || obj === Function.prototype) {
        emitSecurityEvent("__PROTOTYPE_POLLUTION_DETECTED__", {
          target: obj === Object.prototype ? "Object.prototype" : obj === Array.prototype ? "Array.prototype" : "Function.prototype",
          property: String(prop),
          method: "Object.defineProperty",
          timestamp: Date.now(),
          pageUrl: window.location.href,
        });
      }
      return originalDefineProperty.call(Object, obj, prop, descriptor) as T;
    };
  } catch {
    /* ignore */
  }

  // Intercept __proto__ assignments via a setter on Object.prototype itself is not feasible;
  // instead hook Object.setPrototypeOf as it's the programmatic equivalent.
  try {
    const originalSetPrototypeOf = Object.setPrototypeOf;
    Object.setPrototypeOf = function (obj: object, proto: object | null): object {
      if (proto === null || proto === Object.prototype || proto === Array.prototype) {
        emitSecurityEvent("__PROTOTYPE_POLLUTION_DETECTED__", {
          target: "Object.setPrototypeOf",
          property: "__proto__",
          method: "Object.setPrototypeOf",
          timestamp: Date.now(),
          pageUrl: window.location.href,
        });
      }
      return originalSetPrototypeOf.call(Object, obj, proto);
    };
  } catch {
    /* ignore */
  }

  // ===== DNS Prefetch / Link Injection Detection =====
  const PREFETCH_RELS = new Set(["dns-prefetch", "preconnect", "prefetch", "preload", "prerender"]);
  const dnsPrefetchObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        if (el.tagName !== "LINK") continue;
        const rel = (el.getAttribute("rel") || "").toLowerCase().trim();
        if (!PREFETCH_RELS.has(rel)) continue;
        const href = (el as HTMLLinkElement).href || el.getAttribute("href") || "";
        let isExternal = false;
        try {
          isExternal = new URL(href, window.location.origin).hostname !== window.location.hostname;
        } catch {
          /* ignore */
        }
        if (isExternal) {
          emitSecurityEvent("__DNS_PREFETCH_LEAK_DETECTED__", {
            rel,
            href,
            timestamp: Date.now(),
            pageUrl: window.location.href,
          });
        }
      }
    }
  });

  const startDnsPrefetchObserving = () => {
    if (document.head) dnsPrefetchObserver.observe(document.head, { childList: true, subtree: true });
    if (document.body) {
      dnsPrefetchObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) dnsPrefetchObserver.observe(document.body, { childList: true, subtree: true });
      }, { once: true });
    }
  };
  if (document.body || document.head) startDnsPrefetchObserving();
  else document.addEventListener("DOMContentLoaded", startDnsPrefetchObserving, { once: true });

  // ===== Form Hijack Detection =====
  try {
    const formActionDesc = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "action");
    if (formActionDesc?.set) {
      const originalFormActionSet = formActionDesc.set;
      Object.defineProperty(HTMLFormElement.prototype, "action", {
        get: formActionDesc.get,
        set(value: string) {
          try {
            const newAction = new URL(value, window.location.origin);
            const currentAction = this.action
              ? new URL(this.action, window.location.origin)
              : null;
            const isOriginChange = currentAction !== null && newAction.origin !== currentAction.origin;
            if (isOriginChange) {
              emitSecurityEvent("__FORM_HIJACK_DETECTED__", {
                originalAction: this.action,
                newAction: value,
                targetDomain: newAction.hostname,
                isCrossOrigin: newAction.hostname !== window.location.hostname,
                timestamp: Date.now(),
                pageUrl: window.location.href,
              });
            }
          } catch {
            /* ignore */
          }
          return originalFormActionSet.call(this, value);
        },
        configurable: true,
      });
    }
  } catch {
    /* ignore */
  }

  // ===== CSS Keylogging Detection =====
  // Detects dynamically injected <style> elements using input[value] selectors
  // combined with background-image URLs to exfiltrate keystrokes.
  const cssKeyloggingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        if (el.tagName !== "STYLE") continue;
        const cssText = el.textContent || "";
        // Detect input[value attribute selectors paired with background-image: url(
        if (/input\[value/i.test(cssText) && /background-image\s*:\s*url\s*\(/i.test(cssText)) {
          emitSecurityEvent("__CSS_KEYLOGGING_DETECTED__", {
            sampleRule: cssText.substring(0, 200),
            timestamp: Date.now(),
            pageUrl: window.location.href,
          });
        }
      }
    }
  });

  const startCSSKeyloggingObserving = () => {
    if (document.head) cssKeyloggingObserver.observe(document.head, { childList: true, subtree: true });
    if (document.body) {
      cssKeyloggingObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) cssKeyloggingObserver.observe(document.body, { childList: true, subtree: true });
      }, { once: true });
    }
  };
  if (document.body || document.head) startCSSKeyloggingObserving();
  else document.addEventListener("DOMContentLoaded", startCSSKeyloggingObserving, { once: true });

  // ===== DOM Clobbering Detection =====
  // Named HTML elements (id/name attributes) can shadow built-in window globals.
  const DANGEROUS_GLOBAL_NAMES = new Set([
    "location", "history", "document", "navigator", "window", "parent", "top", "self",
    "frames", "opener", "close", "closed", "stop", "focus", "blur", "open", "alert",
    "confirm", "prompt", "print", "postMessage", "fetch", "XMLHttpRequest",
    "eval", "Function", "Object", "Array", "String", "Number", "Boolean", "Symbol",
    "undefined", "Infinity", "NaN", "isNaN", "isFinite", "parseInt", "parseFloat",
    "encodeURI", "decodeURI", "encodeURIComponent", "decodeURIComponent",
  ]);
  // Also detect form/embed/object elements with any id/name - these are the primary
  // DOM clobbering vectors as they expose nested named access (e.g., formId.inputName)
  const CLOBBERING_TAGS = new Set(["FORM", "EMBED", "OBJECT", "IMG", "A"]);

  const domClobberingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        for (const attrName of ["id", "name"]) {
          const attrValue = el.getAttribute(attrName);
          if (!attrValue) continue;
          // Detect dangerous global name clobbering OR form/embed/object with any id/name
          if (DANGEROUS_GLOBAL_NAMES.has(attrValue) || (CLOBBERING_TAGS.has(el.tagName) && attrName === "id")) {
            emitSecurityEvent("__DOM_CLOBBERING_DETECTED__", {
              attributeName: attrName,
              attributeValue: attrValue,
              tagName: el.tagName,
              timestamp: Date.now(),
              pageUrl: window.location.href,
            });
          }
        }
      }
    }
  });

  const startDomClobberingObserving = () => {
    if (document.head) domClobberingObserver.observe(document.head, { childList: true, subtree: true });
    if (document.body) {
      domClobberingObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) domClobberingObserver.observe(document.body, { childList: true, subtree: true });
      }, { once: true });
    }
  };
  if (document.body || document.head) startDomClobberingObserving();
  else document.addEventListener("DOMContentLoaded", startDomClobberingObserving, { once: true });

  // ===== Suspicious Download =====
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob: Blob | MediaSource) {
    if (blob instanceof Blob) {
      emitSecurityEvent("__SUSPICIOUS_DOWNLOAD_DETECTED__", { type: "blob", size: blob.size, mimeType: blob.type, timestamp: Date.now() });
    }
    return originalCreateObjectURL.call(this, blob);
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement) || (!target.download && !target.href)) return;
    try {
      const href = target.href || "";
      const download = target.download || "";
      if (href.startsWith("blob:") || href.startsWith("data:")) {
        emitSecurityEvent("__SUSPICIOUS_DOWNLOAD_DETECTED__", {
          type: href.startsWith("blob:") ? "blob_link" : "data_url", filename: download, timestamp: Date.now(),
        });
        return;
      }
      const filename = download || href.split("/").pop() || "";
      const ext = "." + filename.split(".").pop()!.toLowerCase();
      if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
        emitSecurityEvent("__SUSPICIOUS_DOWNLOAD_DETECTED__", {
          type: "suspicious_extension", filename, extension: ext, url: href, timestamp: Date.now(),
        });
      }
    } catch {
      /* ignore */
    }
  }, true);
}
