/**
 * BrowserTotal E2E Scan Script
 *
 * Usage:
 *   pnpm --filter libztbs/battacker-e2e browsertotal
 *
 * Or run directly:
 *   npx tsx app/battacker-e2e/src/browsertotal-scan.ts
 */

import { chromium, type Page, type Browser } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_URL = "https://browsertotal.com/browser-posture-scan";
const SCAN_TIMEOUT = 600_000; // 10 minutes
const POLL_INTERVAL = 5_000; // 5 seconds

interface ScanStatistics {
  total: number;
  passed: number;
  failed: number;
  running: number;
  queued: number;
  progress: number;
}

interface ScanResult {
  timestamp: string;
  url: string;
  version: string;
  statistics: ScanStatistics;
  logs: string[];
  status: "completed" | "stopped" | "error";
  errorMessage?: string;
}

async function getStatistics(page: Page): Promise<ScanStatistics | null> {
  try {
    const stats = await page.evaluate(() => {
      const text = document.body.innerText;

      // Try multiple patterns to find statistics
      // Pattern 1: "TOTAL 131" format
      let total = text.match(/TOTAL\s*(\d+)/i)?.[1];
      let passed = text.match(/PASSED\s*(\d+)/i)?.[1];
      let failed = text.match(/FAILED\s*(\d+)/i)?.[1];
      let running = text.match(/RUNNING\s*(\d+)/i)?.[1];
      let queued = text.match(/QUEUED\s*(\d+)/i)?.[1];
      let progress = text.match(/(\d+)%\s*Complete/i)?.[1];

      // Pattern 2: Look for number after label with various separators
      if (!passed) {
        const passedMatch = text.match(/Passed[:\s]*(\d+)/i);
        passed = passedMatch?.[1];
      }
      if (!failed) {
        const failedMatch = text.match(/Failed[:\s]*(\d+)/i);
        failed = failedMatch?.[1];
      }

      // Pattern 3: Check for "84 ✓" style indicators
      if (!passed) {
        const checkMatch = text.match(/(\d+)\s*[✓✔]/);
        passed = checkMatch?.[1];
      }
      if (!failed) {
        const xMatch = text.match(/(\d+)\s*[✗✕×x]/i);
        failed = xMatch?.[1];
      }

      // If no total found, default to 131
      if (!total) total = "131";

      return {
        total: parseInt(total) || 131,
        passed: parseInt(passed || "0"),
        failed: parseInt(failed || "0"),
        running: parseInt(running || "0"),
        queued: parseInt(queued || "0"),
        progress: parseInt(progress || "0"),
      };
    });
    return stats;
  } catch {
    return null;
  }
}

async function _collectConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("SUCCESS") ||
      text.includes("ERROR") ||
      text.includes("WARNING") ||
      text.includes("RESULT")
    ) {
      const timestamp = new Date().toLocaleTimeString("ja-JP");
      logs.push(`[${timestamp}] ${msg.type().toUpperCase()} - ${text}`);
    }
  });

  return logs;
}

async function waitForScanCompletion(
  page: Page,
  _logs: string[]
): Promise<ScanStatistics> {
  const startTime = Date.now();
  let bestStats: ScanStatistics = { total: 131, passed: 0, failed: 0, running: 0, queued: 0, progress: 0 };
  let zeroProgressCount = 0;

  while (Date.now() - startTime < SCAN_TIMEOUT) {
    const stats = await getStatistics(page);

    if (stats) {
      console.log(
        `Progress: ${stats.progress}% | Passed: ${stats.passed} | Failed: ${stats.failed} | Running: ${stats.running}`
      );

      // Keep track of best statistics (highest progress)
      if (stats.progress > bestStats.progress || stats.passed > bestStats.passed) {
        bestStats = stats;
        zeroProgressCount = 0;
      }

      // Check if scan is complete (100% or all tests done)
      if (stats.progress >= 99 || (stats.running === 0 && stats.queued === 0 && stats.passed + stats.failed >= 100)) {
        console.log("Scan completed!");
        return stats.progress > 0 ? stats : bestStats;
      }

      // If we see 0% progress multiple times after having progress, scan likely finished
      if (stats.progress === 0 && bestStats.progress > 50) {
        zeroProgressCount++;
        if (zeroProgressCount >= 3) {
          console.log("Scan finished (page reset detected)");
          return bestStats;
        }
      }
    }

    await page.waitForTimeout(POLL_INTERVAL);
  }

  // Timeout reached, return best stats we captured
  console.log("Timeout reached, returning best captured stats");
  return bestStats;
}

function generateMarkdown(result: ScanResult): string {
  const date = new Date().toISOString().split("T")[0];

  return `# BrowserTotal Scan Results - ${date}

## Scan Overview

- **URL**: ${result.url}
- **Version**: ${result.version}
- **Total Tests**: ${result.statistics.total}
- **Progress at capture**: ${result.statistics.progress}%
- **Status**: ${result.status}
${result.errorMessage ? `- **Error**: ${result.errorMessage}` : ""}

## Final Statistics (${result.statistics.progress}% Complete)

| Metric | Value |
|--------|-------|
| Total | ${result.statistics.total} |
| Passed | ${result.statistics.passed} |
| Failed | ${result.statistics.failed} |
| Running | ${result.statistics.running} |
| Queued | ${result.statistics.queued} |

## Raw Log Data

\`\`\`
${result.logs.join("\n")}
\`\`\`

## Scan Metadata

- **Timestamp**: ${result.timestamp}
- **Automated**: Yes (Playwright E2E)
`;
}

async function runBrowserTotalScan(): Promise<ScanResult> {
  let browser: Browser | null = null;
  const logs: string[] = [];

  try {
    console.log("Launching browser...");
    browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-web-security",
        "--no-sandbox",
        "--disable-notifications",
        "--disable-geolocation",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--deny-permission-prompts",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: [], // Deny all permissions by default
      geolocation: undefined,
    });

    // Block all permission requests
    context.on("page", (page) => {
      page.on("dialog", async (dialog) => {
        await dialog.dismiss();
      });
    });
    const page = await context.newPage();

    // Set up console log collection (filter for relevant messages)
    page.on("console", (msg) => {
      const text = msg.text();
      // Filter for security test relevant logs
      if (
        text.includes("SUCCESS") ||
        text.includes("PASSED") ||
        text.includes("FAILED") ||
        text.includes("certificate") ||
        text.includes("XSS") ||
        text.includes("rejected") ||
        text.includes("accepted") ||
        text.includes("vulnerable") ||
        text.includes("protection") ||
        text.includes("security")
      ) {
        const timestamp = new Date().toLocaleTimeString("ja-JP");
        logs.push(`[${timestamp}] ${msg.type().toUpperCase()} - ${text}`);
      }
    });

    console.log(`Navigating to ${SCAN_URL}...`);
    await page.goto(SCAN_URL, { waitUntil: "networkidle", timeout: 60_000 });

    // Get version info
    const version = await page.evaluate(() => {
      const versionEl = document.body.innerText.match(/v\d+\.\d+\.\d+/)?.[0];
      return versionEl || "unknown";
    });

    console.log(`BrowserTotal version: ${version}`);

    // Click Start Security Scan button
    console.log("Starting scan...");
    const startButton = page.getByText("Start Security Scan");
    await startButton.click();

    // Wait for initialization dialog and click Proceed
    await page.waitForTimeout(2000);
    const proceedButton = page.getByText("PROCEED WITH SCAN");
    if (await proceedButton.isVisible()) {
      await proceedButton.click();
    }

    // Wait for scan to complete
    console.log("Waiting for scan completion...");
    const statistics = await waitForScanCompletion(page, logs);

    return {
      timestamp: new Date().toISOString(),
      url: SCAN_URL,
      version,
      statistics,
      logs,
      status: statistics.progress >= 99 ? "completed" : "stopped",
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      url: SCAN_URL,
      version: "unknown",
      statistics: { total: 131, passed: 0, failed: 0, running: 0, queued: 0, progress: 0 },
      logs,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log("Starting BrowserTotal E2E scan...");

  const result = await runBrowserTotalScan();
  const markdown = generateMarkdown(result);

  // Save result to docs/scan-data
  const outputDir = join(__dirname, "../../../docs/scan-data");
  mkdirSync(outputDir, { recursive: true });

  const date = new Date().toISOString().split("T")[0];
  const outputPath = join(outputDir, `browsertotal-automated-${date}.md`);

  writeFileSync(outputPath, markdown, "utf-8");
  console.log(`\nResults saved to: ${outputPath}`);

  // Print summary
  console.log("\n=== Scan Summary ===");
  console.log(`Status: ${result.status}`);
  console.log(`Progress: ${result.statistics.progress}%`);
  console.log(`Passed: ${result.statistics.passed}`);
  console.log(`Failed: ${result.statistics.failed}`);
  console.log(`Logs collected: ${result.logs.length}`);

  return result;
}

// Run if executed directly
main().catch(console.error);

export { runBrowserTotalScan, generateMarkdown, type ScanResult, type ScanStatistics };
