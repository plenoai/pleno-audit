import { defineConfig } from "wxt";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const battackerPath = resolve(__dirname, "../battacker-extension/dist/chrome-mv3");

export default defineConfig({
  srcDir: ".",
  // Use separate output dir for dev to avoid conflicts with manually loaded extensions
  outDir: process.env.DEBUG_PORT ? ".wxt-dev" : "dist",
  imports: false,
  webExt: {
    startUrls: ["https://example.com"],
    chromiumArgs: [`--load-extension=${battackerPath}`],
  },
  manifest: (env) => {
    const isDev = env.mode === "development";
    const iconPrefix = isDev ? "icon-dev" : "icon";
    const isFirefox = env.browser === "firefox";
    const isSafari = env.browser === "safari";
    const isMV2 = isFirefox || isSafari;

    // Base permissions (cross-browser)
    // unlimitedStorage: ZTA監査証跡の完全保持のため
    const basePermissions = ["cookies", "storage", "unlimitedStorage", "activeTab", "alarms", "webRequest", "management", "notifications"];

    // Chrome/Edge MV3 permissions
    const mv3Permissions = [...basePermissions, "offscreen", "scripting", "declarativeNetRequest", "declarativeNetRequestFeedback", "identity"];

    // Firefox/Safari MV2 permissions (no offscreen, no scripting)
    const mv2Permissions = basePermissions;

    return {
      name: isDev ? "[DEV] Pleno Audit" : "Pleno Audit",
      version: "0.0.1",
      description: "Personal Browser Security",
      icons: {
        16: `${iconPrefix}-16.png`,
        32: `${iconPrefix}-32.png`,
        48: `${iconPrefix}-48.png`,
        128: `${iconPrefix}-128.png`,
      },
      action: {
        default_icon: {
          16: `${iconPrefix}-16.png`,
          32: `${iconPrefix}-32.png`,
          48: `${iconPrefix}-48.png`,
        },
      },
      permissions: isMV2 ? mv2Permissions : mv3Permissions,
      host_permissions: ["<all_urls>"],
      ...(!isDev && {
        content_security_policy: isMV2
          ? "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
          : {
              extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
            },
      }),
      web_accessible_resources: isMV2
        ? ["api-hooks.js", "hooks/websocket-hooks.js", "hooks/worker-hooks.js", "hooks/injection-hooks.js", "parquet_wasm_bg.wasm"]
        : [
            {
              resources: ["api-hooks.js", "hooks/websocket-hooks.js", "hooks/worker-hooks.js", "hooks/injection-hooks.js", "parquet_wasm_bg.wasm"],
              matches: ["<all_urls>"],
            },
          ],
      // Static content script registration for MAIN world (MV3 only)
      ...(!isMV2 && {
        content_scripts: [
          {
            js: ["api-hooks.js"],
            matches: ["<all_urls>"],
            run_at: "document_start",
            world: "MAIN",
          },
          {
            js: ["hooks/websocket-hooks.js"],
            matches: ["<all_urls>"],
            run_at: "document_start",
            world: "MAIN",
          },
          {
            js: ["hooks/worker-hooks.js"],
            matches: ["<all_urls>"],
            run_at: "document_start",
            world: "MAIN",
          },
          {
            js: ["hooks/injection-hooks.js"],
            matches: ["<all_urls>"],
            run_at: "document_start",
            world: "MAIN",
          },
        ],
      }),
      // Firefox-specific: browser_specific_settings
      ...(isFirefox && {
        browser_specific_settings: {
          gecko: {
            id: "pleno-audit@example.com",
            strict_min_version: "109.0",
          },
        },
      }),
      ...(!isMV2 && {
        storage: {
          managed_schema: "managed-schema.json",
        },
      }),
    };
  },
  vite: () => ({
    plugins: [],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "preact",
    },
    build: {
      target: "esnext",
      modulePreload: false,
      rollupOptions: {
        external: ["parquet-wasm"],
      },
    },
    define: {
      "import.meta.hot": "undefined",
      "__PLENO_DEV__": "true",
      "__DEBUG_PORT__": JSON.stringify(process.env.DEBUG_PORT || "9222"),
    },
    optimizeDeps: {
      include: [
        "@pleno-audit/csp",
        "@pleno-audit/detectors",
        "@pleno-audit/api",
        "@pleno-audit/extension-runtime",
        "@pleno-audit/parquet-storage",
      ],
      exclude: ["parquet-wasm"],
    },
  }),
});
