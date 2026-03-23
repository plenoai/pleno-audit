/**
 * Battacker (plenoai.com) E2E Scan Script
 *
 * Usage:
 *   pnpm --filter @libztbs/battacker-e2e battacker
 *
 * Or run directly:
 *   npx tsx app/battacker-e2e/src/battacker-scan.ts
 */

import { chromium, type Page, type Browser } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_URL = "https://plenoai.com/pleno-audit/battacker";
const SCAN_TIMEOUT = 300_000; // 5 minutes
const POLL_INTERVAL = 2_000; // 2 seconds

interface CategoryScore {
  name: string;
  score: number;
}

interface BattackerStatistics {
  grade: string;
  timestamp: string;
  categories: CategoryScore[];
  totalCategories: number;
  averageScore: number;
}

interface BattackerResult {
  timestamp: string;
  url: string;
  statistics: BattackerStatistics;
  logs: string[];
  status: "completed" | "stopped" | "error";
  errorMessage?: string;
}

async function getStatistics(page: Page): Promise<BattackerStatistics | null> {
  try {
    const stats = await page.evaluate(() => {
      const text = document.body.innerText;

      // Extract grade (Grade A-F)
      const gradeMatch = text.match(/Grade\s+([A-F][+-]?)/i);
      const grade = gradeMatch?.[1] || "Unknown";

      // Extract timestamp
      const timestampMatch = text.match(/Timestamp:\s*([^\n]+)/);
      const timestamp = timestampMatch?.[1]?.trim() || "";

      // Extract category scores
      const categories: { name: string; score: number }[] = [];
      const categoryPatterns = [
        { name: "Network Attacks", pattern: /Network Attacks[\s\S]*?(\d+)%/i },
        { name: "Phishing Attacks", pattern: /Phishing Attacks[\s\S]*?(\d+)%/i },
        { name: "Client-Side Attacks", pattern: /Client-Side Attacks[\s\S]*?(\d+)%/i },
        { name: "Download Attacks", pattern: /Download Attacks[\s\S]*?(\d+)%/i },
        { name: "Persistence Attacks", pattern: /Persistence Attacks[\s\S]*?(\d+)%/i },
        { name: "Side-Channel Attacks", pattern: /Side-Channel Attacks[\s\S]*?(\d+)%/i },
        { name: "Fingerprinting Attacks", pattern: /Fingerprinting Attacks[\s\S]*?(\d+)%/i },
        { name: "Cryptojacking Attacks", pattern: /Cryptojacking Attacks[\s\S]*?(\d+)%/i },
        { name: "Privacy Attacks", pattern: /Privacy Attacks[\s\S]*?(\d+)%/i },
        { name: "Media Capture Attacks", pattern: /Media Capture Attacks[\s\S]*?(\d+)%/i },
        { name: "Storage Attacks", pattern: /Storage Attacks[\s\S]*?(\d+)%/i },
        { name: "Worker Attacks", pattern: /Worker Attacks[\s\S]*?(\d+)%/i },
        { name: "Injection Attacks", pattern: /Injection Attacks[\s\S]*?(\d+)%/i },
        { name: "Covert Channel Attacks", pattern: /Covert Channel Attacks[\s\S]*?(\d+)%/i },
        { name: "Advanced Exploitation", pattern: /Advanced Exploitation[\s\S]*?(\d+)%/i },
        { name: "Final Frontier Attacks", pattern: /Final Frontier Attacks[\s\S]*?(\d+)%/i },
        { name: "Deepest Layer Attacks", pattern: /Deepest Layer Attacks[\s\S]*?(\d+)%/i },
      ];

      for (const { name, pattern } of categoryPatterns) {
        const match = text.match(pattern);
        if (match) {
          categories.push({ name, score: parseInt(match[1], 10) });
        }
      }

      // Calculate average score
      const averageScore = categories.length > 0
        ? Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)
        : 0;

      return {
        grade,
        timestamp,
        categories,
        totalCategories: categories.length,
        averageScore,
      };
    });
    return stats;
  } catch {
    return null;
  }
}

async function isScanInProgress(page: Page): Promise<boolean> {
  try {
    const isRunning = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("scanning") || text.includes("running") || text.includes("progress");
    });
    return isRunning;
  } catch {
    return false;
  }
}

async function waitForScanCompletion(
  page: Page,
  logs: string[]
): Promise<BattackerStatistics> {
  const startTime = Date.now();
  let lastStats: BattackerStatistics | null = null;

  while (Date.now() - startTime < SCAN_TIMEOUT) {
    const stats = await getStatistics(page);

    if (stats) {
      console.log(
        `Grade: ${stats.grade} | Categories: ${stats.totalCategories} | Avg Score: ${stats.averageScore}%`
      );
      lastStats = stats;

      // Check if scan is complete by looking for grade and timestamp
      if (stats.grade !== "Unknown" && stats.timestamp && stats.categories.length > 0) {
        // Wait a bit more to ensure all results are loaded
        const isStillRunning = await isScanInProgress(page);
        if (!isStillRunning) {
          console.log("Scan completed!");
          return stats;
        }
      }
    }

    await page.waitForTimeout(POLL_INTERVAL);
  }

  // Timeout reached, return last captured stats
  console.log("Timeout reached, returning last captured stats");
  return lastStats || {
    grade: "Unknown",
    timestamp: "",
    categories: [],
    totalCategories: 0,
    averageScore: 0,
  };
}

function generateMarkdown(result: BattackerResult): string {
  const date = new Date().toISOString().split("T")[0];

  const categoryTable = result.statistics.categories.length > 0
    ? result.statistics.categories
        .map((c) => `| ${c.name} | ${c.score}% |`)
        .join("\n")
    : "| No data available | - |";

  return `# Battacker Scan Results - ${date}

## Scan Overview

- **URL**: ${result.url}
- **Grade**: ${result.statistics.grade}
- **Scan Timestamp**: ${result.statistics.timestamp}
- **Total Categories**: ${result.statistics.totalCategories}
- **Average Score**: ${result.statistics.averageScore}%
- **Status**: ${result.status}
${result.errorMessage ? `- **Error**: ${result.errorMessage}` : ""}

## Category Analysis

| Category | Defense Rate |
|----------|-------------|
${categoryTable}

## Score Interpretation

- **Higher score = Better defense** (e.g., 50% means 50% of attacks blocked)
- **Grade Scale**: A (Best) → F (Worst)

## Raw Log Data

\`\`\`
${result.logs.join("\n")}
\`\`\`

## Scan Metadata

- **Timestamp**: ${result.timestamp}
- **Automated**: Yes (Playwright E2E)
`;
}

async function runBattackerScan(): Promise<BattackerResult> {
  let browser: Browser | null = null;
  const logs: string[] = [];

  try {
    console.log("Launching browser...");
    browser = await chromium.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-notifications",
        "--disable-geolocation",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: [], // Deny all permissions by default
    });

    // Handle dialogs
    context.on("page", (page) => {
      page.on("dialog", async (dialog) => {
        await dialog.dismiss();
      });
    });

    const page = await context.newPage();

    // Set up console log collection
    page.on("console", (msg) => {
      const text = msg.text();
      // Filter for security test relevant logs
      if (
        text.includes("SUCCESS") ||
        text.includes("PASSED") ||
        text.includes("FAILED") ||
        text.includes("blocked") ||
        text.includes("defense") ||
        text.includes("attack") ||
        text.includes("security")
      ) {
        const timestamp = new Date().toLocaleTimeString("ja-JP");
        logs.push(`[${timestamp}] ${msg.type().toUpperCase()} - ${text}`);
      }
    });

    console.log(`Navigating to ${SCAN_URL}...`);
    await page.goto(SCAN_URL, { waitUntil: "networkidle", timeout: 60_000 });

    // Check if there's already a result or if we need to start a scan
    const initialStats = await getStatistics(page);
    console.log(`Initial state - Grade: ${initialStats?.grade || "Unknown"}`);

    // Click "Execute Scan" button
    console.log("Starting scan...");
    const scanButton = page.getByText("[ Execute Scan ]");

    if (await scanButton.isVisible()) {
      await scanButton.click();
      console.log("Scan button clicked, waiting for completion...");
    } else {
      console.log("Scan button not found, checking for existing results...");
    }

    // Wait for scan to complete
    const statistics = await waitForScanCompletion(page, logs);

    return {
      timestamp: new Date().toISOString(),
      url: SCAN_URL,
      statistics,
      logs,
      status: statistics.grade !== "Unknown" ? "completed" : "stopped",
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      url: SCAN_URL,
      statistics: {
        grade: "Unknown",
        timestamp: "",
        categories: [],
        totalCategories: 0,
        averageScore: 0,
      },
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
  console.log("Starting Battacker E2E scan...");

  const result = await runBattackerScan();
  const markdown = generateMarkdown(result);

  // Save result to docs/scan-data
  const outputDir = join(__dirname, "../../../docs/scan-data");
  mkdirSync(outputDir, { recursive: true });

  const date = new Date().toISOString().split("T")[0];
  const outputPath = join(outputDir, `battacker-automated-${date}.md`);

  writeFileSync(outputPath, markdown, "utf-8");
  console.log(`\nResults saved to: ${outputPath}`);

  // Print summary
  console.log("\n=== Scan Summary ===");
  console.log(`Status: ${result.status}`);
  console.log(`Grade: ${result.statistics.grade}`);
  console.log(`Average Score: ${result.statistics.averageScore}%`);
  console.log(`Categories: ${result.statistics.totalCategories}`);
  console.log(`Logs collected: ${result.logs.length}`);

  return result;
}

// Run if executed directly
main().catch(console.error);

export { runBattackerScan, generateMarkdown, type BattackerResult, type BattackerStatistics };
