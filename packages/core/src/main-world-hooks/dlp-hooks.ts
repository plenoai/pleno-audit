/**
 * @fileoverview DLP Detection Hooks
 *
 * クリップボードコピーとフォーム送信をフックし、
 * テキストデータをbackgroundのDLPスキャナーに送信する。
 *
 * === Main World Invariant ===
 * このファイルは MAIN world で実行される。
 * 軽量なメタデータのみを emit する。PII解析はbackgroundで行う。
 */

import { type SharedHookUtils } from "./shared.js";

declare global {
  interface Window {
    __PLENO_DLP_HOOKS_INITIALIZED__?: boolean;
  }
}

/** クリップボード・フォームテキストのサンプル上限 */
const TEXT_SAMPLE_LIMIT = 5000;

function deferEmit(
  emitFn: SharedHookUtils["emitSecurityEvent"],
  eventName: string,
  data: Record<string, unknown>,
) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => emitFn(eventName, data), { timeout: 200 });
    return;
  }
  setTimeout(() => emitFn(eventName, data), 0);
}

export function setupDLPHooks(utils: SharedHookUtils): void {
  if (window.__PLENO_DLP_HOOKS_INITIALIZED__) return;
  window.__PLENO_DLP_HOOKS_INITIALIZED__ = true;

  const { emitSecurityEvent } = utils;

  // ===== Clipboard Copy =====
  document.addEventListener("copy", () => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString();
    if (text.length < 5) return;

    deferEmit(emitSecurityEvent, "__DLP_CLIPBOARD_COPY__", {
      text: text.slice(0, TEXT_SAMPLE_LIMIT),
      pageUrl: location.href,
      domain: location.hostname,
      timestamp: Date.now(),
    });
  });

  // ===== Form Submit =====
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const entries: Record<string, string> = {};
    let hasText = false;

    for (const el of form.elements) {
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        el.name &&
        el.value &&
        el.type !== "password" &&
        el.type !== "hidden" &&
        el.type !== "file"
      ) {
        entries[el.name] = el.value.slice(0, 500);
        hasText = true;
      }
    }

    if (!hasText) return;

    const textSample = Object.entries(entries)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
      .slice(0, TEXT_SAMPLE_LIMIT);

    deferEmit(emitSecurityEvent, "__DLP_FORM_SUBMIT__", {
      text: textSample,
      action: form.action || location.href,
      pageUrl: location.href,
      domain: location.hostname,
      timestamp: Date.now(),
    });
  }, true);
}
