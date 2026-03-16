import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "packages/**/*.spec.ts", "packages/**/*.property.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/index.ts"],
      // Initial thresholds based on current coverage. Ratchet up as test coverage improves.
      thresholds: {
        lines: 30,
        functions: 40,
        branches: 40,
        statements: 30,
      },
    },
  },
});
