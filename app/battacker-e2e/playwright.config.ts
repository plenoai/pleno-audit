import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  // Default timeout for non-scan tests (2 minutes)
  timeout: 120_000,
  retries: 0,
  use: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    trace: "on-first-retry",
  },
  projects: [
    // Long-running scan projects: 10 minutes (polling external pages)
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testMatch: /browsertotal-scan\.ts$/,
      timeout: 600_000,
    },
    {
      name: "battacker",
      use: { browserName: "chromium" },
      testMatch: /battacker-scan\.ts$/,
      timeout: 600_000,
    },
    // Extension interaction tests: 3 minutes (extension load + flush cycles)
    {
      name: "audit-integration",
      use: { browserName: "chromium" },
      testMatch: /audit-integration\.test\.ts$/,
      timeout: 180_000,
    },
    {
      name: "dnr-monitor",
      use: { browserName: "chromium" },
      testMatch: /extension-dnr-monitor\.test\.ts$/,
      timeout: 180_000,
    },
    {
      name: "defense-score",
      use: { browserName: "chromium" },
      testMatch: /defense-score\.test\.ts$/,
      timeout: 180_000,
    },
    // Smoke test: 1 minute (lightweight, no external dependencies)
    {
      name: "fp-smoke",
      use: { browserName: "chromium" },
      testMatch: /fp-smoke\.test\.ts$/,
      timeout: 60_000,
    },
  ],
});
