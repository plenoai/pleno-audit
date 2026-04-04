import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.spec.ts",
      "packages/**/*.property.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
