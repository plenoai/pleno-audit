/**
 * @fileoverview Security Detection Hooks
 *
 * Supply Chain, Credential Theft, Clipboard Hijack,
 * XSS/DOM Scraping, Suspicious Download の検出フック。
 *
 * === Main World Invariant ===
 * このファイルは MAIN world で実行される。
 * 停止する可能性のある複雑な処理（regex, JSON.parse, Blob生成等）は一切行わない。
 * イベントをフックし、軽量なメタデータのみを queueMicrotask 経由で emit する。
 * 重い解析は background 側で行う。
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

const SUSPICIOUS_EXTENSIONS = [".exe", ".msi", ".bat", ".ps1", ".cmd", ".scr", ".vbs", ".js", ".jar", ".dll"];

// ===== Helpers =====

function deferEmit(emitSecurityEvent: SharedHookUtils["emitSecurityEvent"], name: string, data: Record<string, unknown>): void {
  queueMicrotask(() => emitSecurityEvent(name, data));
}

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
    deferEmit(emitSecurityEvent, "__SUPPLY_CHAIN_RISK_DETECTED__", {
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
        deferEmit(emitSecurityEvent, "__CREDENTIAL_THEFT_DETECTED__", {
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
          deferEmit(emitSecurityEvent, "__CLIPBOARD_HIJACK_DETECTED__", {
            text: text.substring(0, 20) + "...", cryptoType: type, fullLength: text.length, timestamp: Date.now(),
          });
          break;
        }
      }
      return originalWriteText(text);
    };
  }

  // ===== execCommand Clipboard Bypass =====
  const SENSITIVE_EXEC_COMMANDS = new Set(["inserthtml"]);
  const originalExecCommand = document.execCommand.bind(document);
  document.execCommand = function (commandId: string, showUI?: boolean, value?: string): boolean {
    if (SENSITIVE_EXEC_COMMANDS.has(commandId.toLowerCase())) {
      deferEmit(emitSecurityEvent, "__EXECCOMMAND_DETECTED__", {
        command: commandId.toLowerCase(),
        timestamp: Date.now(),
        pageUrl: window.location.href,
      });
    }
    return originalExecCommand(commandId, showUI, value);
  };

  // ===== Cookie Access =====
  // REMOVED: document.cookie getter hook.
  // Cookie tracking is handled by chrome.cookies.onChanged in cookie-monitor.ts.
  // The main-world getter hook was redundant and caused false positives.

  // ===== DOM Scraping (querySelectorAll threshold) =====
  let qsaCount = 0;
  let qsaResetTime = Date.now();
  const originalQSA = document.querySelectorAll.bind(document);
  document.querySelectorAll = function (selector: string) {
    const now = Date.now();
    if (now - qsaResetTime > 5000) { qsaCount = 0; qsaResetTime = now; }
    if (++qsaCount === 300) {
      deferEmit(emitSecurityEvent, "__DOM_SCRAPING_DETECTED__", { selector, callCount: qsaCount, timestamp: now });
    }
    return originalQSA(selector);
  } as typeof document.querySelectorAll;

  // ===== XSS Detection (innerHTML) =====
  // REMOVED: Element.prototype.innerHTML setter hook.
  // Modifying Element.prototype triggers anti-tamper detection in banking security SDKs (e.g. ZCB).
  // XSS detection is handled via CSP violation events instead.

  // ===== Storage Exfiltration (localStorage/sessionStorage mass access) =====
  for (const [storageType, storage] of [["localStorage", localStorage], ["sessionStorage", sessionStorage]] as const) {
    if (!storage) continue;
    let accessCount = 0;
    let accessResetTime = Date.now();
    const originalGetItem = storage.getItem.bind(storage);
    storage.getItem = function (key: string) {
      const now = Date.now();
      if (now - accessResetTime > 3000) { accessCount = 0; accessResetTime = now; }
      if (++accessCount === 50) {
        deferEmit(emitSecurityEvent, "__STORAGE_EXFILTRATION_DETECTED__", {
          storageType, accessCount, timestamp: now, pageUrl: window.location.href,
        });
      }
      return originalGetItem(key);
    };
  }

  // ===== Prototype Pollution Detection =====
  // REMOVED: Object.defineProperty / Object.setPrototypeOf hooks.
  // Replacing Object.defineProperty is the most invasive global modification possible —
  // it triggers anti-tamper detection in banking security SDKs (e.g. ZCB/GLOBAL-PROTECT).
  // Prototype pollution is better detected via periodic integrity checks in background.

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
          try {
            const linkHost = new URL(href, window.location.origin).hostname;
            const pageHost = window.location.hostname;
            const linkBase = linkHost.split(".").slice(-2).join(".");
            const pageBase = pageHost.split(".").slice(-2).join(".");
            if (linkBase === pageBase) continue;
          } catch { /* ignore */ }
          deferEmit(emitSecurityEvent, "__DNS_PREFETCH_LEAK_DETECTED__", {
            rel, href, timestamp: Date.now(), pageUrl: window.location.href,
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
              deferEmit(emitSecurityEvent, "__FORM_HIJACK_DETECTED__", {
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
  const cssKeyloggingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        if (el.tagName !== "STYLE") continue;
        const cssText = el.textContent || "";
        // Lightweight string check instead of regex
        if (cssText.includes("input[value") && cssText.includes("background-image")) {
          deferEmit(emitSecurityEvent, "__CSS_KEYLOGGING_DETECTED__", {
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
  const DANGEROUS_GLOBAL_NAMES = new Set([
    "location", "history", "document", "navigator", "window", "parent", "top", "self",
    "frames", "opener", "close", "closed", "stop", "focus", "blur", "open", "alert",
    "confirm", "prompt", "print", "postMessage", "fetch", "XMLHttpRequest",
    "eval", "Function", "Object", "Array", "String", "Number", "Boolean", "Symbol",
    "undefined", "Infinity", "NaN", "isNaN", "isFinite", "parseInt", "parseFloat",
    "encodeURI", "decodeURI", "encodeURIComponent", "decodeURIComponent",
  ]);
  const domClobberingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        for (const attrName of ["id", "name"]) {
          const attrValue = el.getAttribute(attrName);
          if (!attrValue) continue;
          if (DANGEROUS_GLOBAL_NAMES.has(attrValue)) {
            deferEmit(emitSecurityEvent, "__DOM_CLOBBERING_DETECTED__", {
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

  // ===== Fetch Exfiltration Detection =====
  // No async function wrapper — transparent pass-through.
  // Body size calculation removed from hot path; emit only cross-origin flag.
  const FETCH_BODY_THRESHOLD = 10 * 1024; // 10KB
  const originalFetch = window.fetch;
  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

      let isCrossOrigin = false;
      try {
        isCrossOrigin = new URL(url, window.location.origin).origin !== window.location.origin;
      } catch {
        /* ignore */
      }

      if (isCrossOrigin && init?.body != null) {
        // Defer body size estimation — only use lightweight checks
        const body = init.body;
        let estimatedSize = 0;
        if (typeof body === "string") {
          estimatedSize = body.length;
        } else if (body instanceof ArrayBuffer) {
          estimatedSize = body.byteLength;
        }
        // Blob.size and FormData iteration are avoided in hot path
        if (estimatedSize >= FETCH_BODY_THRESHOLD) {
          deferEmit(emitSecurityEvent, "__FETCH_EXFILTRATION_DETECTED__", {
            url,
            mode: init?.mode ?? "cors",
            reason: "cross_origin_large_body",
            bodySize: estimatedSize,
            timestamp: Date.now(),
            pageUrl: window.location.href,
          });
        }
      }
    } catch {
      /* ignore */
    }
    return originalFetch.call(this, input, init);
  };

  // ===== Suspicious Download =====
  const originalCreateObjectURL = URL.createObjectURL;
  const SUSPICIOUS_MIME_TYPES = new Set([
    "application/x-msdownload", "application/x-msdos-program",
    "application/x-executable", "application/octet-stream",
    "application/x-sh", "application/x-bat",
  ]);
  URL.createObjectURL = function (blob: Blob | MediaSource) {
    if (blob instanceof Blob && SUSPICIOUS_MIME_TYPES.has(blob.type)) {
      deferEmit(emitSecurityEvent, "__SUSPICIOUS_DOWNLOAD_DETECTED__", { type: "blob", size: blob.size, mimeType: blob.type, timestamp: Date.now() });
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
        deferEmit(emitSecurityEvent, "__SUSPICIOUS_DOWNLOAD_DETECTED__", {
          type: href.startsWith("blob:") ? "blob_link" : "data_url", filename: download, timestamp: Date.now(),
        });
        return;
      }
      const filename = download || href.split("/").pop() || "";
      const ext = "." + filename.split(".").pop()!.toLowerCase();
      if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
        deferEmit(emitSecurityEvent, "__SUSPICIOUS_DOWNLOAD_DETECTED__", {
          type: "suspicious_extension", filename, extension: ext, url: href, timestamp: Date.now(),
        });
      }
    } catch {
      /* ignore */
    }
  }, true);
}
