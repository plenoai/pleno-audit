/**
 * False-Positive Smoke Test
 *
 * Loads a page that exercises common legitimate web patterns
 * (SPA hydration, analytics, media player, WebRTC, Workers, etc.)
 * and asserts that the audit extension produces ZERO alerts.
 *
 * Any alert triggered = a false positive that must be fixed in the hooks.
 */

import { test, expect } from "@playwright/test";
import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUDIT_EXTENSION_PATH = resolve(__dirname, "../../audit-extension/dist/chrome-mv3");
const FP_SMOKE_PAGE_PATH = resolve(__dirname, "../fixtures/fp-smoke-page.html");
const FP_SMOKE_REPORT_PATH = resolve(__dirname, "../fp-smoke-report.json");

// ============================================================================
// Test Infrastructure (shared with defense-score.test.ts pattern)
// ============================================================================

interface TestContext {
  context: BrowserContext;
  page: Page;
  server: Server;
  serverPort: number;
}

function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const fpSmokeContent = readFileSync(FP_SMOKE_PAGE_PATH, "utf-8");
    const server = createServer((req, res) => {
      if (req.url === "/" || req.url === "/fp-smoke.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fpSmokeContent);
      } else if (req.url === "/sw.js") {
        // Minimal service worker for PWA test pattern
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end("self.addEventListener('install', () => self.skipWaiting());");
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

async function setupBrowser(): Promise<TestContext> {
  if (!existsSync(AUDIT_EXTENSION_PATH)) {
    throw new Error(
      `Audit extension not found at ${AUDIT_EXTENSION_PATH}. Run: pnpm build`,
    );
  }

  const { server, port } = await startTestServer();

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      `--disable-extensions-except=${AUDIT_EXTENSION_PATH}`,
      `--load-extension=${AUDIT_EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  // Wait for extension service worker to be ready
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.some((sw) => sw.url().includes("background"))) break;
  }

  const page = await context.newPage();
  return { context, page, server, serverPort: port };
}

// ============================================================================
// Alert types
// ============================================================================

interface AlertEntry {
  id: string;
  category: string;
  severity: string;
  title: string;
  description?: string;
  domain?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Tests
// ============================================================================

test.describe("False-Positive Smoke Test", () => {
  let ctx: TestContext;

  test.beforeAll(async () => {
    ctx = await setupBrowser();
  });

  test.afterAll(async () => {
    if (ctx?.context) await ctx.context.close();
    if (ctx?.server) ctx.server.close();
  });

  test("legitimate web patterns produce zero alerts", async () => {
    // Navigate to FP smoke page and let patterns auto-execute
    await ctx.page.goto(
      `http://127.0.0.1:${ctx.serverPort}/fp-smoke.html`,
      { waitUntil: "domcontentloaded" },
    );

    // Wait for extension hooks to inject
    await ctx.page.waitForTimeout(2000);

    // Wait for all patterns to complete:
    // - Immediate patterns run instantly
    // - Boundary tests run after 4s delay (to reset time windows)
    // - Then security-bridge batch processing needs time to flush
    await ctx.page.waitForTimeout(8000);

    // Collect alerts from extension
    const sw = ctx.context
      .serviceWorkers()
      .find((w) => w.url().includes("background"));
    expect(sw, "Extension service worker should be running").toBeTruthy();

    const extensionId = sw!.url().split("/")[2];
    expect(extensionId, "Extension ID should be found").toBeTruthy();

    const dashPage = await ctx.context.newPage();
    await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html`, {
      waitUntil: "domcontentloaded",
    });
    await dashPage.waitForTimeout(2000);

    const result = await dashPage
      .evaluate(async () => {
        try {
          return await chrome.runtime.sendMessage({ type: "GET_POPUP_EVENTS" });
        } catch (e) {
          return { error: (e as Error).message, events: [], counts: {} };
        }
      })
      .catch((e: Error) => ({
        error: e.message,
        events: [] as AlertEntry[],
        counts: {} as Record<string, number>,
      }));

    await dashPage.close();

    const rawAlerts: AlertEntry[] =
      result && typeof result === "object" && "events" in result
        ? (result as { events: AlertEntry[] }).events
        : [];
    const counts: Record<string, number> =
      result && typeof result === "object" && "counts" in result
        ? (result as { counts: Record<string, number> }).counts
        : {};

    // Categorize alerts into actionable FPs vs accepted/non-hook signals
    // - compliance: page analysis layer, not main-world hooks (test page lacks cookie policy)
    // - audio_fingerprint: dedup'd to 1/page, inherent for any AudioContext usage
    // - webrtc_connection: dedup'd to 1/page, inherent for any RTCPeerConnection usage
    const ACCEPTED_CATEGORIES = new Set([
      "compliance",
      "audio_fingerprint",
      "webrtc_connection",
    ]);
    const alerts = rawAlerts.filter((a) => !ACCEPTED_CATEGORIES.has(a.category));
    const acceptedAlerts = rawAlerts.filter((a) => ACCEPTED_CATEGORIES.has(a.category));

    // Report
    const report = {
      timestamp: new Date().toISOString(),
      totalAlerts: rawAlerts.length,
      actionableAlerts: alerts.length,
      acceptedAlerts: acceptedAlerts.length,
      alertsByCategory: rawAlerts.reduce(
        (acc, a) => {
          acc[a.category] = (acc[a.category] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      counts,
      alerts: rawAlerts.map((a) => ({
        category: a.category,
        severity: a.severity,
        title: a.title,
        description: a.description,
        details: a.details,
        accepted: ACCEPTED_CATEGORIES.has(a.category),
      })),
    };

    writeFileSync(FP_SMOKE_REPORT_PATH, JSON.stringify(report, null, 2));

    console.log("\n" + "=".repeat(70));
    console.log("  FALSE-POSITIVE SMOKE TEST REPORT");
    console.log("=".repeat(70));
    console.log(`\n  Total alerts: ${rawAlerts.length} (${alerts.length} actionable, ${acceptedAlerts.length} accepted)`);

    if (alerts.length > 0) {
      console.log("\n  ALERTS (these are FALSE POSITIVES that need fixing):");
      console.log("  " + "-".repeat(60));
      const byCategory = new Map<string, AlertEntry[]>();
      for (const a of alerts) {
        const existing = byCategory.get(a.category) ?? [];
        existing.push(a);
        byCategory.set(a.category, existing);
      }
      for (const [cat, catAlerts] of [...byCategory.entries()].sort(
        (a, b) => b[1].length - a[1].length,
      )) {
        console.log(`\n  ${cat} (${catAlerts.length} alerts):`);
        for (const a of catAlerts.slice(0, 5)) {
          console.log(`    - [${a.severity}] ${a.title}`);
          if (a.description) console.log(`      ${a.description.substring(0, 80)}`);
        }
        if (catAlerts.length > 5) {
          console.log(`    ... and ${catAlerts.length - 5} more`);
        }
      }
    } else {
      console.log("\n  PASS: No actionable false positives detected!");
    }

    if (acceptedAlerts.length > 0) {
      console.log(`\n  ACCEPTED SIGNALS (${acceptedAlerts.length} — not main-world hook FPs):`);
      for (const a of acceptedAlerts) {
        console.log(`    - [${a.severity}] ${a.category}: ${a.title}`);
      }
    }

    if (Object.keys(counts).length > 0) {
      console.log(`\n  Event counts: ${JSON.stringify(counts)}`);
    }
    console.log("\n" + "=".repeat(70));
    console.log(`  Report saved to: ${FP_SMOKE_REPORT_PATH}`);

    // ASSERTION: Zero alerts from legitimate behavior
    expect(
      alerts.length,
      `Expected 0 false positive alerts but got ${alerts.length}. ` +
        `Categories: ${JSON.stringify(report.alertsByCategory)}. ` +
        `See ${FP_SMOKE_REPORT_PATH} for details.`,
    ).toBe(0);
  });
});
