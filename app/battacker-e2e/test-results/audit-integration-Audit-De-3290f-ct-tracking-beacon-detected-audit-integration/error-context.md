# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audit-integration.test.ts >> Audit Detection Coverage >> should detect: tracking_beacon_detected
- Location: src/audit-integration.test.ts:492:5

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
  61  |     source: "api-hooks.js",
  62  |     priority: "high",
  63  |     implemented: true,
  64  |   },
  65  |   supply_chain_risk: {
  66  |     description: "External script without SRI (Subresource Integrity)",
  67  |     source: "api-hooks.js",
  68  |     priority: "high",
  69  |     implemented: true,
  70  |   },
  71  |   credential_theft_risk: {
  72  |     description: "Form with password field submitted to external/insecure target",
  73  |     source: "api-hooks.js",
  74  |     priority: "critical",
  75  |     implemented: true,
  76  |   },
  77  | } as const;
  78  | 
  79  | type AuditDetectionType = keyof typeof AUDIT_DETECTION_SPEC;
  80  | 
  81  | interface AuditEvent {
  82  |   type: string;
  83  |   domain: string;
  84  |   timestamp: number;
  85  |   details?: Record<string, unknown>;
  86  | }
  87  | 
  88  | interface DetectionTestResult {
  89  |   type: AuditDetectionType;
  90  |   tested: boolean;
  91  |   detected: boolean;
  92  |   eventCount: number;
  93  |   implemented: boolean;
  94  |   gap?: string;
  95  |   error?: string;
  96  | }
  97  | 
  98  | interface CoverageReport {
  99  |   timestamp: string;
  100 |   summary: {
  101 |     total: number;
  102 |     implemented: number;
  103 |     notImplemented: number;
  104 |     tested: number;
  105 |     detected: number;
  106 |     coveragePercent: number;
  107 |     successRate: number;
  108 |   };
  109 |   results: DetectionTestResult[];
  110 |   gaps: { type: string; reason: string }[];
  111 | }
  112 | 
  113 | interface TestContext {
  114 |   context: BrowserContext;
  115 |   page: Page;
  116 |   auditExtensionId: string;
  117 |   server: Server;
  118 |   serverPort: number;
  119 | }
  120 | 
  121 | // ============================================================================
  122 | // Test Infrastructure
  123 | // ============================================================================
  124 | 
  125 | function startTestServer(): Promise<{ server: Server; port: number }> {
  126 |   return new Promise((resolve) => {
  127 |     const testPageContent = readFileSync(TEST_PAGE_PATH, "utf-8");
  128 | 
  129 |     const server = createServer((req, res) => {
  130 |       if (req.url === "/" || req.url === "/test-page.html") {
  131 |         res.writeHead(200, { "Content-Type": "text/html" });
  132 |         res.end(testPageContent);
  133 |       } else if (req.url === "/external-script.js") {
  134 |         // External script without SRI for supply chain risk test
  135 |         res.writeHead(200, { "Content-Type": "application/javascript" });
  136 |         res.end("console.log('external script loaded');");
  137 |       } else {
  138 |         res.writeHead(200, { "Content-Type": "application/json" });
  139 |         res.end(JSON.stringify({ ok: true }));
  140 |       }
  141 |     });
  142 | 
  143 |     server.listen(0, "127.0.0.1", () => {
  144 |       const addr = server.address();
  145 |       const port = typeof addr === "object" && addr ? addr.port : 3456;
  146 |       resolve({ server, port });
  147 |     });
  148 |   });
  149 | }
  150 | 
  151 | async function setupBrowserWithExtensions(): Promise<TestContext> {
  152 |   if (!existsSync(AUDIT_EXTENSION_PATH)) {
  153 |     throw new Error(`Audit extension not found. Run: pnpm --filter @pleno-audit/audit-extension build`);
  154 |   }
  155 |   if (!existsSync(BATTACKER_EXTENSION_PATH)) {
  156 |     throw new Error(`Battacker extension not found. Run: pnpm --filter libztbs/battacker-extension build`);
  157 |   }
  158 | 
  159 |   const { server, port } = await startTestServer();
  160 | 
> 161 |   const context = await chromium.launchPersistentContext("", {
      |                   ^ Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/hikae/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
  162 |     headless: false,
  163 |     args: [
  164 |       "--headless=new",
  165 |       `--disable-extensions-except=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
  166 |       `--load-extension=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
  167 |       "--no-first-run",
  168 |       "--disable-default-apps",
  169 |     ],
  170 |   });
  171 | 
  172 |   let auditExtensionId: string | null = null;
  173 |   for (let attempt = 0; attempt < 15; attempt++) {
  174 |     await new Promise((r) => setTimeout(r, 500));
  175 |     const serviceWorkers = context.serviceWorkers();
  176 |     for (const sw of serviceWorkers) {
  177 |       if (sw.url().includes("background")) {
  178 |         auditExtensionId = new URL(sw.url()).host;
  179 |         break;
  180 |       }
  181 |     }
  182 |     if (auditExtensionId) break;
  183 |   }
  184 | 
  185 |   if (!auditExtensionId) {
  186 |     await context.close();
  187 |     server.close();
  188 |     throw new Error("Extension service worker not found");
  189 |   }
  190 | 
  191 |   const page = await context.newPage();
  192 |   return { context, page, auditExtensionId, server, serverPort: port };
  193 | }
  194 | 
  195 | // TODO: Migrate to Alert-based detection verification (ADR-053)
  196 | async function getAuditEvents(_context: BrowserContext, _extensionId: string): Promise<AuditEvent[]> {
  197 |   return [];
  198 | }
  199 | 
  200 | // ============================================================================
  201 | // Attack Simulations for Each Detection Type
  202 | // ============================================================================
  203 | 
  204 | async function simulateTrackingBeacon(page: Page): Promise<void> {
  205 |   await page.evaluate(() => {
  206 |     // Use fetch with POST to trigger tracking beacon detection
  207 |     // sendBeacon may not work reliably in headless mode
  208 |     fetch("/tracking/beacon", {
  209 |       method: "POST",
  210 |       headers: { "Content-Type": "application/json" },
  211 |       body: JSON.stringify({
  212 |         event: "pageview",
  213 |         session: "test-session",
  214 |         user_id: "user-456",
  215 |         visitor: "visitor-123",
  216 |       }),
  217 |     }).catch(() => {});
  218 | 
  219 |     // Also try sendBeacon as backup
  220 |     if (navigator.sendBeacon) {
  221 |       navigator.sendBeacon("/analytics/collect", JSON.stringify({
  222 |         event: "click",
  223 |         action: "button_click",
  224 |         user_id: "user-789",
  225 |       }));
  226 |     }
  227 |   });
  228 | }
  229 | 
  230 | async function simulateDataExfiltration(page: Page): Promise<void> {
  231 |   await page.evaluate(() => {
  232 |     fetch("/api/collect", {
  233 |       method: "POST",
  234 |       headers: { "Content-Type": "application/json" },
  235 |       body: JSON.stringify({
  236 |         email: "victim@example.com",
  237 |         password: "supersecret123",
  238 |         api_key: "sk-1234567890abcdef1234567890abcdef",
  239 |       }),
  240 |     }).catch(() => {});
  241 |   });
  242 | }
  243 | 
  244 | async function simulateXSS(page: Page): Promise<void> {
  245 |   await page.evaluate(() => {
  246 |     const div = document.createElement("div");
  247 |     div.innerHTML = '<script>alert("xss")</script>';
  248 |     document.body.appendChild(div);
  249 | 
  250 |     const div2 = document.createElement("div");
  251 |     div2.innerHTML = '<img src=x onerror="alert(1)">';
  252 |     document.body.appendChild(div2);
  253 |   });
  254 | }
  255 | 
  256 | async function simulateDOMScraping(page: Page): Promise<void> {
  257 |   await page.evaluate(() => {
  258 |     for (let i = 0; i < 60; i++) {
  259 |       document.querySelectorAll("*");
  260 |       document.querySelectorAll("input");
  261 |     }
```