import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
    patterns: "src/patterns.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
