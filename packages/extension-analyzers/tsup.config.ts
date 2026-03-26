import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "extension-stats-analyzer": "src/extension-stats-analyzer.ts",
    "extension-risk-analyzer": "src/extension-risk-analyzer.ts",
    "suspicious-pattern-detector": "src/suspicious-pattern-detector.ts",
    "doh-monitor": "src/doh-monitor.ts",
    "cookie-monitor": "src/cookie-monitor.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
