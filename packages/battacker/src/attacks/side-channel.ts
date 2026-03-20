import type { AttackResult, AttackTest } from "../types.js";

async function simulateCanvasFingerprinting(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Canvas 2D context not available",
      };
    }

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = "#069";
    ctx.fillText("BrowserFingerprint", 2, 15);

    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("🎨 Canvas Test", 4, 35);

    const dataUrl = canvas.toDataURL();
    const fingerprint = dataUrl.slice(-50);

    const executionTime = performance.now() - startTime;

    if (dataUrl && dataUrl.length > 100) {
      return {
        blocked: false,
        executionTime,
        details: `Canvas fingerprinting successful - hash: ${fingerprint}`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Canvas fingerprinting returned empty or blocked data",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Canvas fingerprinting blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePerformanceTimingAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const timingData: Record<string, number | string> = {};

    if (performance.timing) {
      const timing = performance.timing;
      timingData.navigationStart = timing.navigationStart;
      timingData.loadEventEnd = timing.loadEventEnd;
      timingData.domContentLoadedEventEnd = timing.domContentLoadedEventEnd;
      timingData.responseEnd = timing.responseEnd;
    }

    const entries = performance.getEntriesByType("navigation");
    if (entries.length > 0) {
      const navEntry = entries[0] as PerformanceNavigationTiming;
      timingData.navDuration = navEntry.duration;
      timingData.navDomComplete = navEntry.domComplete;
      timingData.navTransferSize = navEntry.transferSize;
    }

    const resourceEntries = performance.getEntriesByType("resource").slice(0, 5);
    timingData.resourceCount = resourceEntries.length;

    const perfWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
    if (perfWithMemory.memory) {
      timingData.usedJSHeapSize = perfWithMemory.memory.usedJSHeapSize;
      timingData.totalJSHeapSize = perfWithMemory.memory.totalJSHeapSize;
    }

    const executionTime = performance.now() - startTime;
    const collectedFields = Object.keys(timingData).length;

    if (collectedFields > 3) {
      return {
        blocked: false,
        executionTime,
        details: `Performance timing attack successful - collected ${collectedFields} timing metrics`,
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: `Limited performance data collected (${collectedFields} fields) - some APIs may be restricted`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Performance timing attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateBroadcastChannelLeak(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("BroadcastChannel" in window)) {
      return {
        blocked: false,
        executionTime: performance.now() - startTime,
        details: "BroadcastChannel API not available",
      };
    }

    const channelName = "battacker_exfil_channel";
    const senderChannel = new BroadcastChannel(channelName);
    const receiverChannel = new BroadcastChannel(channelName);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        senderChannel.close();
        receiverChannel.close();
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "BroadcastChannel communication timed out or blocked",
        });
      }, 2000);

      receiverChannel.onmessage = (event) => {
        clearTimeout(timeout);
        senderChannel.close();
        receiverChannel.close();

        if (event.data && event.data.type === "exfil") {
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `BroadcastChannel leak successful - cross-tab data sharing confirmed`,
          });
        } else {
          resolve({
            blocked: true,
            executionTime: performance.now() - startTime,
            details: "BroadcastChannel message received but data corrupted",
          });
        }
      };

      senderChannel.postMessage({
        type: "exfil",
        payload: {
          credentials: "stolen-from-another-tab",
          sessionId: "abc123",
          timestamp: Date.now(),
        },
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `BroadcastChannel leak blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSpectreTimingMitigation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Spectre Variant 1 (CVE-2017-5753) 緩和策の検証
    // 高精度タイマーが制限されているかを確認
    // 参照: Kocher et al., "Spectre Attacks: Exploiting Speculative Execution" (S&P 2019)

    const measurements: number[] = [];

    // performance.now() の精度を測定
    for (let i = 0; i < 100; i++) {
      const t1 = performance.now();
      const t2 = performance.now();
      measurements.push(t2 - t1);
    }

    // 精度の分析
    const nonZeroMeasurements = measurements.filter((m) => m > 0);
    const minResolution =
      nonZeroMeasurements.length > 0
        ? nonZeroMeasurements.reduce((a, b) => a < b ? a : b)
        : 0;

    const executionTime = performance.now() - startTime;

    // Chrome 67+ では 100μs 以上に制限
    // 5μs 以下の精度は Spectre 攻撃に悪用可能
    if (minResolution >= 0.1) {
      return {
        blocked: true,
        executionTime,
        details: `Spectre timing mitigation active - timer resolution ${minResolution.toFixed(3)}ms (≥100μs threshold)`,
      };
    } else if (minResolution >= 0.005) {
      return {
        blocked: false,
        executionTime,
        details: `Spectre timing partially mitigated - timer resolution ${minResolution.toFixed(3)}ms (5-100μs range)`,
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: `High-precision timer available - resolution ${minResolution.toFixed(6)}ms (Spectre-exploitable)`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Timer access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSharedArrayBufferAvailability(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // SharedArrayBuffer の可用性検証
    // COOP/COEP ヘッダーが必要（Spectre 緩和策）
    // 参照: https://web.dev/coop-coep/

    if (typeof SharedArrayBuffer === "undefined") {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details:
          "SharedArrayBuffer disabled - Cross-Origin Isolation not enabled (Spectre mitigation active)",
      };
    }

    // SharedArrayBuffer が利用可能な場合、COOP/COEP が設定されている
    const crossOriginIsolated =
      typeof (self as any).crossOriginIsolated !== "undefined"
        ? (self as any).crossOriginIsolated
        : false;

    const executionTime = performance.now() - startTime;

    if (crossOriginIsolated) {
      return {
        blocked: true,
        executionTime,
        details:
          "SharedArrayBuffer available with Cross-Origin Isolation (COOP/COEP headers present)",
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details:
          "SharedArrayBuffer available without Cross-Origin Isolation (legacy mode - potential Spectre risk)",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `SharedArrayBuffer check failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const sideChannelAttacks: AttackTest[] = [
  {
    id: "side-channel-canvas",
    name: "Canvas Fingerprinting",
    category: "side-channel",
    description:
      "Generates browser fingerprint via Canvas API rendering differences",
    severity: "medium",
    simulate: simulateCanvasFingerprinting,
  },
  {
    id: "side-channel-timing",
    name: "Performance Timing Attack",
    category: "side-channel",
    description: "Extracts sensitive timing information via Performance API",
    severity: "medium",
    simulate: simulatePerformanceTimingAttack,
  },
  {
    id: "side-channel-broadcast",
    name: "BroadcastChannel Leak",
    category: "side-channel",
    description:
      "Leaks data between browser tabs via BroadcastChannel API (same-origin only)",
    severity: "high",
    simulate: simulateBroadcastChannelLeak,
  },
  {
    id: "side-channel-spectre-mitigation",
    name: "Spectre Timing Mitigation Check",
    category: "side-channel",
    description:
      "Verifies browser Spectre mitigations (timer precision reduction) - CVE-2017-5753",
    severity: "critical",
    simulate: simulateSpectreTimingMitigation,
  },
  {
    id: "side-channel-sharedarraybuffer",
    name: "SharedArrayBuffer Isolation Check",
    category: "side-channel",
    description:
      "Checks Cross-Origin Isolation status for SharedArrayBuffer (COOP/COEP)",
    severity: "high",
    simulate: simulateSharedArrayBufferAvailability,
  },
];
