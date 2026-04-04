/**
 * DLP Offscreen Document
 *
 * MV3 Service Worker には XMLHttpRequest / WASM streaming がないため、
 * ONNX Runtime (Transformers.js) の推論はこの Offscreen Document で実行する。
 */

import { createDLPScanner, type ScanContext } from "libztbs/ai-detector";

const scanner = createDLPScanner({ enabled: true });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "dlp-offscreen") return false;

  switch (message.action) {
    case "init-pipeline": {
      scanner
        .initPipeline()
        .then(() => sendResponse({ success: true }))
        .catch((err: unknown) =>
          sendResponse({ success: false, error: String(err) }),
        );
      return true;
    }
    case "scan": {
      const { text, context, domain, url } = message.data as {
        text: string;
        context: ScanContext;
        domain: string;
        url?: string;
      };
      scanner
        .scan(text, context, domain, url)
        .then((result) => sendResponse({ result }))
        .catch((err: unknown) =>
          sendResponse({ result: null, error: String(err) }),
        );
      return true;
    }
    case "dispose": {
      scanner
        .disposePipeline()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;
    }
    default:
      return false;
  }
});
