import type { AttackResult, AttackTest } from "../types.js";

async function simulateSandboxEscapeViaProxyObject(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Proxy オブジェクトを利用した sandbox escape の試行
    // sandbox 属性を回避してグローバルスコープアクセス

    const sandboxIframe = document.createElement("iframe");
    sandboxIframe.id = "proxy-escape-test";
    sandboxIframe.style.display = "none";
    sandboxIframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    let escapedContext = false;

    document.body.appendChild(sandboxIframe);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        document.body.removeChild(sandboxIframe);
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "Sandbox escape via Proxy timeout",
        });
      }, 2000);

      const messageHandler = (event: MessageEvent) => {
        if (event.source === sandboxIframe.contentWindow) {
          clearTimeout(timeout);
          window.removeEventListener("message", messageHandler);

          if (event.data.type === "escape_success") {
            escapedContext = true;
          }

          document.body.removeChild(sandboxIframe);

          const executionTime = performance.now() - startTime;

          if (escapedContext) {
            resolve({
              blocked: false,
              executionTime,
              details: `Sandbox escape via Proxy successful - global context accessed`,
            });
          } else {
            resolve({
              blocked: true,
              executionTime,
              details: "Sandbox isolation maintained",
            });
          }
        }
      };

      window.addEventListener("message", messageHandler);

      // Sandboxed iframe でのコード実行
      const escapeScript = `
        try {
          // Proxy を利用してグローバルアクセス試行
          const handler = {
            get: (target, prop) => {
              if (prop === 'unsafeWindow') {
                return window;
              }
              return target[prop];
            },
            set: (target, prop, value) => {
              if (prop === 'bypass') {
                // 親ウィンドウの属性を改変
                window.opener = window.parent;
                return true;
              }
              return true;
            }
          };

          const proxy = new Proxy({}, handler);

          // プロキシを通じたアクセス
          if (proxy.unsafeWindow) {
            window.parent.postMessage({
              type: 'escape_success',
              data: 'proxy_bypass'
            }, '*');
          }
        } catch (e) {
          // Proxy不可
        }
      `;

      sandboxIframe.srcdoc = `<script>${escapeScript}</script>`;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Sandbox escape blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePrototypePollutionChain(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Prototype pollution の連鎖攻撃
    // Object.prototype を段階的に改変してスコープを拡張

    let pollutionSuccess = false;
    const pollutedProperties: string[] = [];

    // ステップ1: Object.prototype の基本的な改変
    try {
      const obj: Record<string, unknown> = {};

      // プロトタイプ改変（通常はできない）
      Object.defineProperty(Object.prototype, "polluted", {
        value: true,
        writable: true,
        enumerable: false,
      });

      // 別のオブジェクトで確認
      const testObj: Record<string, unknown> = {};
      if (testObj.polluted === true) {
        pollutionSuccess = true;
        pollutedProperties.push("polluted");
      }

      // クリーンアップ
      delete (Object.prototype as Record<string, unknown>).polluted;
    } catch (e) {
      // Prototype改変ブロック
    }

    // ステップ2: Constructor プロトタイプ汚染
    try {
      const target: Record<string, unknown> = {};
      const payload = {
        constructor: {
          prototype: {
            malicious: "payload",
          },
        },
      };

      // Deep merge シミュレーション
      function merge(dst: Record<string, unknown>, src: Record<string, unknown>) {
        for (const key in src) {
          if (typeof src[key] === "object" && src[key] !== null) {
            dst[key] = dst[key] || {};
            merge(dst[key] as Record<string, unknown>, src[key] as Record<string, unknown>);
          } else {
            dst[key] = src[key];
          }
        }
      }

      merge(target, payload as Record<string, unknown>);

      // 汚染の確認
      const newObj: Record<string, unknown> = {};
      if (newObj.malicious === "payload") {
        pollutionSuccess = true;
        pollutedProperties.push("constructor");
      }
    } catch (e) {
      // Merge ブロック
    }

    // ステップ3: __proto__ を通じた汚染
    try {
      const obj = JSON.parse('{}') as Record<string, unknown>;
      const proto = Object.getPrototypeOf(obj);

      // __proto__ アクセス
      Object.setPrototypeOf(obj, { ...proto, isAdmin: true });

      const checkObj: Record<string, unknown> = {};
      if (checkObj.isAdmin === true) {
        pollutionSuccess = true;
        pollutedProperties.push("__proto__");
      }

      // クリーンアップ
      delete (Object.prototype as Record<string, unknown>).isAdmin;
    } catch (e) {
      // __proto__ アクセスブロック
    }

    const executionTime = performance.now() - startTime;

    if (pollutionSuccess && pollutedProperties.length > 0) {
      return {
        blocked: false,
        executionTime,
        details: `Prototype pollution chain successful - ${pollutedProperties.join(", ")} polluted (privilege escalation possible)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Prototype pollution chain blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Prototype pollution blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateServiceWorkerCacheBypass(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Service Worker キャッシュのバイパス
    // 悪質なSW による応答インターセプト

    if (!("serviceWorker" in navigator)) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Service Worker not available",
      };
    }

    let swRegistrationFound = false;

    // Service Worker 登録を列挙
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length > 0) {
      swRegistrationFound = true;

      // 最初の登録にアクセス
      const reg = registrations[0];

      try {
        // アクティブな SW を取得
        if (reg.active) {
          // SW のスコープ内でのキャッシュ操作を検知

          // メッセージを送信してキャッシュ改変を試行
          reg.active.postMessage({
            type: "cache_poison",
            urls: [
              "https://api.example.com/user",
              "https://api.example.com/admin",
            ],
            responses: [
              {
                type: "admin",
                data: JSON.stringify({ role: "admin", permissions: "*" }),
              },
            ],
          });
        }
      } catch (e) {
        // SW 通信ブロック
      }
    }

    const executionTime = performance.now() - startTime;

    if (swRegistrationFound) {
      return {
        blocked: false,
        executionTime,
        details: `Service Worker cache bypass successful - ${registrations.length} registrations found (cache poisoning possible)`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "No active Service Workers found",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Service Worker cache bypass blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const sandboxEscapeAttacks: AttackTest[] = [
  {
    id: "sandbox-escape-proxy-object",
    name: "Sandbox Escape via Proxy Object",
    category: "advanced",
    description:
      "Attempts to escape iframe sandbox using Proxy objects to access global context",
    severity: "critical",
    simulate: simulateSandboxEscapeViaProxyObject,
  },
  {
    id: "sandbox-escape-prototype-pollution",
    name: "Prototype Pollution Chain Attack",
    category: "advanced",
    description:
      "Chains prototype pollution via Object.prototype, constructor, and __proto__",
    severity: "critical",
    simulate: simulatePrototypePollutionChain,
  },
  {
    id: "sandbox-escape-service-worker",
    name: "Service Worker Cache Bypass",
    category: "covert",
    description:
      "Poisons Service Worker cache to intercept and modify API responses",
    severity: "critical",
    simulate: simulateServiceWorkerCacheBypass,
  },
];
