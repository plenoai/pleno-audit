/**
 * CSP Content Script
 * Detects CSP violations and sends them to the background via runtime messaging.
 * Main world custom events are handled by security-bridge.content.ts.
 */

import type { CSPViolation } from "@libztbs/csp";
import { fireMessage } from "@libztbs/extension-runtime";

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

        queueMicrotask(() => {
          fireMessage({ type: "CSP_VIOLATION", data: violation });
        });
      },
      true
    );
  },
});
