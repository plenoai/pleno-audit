import type { AttackResult, AttackTest } from "../types.js";

async function simulateCPUMining(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    let hashCount = 0;
    const testDuration = 500;
    const targetDifficulty = 4;

    const simpleHash = (data: string): string => {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash | 0;
      }
      return Math.abs(hash).toString(16).padStart(8, "0");
    };

    const mineStart = performance.now();
    let nonce = 0;
    let foundValidHash = false;

    while (performance.now() - mineStart < testDuration) {
      const data = `block:${Date.now()}:nonce:${nonce}`;
      const hash = simpleHash(data);
      hashCount++;
      nonce++;

      if (hash.startsWith("0".repeat(targetDifficulty))) {
        foundValidHash = true;
      }
    }

    const executionTime = performance.now() - startTime;
    const hashRate = Math.round((hashCount / testDuration) * 1000);

    return {
      blocked: false,
      executionTime,
      details: `CPU mining simulation completed - ${hashRate} h/s (${hashCount} hashes in ${testDuration}ms)${foundValidHash ? ", found valid hash!" : ""}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `CPU mining blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWebWorkerMining(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const workerCode = `
      let running = true;

      function simpleHash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          const char = data.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash | 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
      }

      self.onmessage = function(e) {
        if (e.data.command === 'start') {
          const { duration, difficulty } = e.data;
          let hashCount = 0;
          let nonce = 0;
          const mineStart = Date.now();

          while (Date.now() - mineStart < duration && running) {
            const data = 'block:' + Date.now() + ':nonce:' + nonce;
            const hash = simpleHash(data);
            hashCount++;
            nonce++;

            if (hashCount % 10000 === 0) {
              self.postMessage({ type: 'progress', hashCount });
            }
          }

          self.postMessage({
            type: 'complete',
            hashCount,
            duration: Date.now() - mineStart,
            hashRate: Math.round((hashCount / duration) * 1000)
          });
        } else if (e.data.command === 'stop') {
          running = false;
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.postMessage({ command: "stop" });
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "Web Worker mining timed out - worker may be throttled",
        });
      }, 3000);

      worker.onmessage = (e) => {
        if (e.data.type === "complete") {
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Web Worker mining successful - ${e.data.hashRate} h/s (${e.data.hashCount} hashes)`,
          });
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: `Web Worker mining blocked: ${err.message}`,
          error: err.message,
        });
      };

      worker.postMessage({
        command: "start",
        duration: 500,
        difficulty: 4,
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Web Worker mining blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateMultiWorkerMining(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const workerCount = navigator.hardwareConcurrency || 4;

    const workerCode = `
      function simpleHash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          const char = data.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash | 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
      }

      self.onmessage = function(e) {
        const { duration, workerId } = e.data;
        let hashCount = 0;
        let nonce = workerId * 1000000;
        const mineStart = Date.now();

        while (Date.now() - mineStart < duration) {
          const data = 'block:' + Date.now() + ':worker:' + workerId + ':nonce:' + nonce;
          simpleHash(data);
          hashCount++;
          nonce++;
        }

        self.postMessage({
          workerId,
          hashCount,
          hashRate: Math.round((hashCount / duration) * 1000)
        });
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const workers: Worker[] = [];
    const results: Array<{ workerId: number; hashCount: number; hashRate: number }> = [];

    for (let i = 0; i < workerCount; i++) {
      workers.push(new Worker(workerUrl));
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        workers.forEach((w) => w.terminate());
        URL.revokeObjectURL(workerUrl);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Multi-worker mining timed out - spawned ${workerCount} workers`,
        });
      }, 3000);

      workers.forEach((worker, index) => {
        worker.onmessage = (e) => {
          results.push(e.data);

          if (results.length === workerCount) {
            clearTimeout(timeout);
            workers.forEach((w) => w.terminate());
            URL.revokeObjectURL(workerUrl);

            const totalHashes = results.reduce(
              (sum, r) => sum + r.hashCount,
              0
            );
            const totalHashRate = results.reduce(
              (sum, r) => sum + r.hashRate,
              0
            );

            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Multi-worker mining successful - ${workerCount} workers, ${totalHashRate} h/s combined (${totalHashes} total hashes)`,
            });
          }
        };

        worker.onerror = () => {
          clearTimeout(timeout);
          workers.forEach((w) => w.terminate());
          URL.revokeObjectURL(workerUrl);
          resolve({
            blocked: true,
            executionTime: performance.now() - startTime,
            details: "Multi-worker mining blocked",
          });
        };

        worker.postMessage({
          duration: 500,
          workerId: index,
        });
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Multi-worker mining blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWasmMiningCheck(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const wasmSupported = typeof WebAssembly !== "undefined";

    if (!wasmSupported) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "WebAssembly not supported - WASM mining would fail",
      };
    }

    const wasmBinary = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
      0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01,
      0x03, 0x61, 0x64, 0x64, 0x00, 0x00, 0x0a, 0x09, 0x01, 0x07, 0x00, 0x20,
      0x00, 0x20, 0x01, 0x6a, 0x0b,
    ]);

    const module = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(module);

    const add = instance.exports.add as (a: number, b: number) => number;
    let hashCount = 0;
    const testDuration = 100;
    const testStart = performance.now();

    while (performance.now() - testStart < testDuration) {
      for (let i = 0; i < 1000; i++) {
        add(hashCount, i);
        hashCount++;
      }
    }

    const executionTime = performance.now() - startTime;
    const opsRate = Math.round((hashCount / testDuration) * 1000);

    return {
      blocked: false,
      executionTime,
      details: `WASM mining capability confirmed - ${opsRate} ops/s (WebAssembly execution successful)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `WASM mining check blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const cryptojackingAttacks: AttackTest[] = [
  {
    id: "cryptojacking-cpu",
    name: "CPU Mining Simulation",
    category: "cryptojacking",
    description:
      "Simulates cryptocurrency mining using main thread CPU resources",
    severity: "high",
    simulate: simulateCPUMining,
  },
  {
    id: "cryptojacking-worker",
    name: "Web Worker Mining",
    category: "cryptojacking",
    description:
      "Uses Web Worker for background mining (bypasses main thread detection)",
    severity: "critical",
    simulate: simulateWebWorkerMining,
  },
  {
    id: "cryptojacking-multi-worker",
    name: "Multi-Worker Mining Pool",
    category: "cryptojacking",
    description:
      "Spawns multiple Web Workers to maximize mining throughput across CPU cores",
    severity: "critical",
    simulate: simulateMultiWorkerMining,
  },
  {
    id: "cryptojacking-wasm",
    name: "WASM Mining Capability",
    category: "cryptojacking",
    description:
      "Tests WebAssembly execution capability for high-performance mining",
    severity: "high",
    simulate: simulateWasmMiningCheck,
  },
];
