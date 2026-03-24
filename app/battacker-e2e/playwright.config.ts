import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  timeout: 600_000, // 10 minutes for long-running scans
  retries: 0,
  use: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testMatch: /browsertotal-scan\.ts$/,
    },
    {
      name: "battacker",
      use: { browserName: "chromium" },
      testMatch: /battacker-scan\.ts$/,
    },
    {
      name: "audit-integration",
      use: { browserName: "chromium" },
      testMatch: /audit-integration\.test\.ts$/,
    },
    {
      name: "dnr-monitor",
      use: { browserName: "chromium" },
      testMatch: /extension-dnr-monitor\.test\.ts$/,
    },
    {
      name: "defense-score",
      use: { browserName: "chromium" },
      testMatch: /defense-score\.test\.ts$/,
    },
    {
      name: "fp-smoke",
      use: { browserName: "chromium" },
      testMatch: /fp-smoke\.test\.ts$/,
    },
  ],
});
