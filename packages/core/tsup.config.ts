import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "types/index": "src/types/index.ts",
    "detectors/index": "src/detectors/index.ts",
    "detectors/types": "src/detectors/types.ts",
    "detectors/patterns": "src/detectors/patterns.ts",
    "csp/index": "src/csp/index.ts",
    "csp/types": "src/csp/types.ts",
    "nrd/index": "src/nrd/index.ts",
    "typosquat/index": "src/typosquat/index.ts",
    "ai-detector/index": "src/ai-detector/index.ts",
    "alerts/index": "src/alerts/index.ts",
    "battacker/index": "src/battacker/index.ts",
    "data-export/index": "src/data-export/index.ts",
    "extension-analyzers/index": "src/extension-analyzers/index.ts",
    "extension-analyzers/stats": "src/extension-analyzers/extension-stats-analyzer.ts",
    "extension-analyzers/risk": "src/extension-analyzers/extension-risk-analyzer.ts",
    "extension-analyzers/suspicious":
      "src/extension-analyzers/suspicious-pattern-detector.ts",
    "extension-analyzers/doh": "src/extension-analyzers/doh-monitor.ts",
    "extension-analyzers/cookie": "src/extension-analyzers/cookie-monitor.ts",
    "main-world-hooks/index": "src/main-world-hooks/index.ts",
    "extension-runtime/index": "src/extension-runtime/index.ts",
    "extension-runtime/logger": "src/extension-runtime/logger.ts",
    "extension-runtime/storage": "src/extension-runtime/storage.ts",
    "extension-runtime/storage-types": "src/extension-runtime/storage-types.ts",
    "extension-runtime/cooldown-manager":
      "src/extension-runtime/cooldown-manager.ts",
    "extension-runtime/browser-adapter":
      "src/extension-runtime/browser-adapter.ts",
    "extension-runtime/errors": "src/extension-runtime/errors.ts",
    "background-services/index": "src/background-services/index.ts",
    "extension-network-service/index":
      "src/extension-network-service/index.ts",
    "extension-enterprise/index": "src/extension-enterprise/index.ts",
    "debug-bridge/index": "src/debug-bridge/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
