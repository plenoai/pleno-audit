import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    logger: "src/logger.ts",
    storage: "src/storage.ts",
    "storage-types": "src/storage-types.ts",
    "cooldown-manager": "src/cooldown-manager.ts",
    "browser-adapter": "src/browser-adapter.ts",
    errors: "src/errors.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
