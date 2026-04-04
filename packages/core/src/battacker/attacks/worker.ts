import type { AttackResult, AttackTest } from "../types.js";

async function simulateSharedWorker(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // SharedWorker allows communication between multiple documents/tabs
    const worker = new SharedWorker(
      "data:application/javascript,self.onmessage = function(e) { self.port.postMessage({response: 'ack', data: e.data}); }",
      "battacker_shared"
    );

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "SharedWorker creation timed out (may be blocked)",
        });
      }, 2000);

      worker.port.onmessage = (_e) => {
        clearTimeout(timeout);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `SharedWorker communication successful - enables cross-tab persistence and coordination`,
        });
      };

      worker.port.addEventListener("error", (err: Event) => {
        clearTimeout(timeout);
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: `SharedWorker blocked: ${err instanceof ErrorEvent ? err.message : "Unknown error"}`,
        });
      });

      worker.port.start();
      worker.port.postMessage({ type: "test", timestamp: Date.now() });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `SharedWorker creation blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateServiceWorkerRegistration(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("serviceWorker" in navigator)) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Service Worker API not available",
      };
    }

    // Create a minimal service worker code
    const swCode = `
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', (e) => {
        if (e.request.url.includes('exfil')) {
          e.respondWith(new Response('intercepted'));
        }
      });
    `;

    const blob = new Blob([swCode], { type: "application/javascript" });
    const swUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(swUrl);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "Service Worker registration pending - requires user/domain context",
        });
      }, 2000);

      navigator.serviceWorker
        .register(swUrl, { scope: "/" })
        .then((registration) => {
          clearTimeout(timeout);
          registration.unregister();
          URL.revokeObjectURL(swUrl);

          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Service Worker registered - enables network interception and offline persistence`,
          });
        })
        .catch((error) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(swUrl);

          if (error.message.includes("Only secure origins are allowed")) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Service Worker blocked - https required",
            });
          } else {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: `Service Worker registration blocked: ${error.message}`,
            });
          }
        });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Service Worker attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWorkerSpawningChain(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const workerCode = `
      let level = 0;
      self.onmessage = function(e) {
        level = e.data.level || 0;
        if (level < 3) {
          const subWorkerCode = 'self.onmessage = function(e) { self.postMessage({level: e.data.level}); };';
          const blob = new Blob([subWorkerCode], {type: "application/javascript"});
          const url = URL.createObjectURL(blob);
          const w = new Worker(url);
          w.onmessage = (e) => self.postMessage({nested: true, level: e.data.level});
          w.postMessage({level: level + 1});
        } else {
          self.postMessage({maxDepthReached: true, level: level});
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "Worker spawning chain timed out - cascade may be blocked",
        });
      }, 2000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        const depth = e.data.level || 0;
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Worker spawning chain successful - nested depth ${depth} achieved (enables hidden command channels)`,
        });
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: `Worker spawning chain blocked: ${err.message}`,
        });
      };

      worker.postMessage({ level: 0 });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Worker spawning chain blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const workerAttacks: AttackTest[] = [
  {
    id: "worker-shared-worker",
    name: "SharedWorker Persistence",
    category: "worker",
    description:
      "Uses SharedWorker for persistent cross-tab data coordination and command execution",
    severity: "critical",
    simulate: simulateSharedWorker,
  },
  {
    id: "worker-service-worker-registration",
    name: "Service Worker Registration",
    category: "worker",
    description:
      "Registers Service Worker for network interception and offline attacks",
    severity: "critical",
    simulate: simulateServiceWorkerRegistration,
  },
  {
    id: "worker-spawning-chain",
    name: "Worker Spawning Chain",
    category: "worker",
    description:
      "Creates nested worker hierarchy for hidden command channels and resource exhaustion",
    severity: "high",
    simulate: simulateWorkerSpawningChain,
  },
];
