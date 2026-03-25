import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    logger: "src/logger.ts",
    storage: "src/storage.ts",
    "storage-types": "src/storage-types.ts",
    "cooldown-manager": "src/cooldown-manager.ts",
    "browser-adapter": "src/browser-adapter.ts",
    "cookie-monitor": "src/cookie-monitor.ts",
    "extension-stats-analyzer": "src/extension-stats-analyzer.ts",
    "extension-risk-analyzer": "src/extension-risk-analyzer.ts",
    "suspicious-pattern-detector": "src/suspicious-pattern-detector.ts",
    "doh-monitor": "src/doh-monitor.ts",
    errors: "src/errors.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
