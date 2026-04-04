# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension-dnr-monitor.test.ts >> declarativeNetRequest Extension Monitor >> should detect extension request via DNR
- Location: src/extension-dnr-monitor.test.ts:43:3

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

```
TypeError: Cannot read properties of undefined (reading 'close')
```

# Test source

```ts
  1   | /**
  2   |  * E2E Test: declarativeNetRequest Extension Monitoring
  3   |  *
  4   |  * このテストは、audit-extensionがdeclarativeNetRequestを使用して
  5   |  * 他の拡張機能（battacker-extension）からのネットワークリクエストを
  6   |  * 検出できることを検証します。
  7   |  */
  8   | import { test, expect, chromium, type BrowserContext } from "@playwright/test";
  9   | import * as path from "node:path";
  10  | import { fileURLToPath } from "node:url";
  11  | 
  12  | const __filename = fileURLToPath(import.meta.url);
  13  | const __dirname = path.dirname(__filename);
  14  | 
  15  | const AUDIT_EXTENSION_PATH = path.resolve(
  16  |   __dirname,
  17  |   "../../audit-extension/dist/chrome-mv3"
  18  | );
  19  | const BATTACKER_EXTENSION_PATH = path.resolve(
  20  |   __dirname,
  21  |   "../../battacker-extension/dist/chrome-mv3"
  22  | );
  23  | 
  24  | test.describe("declarativeNetRequest Extension Monitor", () => {
  25  |   let context: BrowserContext;
  26  | 
  27  |   test.beforeAll(async () => {
  28  |     context = await chromium.launchPersistentContext("", {
  29  |       headless: false,
  30  |       args: [
  31  |         `--disable-extensions-except=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
  32  |         `--load-extension=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
  33  |         "--no-first-run",
  34  |         "--disable-popup-blocking",
  35  |       ],
  36  |     });
  37  |   });
  38  | 
  39  |   test.afterAll(async () => {
> 40  |     await context.close();
      |                   ^ TypeError: Cannot read properties of undefined (reading 'close')
  41  |   });
  42  | 
  43  |   test("should detect extension request via DNR", async () => {
  44  |     // Wait for extensions to load
  45  |     await new Promise((resolve) => setTimeout(resolve, 3000));
  46  | 
  47  |     // Get extension IDs
  48  |     const serviceWorkerTargets = context.serviceWorkers();
  49  |     console.log("Service Workers:", serviceWorkerTargets.map((sw) => sw.url()));
  50  | 
  51  |     // Find audit extension service worker
  52  |     const auditSW = serviceWorkerTargets.find((sw) =>
  53  |       sw.url().includes("/background.js")
  54  |     );
  55  |     expect(auditSW).toBeDefined();
  56  | 
  57  |     // Get extension IDs from URLs
  58  |     const auditUrl = auditSW!.url();
  59  |     const auditExtId = auditUrl.match(/chrome-extension:\/\/([a-z]+)\//)?.[1];
  60  |     console.log("Audit Extension ID:", auditExtId);
  61  | 
  62  |     // Find battacker extension
  63  |     const battackerSW = serviceWorkerTargets.find(
  64  |       (sw) =>
  65  |         sw.url().includes("/background.js") && sw.url() !== auditUrl
  66  |     );
  67  |     expect(battackerSW).toBeDefined();
  68  |     const battackerExtId = battackerSW!.url().match(
  69  |       /chrome-extension:\/\/([a-z]+)\//
  70  |     )?.[1];
  71  |     console.log("Battacker Extension ID:", battackerExtId);
  72  | 
  73  |     // Open example.com in a page
  74  |     const page = await context.newPage();
  75  |     await page.goto("https://example.com");
  76  |     await page.waitForLoadState("domcontentloaded");
  77  | 
  78  |     // Run battacker tests (this triggers network requests from battacker extension)
  79  |     console.log("Running battacker tests to trigger extension requests...");
  80  | 
  81  |     // Click battacker extension icon to open panel (which triggers message passing)
  82  |     // Instead, send message directly to trigger test
  83  |     const battackerUrl = `chrome-extension://${battackerExtId}/panel.html`;
  84  |     const panelPage = await context.newPage();
  85  |     await panelPage.goto(battackerUrl);
  86  |     await panelPage.waitForLoadState("domcontentloaded");
  87  | 
  88  |     // Wait for panel to initialize
  89  |     await new Promise((resolve) => setTimeout(resolve, 2000));
  90  | 
  91  |     // Click run tests button if exists
  92  |     const runButton = panelPage.locator('button:has-text("Run")');
  93  |     if (await runButton.isVisible()) {
  94  |       console.log("Clicking Run button...");
  95  |       await runButton.click();
  96  |       await new Promise((resolve) => setTimeout(resolve, 5000));
  97  |     }
  98  | 
  99  |     // Wait for alarm-based flush (extension monitors flush every minute)
  100 |     console.log("Waiting for extension monitor flush cycle...");
  101 |     await new Promise((resolve) => setTimeout(resolve, 10000));
  102 | 
  103 |     // Check audit extension's dashboard for captured requests
  104 |     const dashboardUrl = `chrome-extension://${auditExtId}/dashboard.html`;
  105 |     const dashboardPage = await context.newPage();
  106 |     await dashboardPage.goto(dashboardUrl);
  107 |     await dashboardPage.waitForLoadState("domcontentloaded");
  108 | 
  109 |     // Wait for dashboard to load
  110 |     await new Promise((resolve) => setTimeout(resolve, 3000));
  111 | 
  112 |     // Take screenshot for evidence
  113 |     await dashboardPage.screenshot({
  114 |       path: `test-results/dnr-monitor-dashboard-${Date.now()}.png`,
  115 |       fullPage: true,
  116 |     });
  117 | 
  118 |     // Navigate to extensions monitoring section if available
  119 |     const extensionTab = dashboardPage.locator('text="拡張機能"');
  120 |     if (await extensionTab.isVisible()) {
  121 |       await extensionTab.click();
  122 |       await new Promise((resolve) => setTimeout(resolve, 1000));
  123 |       await dashboardPage.screenshot({
  124 |         path: `test-results/dnr-monitor-extensions-tab-${Date.now()}.png`,
  125 |         fullPage: true,
  126 |       });
  127 |     }
  128 | 
  129 |     // Check for event logs containing extension requests
  130 |     const eventLogs = dashboardPage.locator('text="extension_request"');
  131 |     const eventCount = await eventLogs.count();
  132 |     console.log(`Found ${eventCount} extension_request events`);
  133 | 
  134 |     // Check storage directly via service worker
  135 |     const _auditSWContext = auditSW as any;
  136 |     const _storageResult = await context.pages()[0].evaluate(async () => {
  137 |       // This runs in page context, not service worker
  138 |       // We can't directly access chrome.storage from here
  139 |       return null;
  140 |     });
```