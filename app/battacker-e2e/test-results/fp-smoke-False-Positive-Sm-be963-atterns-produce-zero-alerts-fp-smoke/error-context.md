# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fp-smoke.test.ts >> False-Positive Smoke Test >> legitimate web patterns produce zero alerts
- Location: src/fp-smoke.test.ts:121:3

# Error details

```
Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/hikae/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     pnpm exec playwright install                           ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```

# Test source

```ts
  1   | /**
  2   |  * False-Positive Smoke Test
  3   |  *
  4   |  * Loads a page that exercises common legitimate web patterns
  5   |  * (SPA hydration, analytics, media player, WebRTC, Workers, etc.)
  6   |  * and asserts that the audit extension produces ZERO alerts.
  7   |  *
  8   |  * Any alert triggered = a false positive that must be fixed in the hooks.
  9   |  */
  10  | 
  11  | import { test, expect } from "@playwright/test";
  12  | import { chromium, type BrowserContext, type Page } from "playwright";
  13  | import { resolve, dirname } from "node:path";
  14  | import { fileURLToPath } from "node:url";
  15  | import { existsSync, readFileSync, writeFileSync } from "node:fs";
  16  | import { createServer, type Server } from "node:http";
  17  | 
  18  | const __dirname = dirname(fileURLToPath(import.meta.url));
  19  | 
  20  | const AUDIT_EXTENSION_PATH = resolve(__dirname, "../../audit-extension/dist/chrome-mv3");
  21  | const FP_SMOKE_PAGE_PATH = resolve(__dirname, "../fixtures/fp-smoke-page.html");
  22  | const FP_SMOKE_REPORT_PATH = resolve(__dirname, "../fp-smoke-report.json");
  23  | 
  24  | // ============================================================================
  25  | // Test Infrastructure (shared with defense-score.test.ts pattern)
  26  | // ============================================================================
  27  | 
  28  | interface TestContext {
  29  |   context: BrowserContext;
  30  |   page: Page;
  31  |   server: Server;
  32  |   serverPort: number;
  33  | }
  34  | 
  35  | function startTestServer(): Promise<{ server: Server; port: number }> {
  36  |   return new Promise((resolve) => {
  37  |     const fpSmokeContent = readFileSync(FP_SMOKE_PAGE_PATH, "utf-8");
  38  |     const server = createServer((req, res) => {
  39  |       if (req.url === "/" || req.url === "/fp-smoke.html") {
  40  |         res.writeHead(200, { "Content-Type": "text/html" });
  41  |         res.end(fpSmokeContent);
  42  |       } else if (req.url === "/sw.js") {
  43  |         // Minimal service worker for PWA test pattern
  44  |         res.writeHead(200, { "Content-Type": "application/javascript" });
  45  |         res.end("self.addEventListener('install', () => self.skipWaiting());");
  46  |       } else {
  47  |         res.writeHead(200, { "Content-Type": "application/json" });
  48  |         res.end(JSON.stringify({ ok: true }));
  49  |       }
  50  |     });
  51  |     server.listen(0, "127.0.0.1", () => {
  52  |       const addr = server.address();
  53  |       const port = typeof addr === "object" && addr ? addr.port : 3456;
  54  |       resolve({ server, port });
  55  |     });
  56  |   });
  57  | }
  58  | 
  59  | async function setupBrowser(): Promise<TestContext> {
  60  |   if (!existsSync(AUDIT_EXTENSION_PATH)) {
  61  |     throw new Error(
  62  |       `Audit extension not found at ${AUDIT_EXTENSION_PATH}. Run: pnpm build`,
  63  |     );
  64  |   }
  65  | 
  66  |   const { server, port } = await startTestServer();
  67  | 
> 68  |   const context = await chromium.launchPersistentContext("", {
      |                   ^ Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/hikae/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
  69  |     headless: false,
  70  |     args: [
  71  |       "--headless=new",
  72  |       `--disable-extensions-except=${AUDIT_EXTENSION_PATH}`,
  73  |       `--load-extension=${AUDIT_EXTENSION_PATH}`,
  74  |       "--no-first-run",
  75  |       "--disable-default-apps",
  76  |     ],
  77  |   });
  78  | 
  79  |   // Wait for extension service worker to be ready
  80  |   for (let attempt = 0; attempt < 15; attempt++) {
  81  |     await new Promise((r) => setTimeout(r, 500));
  82  |     const serviceWorkers = context.serviceWorkers();
  83  |     if (serviceWorkers.some((sw) => sw.url().includes("background"))) break;
  84  |   }
  85  | 
  86  |   const page = await context.newPage();
  87  |   return { context, page, server, serverPort: port };
  88  | }
  89  | 
  90  | // ============================================================================
  91  | // Alert types
  92  | // ============================================================================
  93  | 
  94  | interface AlertEntry {
  95  |   id: string;
  96  |   category: string;
  97  |   severity: string;
  98  |   title: string;
  99  |   description?: string;
  100 |   domain?: string;
  101 |   timestamp: number;
  102 |   details?: Record<string, unknown>;
  103 | }
  104 | 
  105 | // ============================================================================
  106 | // Tests
  107 | // ============================================================================
  108 | 
  109 | test.describe("False-Positive Smoke Test", () => {
  110 |   let ctx: TestContext;
  111 | 
  112 |   test.beforeAll(async () => {
  113 |     ctx = await setupBrowser();
  114 |   });
  115 | 
  116 |   test.afterAll(async () => {
  117 |     if (ctx?.context) await ctx.context.close();
  118 |     if (ctx?.server) ctx.server.close();
  119 |   });
  120 | 
  121 |   test("legitimate web patterns produce zero alerts", async () => {
  122 |     // Navigate to FP smoke page and let patterns auto-execute
  123 |     await ctx.page.goto(
  124 |       `http://127.0.0.1:${ctx.serverPort}/fp-smoke.html`,
  125 |       { waitUntil: "domcontentloaded" },
  126 |     );
  127 | 
  128 |     // Wait for extension hooks to inject
  129 |     await ctx.page.waitForTimeout(2000);
  130 | 
  131 |     // Wait for all patterns to complete:
  132 |     // - Immediate patterns run instantly
  133 |     // - Boundary tests run after 6s delay (to reset all time windows: QSA=5s, cookie=3s)
  134 |     // - Then security-bridge batch processing needs time to flush
  135 |     await ctx.page.waitForTimeout(10000);
  136 | 
  137 |     // Collect alerts from extension
  138 |     const sw = ctx.context
  139 |       .serviceWorkers()
  140 |       .find((w) => w.url().includes("background"));
  141 |     expect(sw, "Extension service worker should be running").toBeTruthy();
  142 | 
  143 |     const extensionId = sw!.url().split("/")[2];
  144 |     expect(extensionId, "Extension ID should be found").toBeTruthy();
  145 | 
  146 |     const dashPage = await ctx.context.newPage();
  147 |     await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html`, {
  148 |       waitUntil: "domcontentloaded",
  149 |     });
  150 |     await dashPage.waitForTimeout(2000);
  151 | 
  152 |     const result = await dashPage
  153 |       .evaluate(async () => {
  154 |         try {
  155 |           return await chrome.runtime.sendMessage({ type: "GET_POPUP_EVENTS" });
  156 |         } catch (e) {
  157 |           return { error: (e as Error).message, events: [], counts: {} };
  158 |         }
  159 |       })
  160 |       .catch((e: Error) => ({
  161 |         error: e.message,
  162 |         events: [] as AlertEntry[],
  163 |         counts: {} as Record<string, number>,
  164 |       }));
  165 | 
  166 |     await dashPage.close();
  167 | 
  168 |     const rawAlerts: AlertEntry[] =
```