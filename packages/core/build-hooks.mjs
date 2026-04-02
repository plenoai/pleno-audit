/**
 * main-world-hooks ビルドスクリプト
 *
 * 各エントリポイントをIIFE形式にバンドルし、
 * audit-extensionのpublic/ディレクトリに出力する。
 */

import esbuild from "esbuild";
const { build } = esbuild;
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../../app/audit-extension/public");

const entries = [
  { input: "src/main-world-hooks/entry-api-hooks.ts", output: "api-hooks.js" },
  { input: "src/main-world-hooks/entry-fingerprint-hooks.ts", output: "hooks/fingerprint-hooks.js" },
  { input: "src/main-world-hooks/entry-websocket-hooks.ts", output: "hooks/websocket-hooks.js" },
  { input: "src/main-world-hooks/entry-worker-hooks.ts", output: "hooks/worker-hooks.js" },
  { input: "src/main-world-hooks/entry-injection-hooks.ts", output: "hooks/injection-hooks.js" },
];

for (const entry of entries) {
  await build({
    entryPoints: [resolve(__dirname, entry.input)],
    outfile: resolve(outDir, entry.output),
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
  });
  console.log(`  ✓ ${entry.output}`);
}

console.log("Build complete.");
