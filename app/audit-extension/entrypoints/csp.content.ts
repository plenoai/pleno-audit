/**
 * CSP Content Script
 * Detects CSP violations and writes them to the persistent event queue.
 * Main world custom events are handled by security-bridge.content.ts.
 */

import type { CSPViolation } from "@pleno-audit/csp";
import { createProducer, type StorageAdapter } from "@pleno-audit/event-queue";

const storageAdapter: StorageAdapter = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const tabId = Date.now() % 1_000_000;
    const producer = createProducer(storageAdapter, tabId);
    producer.setContext({ senderUrl: document.location.href });

    // Listen for CSP violation events
    document.addEventListener(
      "securitypolicyviolation",
      (event: SecurityPolicyViolationEvent) => {
        const violation: Omit<CSPViolation, "type"> & { type?: string } = {
          type: "csp-violation",
          timestamp: new Date().toISOString(),
          pageUrl: document.location.href,
          directive: event.violatedDirective,
          blockedURL: event.blockedURI,
          domain: extractDomain(event.blockedURI),
          disposition: event.disposition as "enforce" | "report",
          originalPolicy: event.originalPolicy,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
        };

        // Avoid doing heavy work in the same browser event tick.
        queueMicrotask(() => {
          void producer.enqueue("CSP_VIOLATION", { data: violation });
        });
      },
      true
    );
  },
});
