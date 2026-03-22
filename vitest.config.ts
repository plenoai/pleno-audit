import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.spec.ts",
      "packages/**/*.property.ts",
      "app/**/domain/**/*.test.ts",
      "app/**/entrypoints/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/index.ts"],
      thresholds: {
        // Per-package thresholds: detection packages hold 90%+, others ratcheted to current levels
        "packages/nrd/src/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        "packages/typosquat/src/**": {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
        "packages/detectors/src/**": {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        "packages/event-queue/src/**": {
          lines: 95,
          functions: 90,
          branches: 90,
          statements: 95,
        },
        "packages/ai-detector/src/**": {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
        "packages/data-export/src/**": {
          lines: 75,
          functions: 65,
          branches: 65,
          statements: 75,
        },
        "packages/extension-runtime/src/**": {
          lines: 40,
          functions: 50,
          branches: 40,
          statements: 40,
        },
      },
    },
  },
});
