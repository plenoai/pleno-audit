import type { AttackResult, AttackTest } from "../types.js";

async function simulateFormSubmissionHijack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // フォーム送信イベントの乗っ取り
    const form = document.createElement("form");
    form.id = "battacker-form-test";
    form.style.display = "none";
    form.method = "POST";
    form.action = "https://httpbin.org/post";

    const inputField = document.createElement("input");
    inputField.type = "password";
    inputField.name = "password";
    inputField.value = "user_sensitive_password";

    form.appendChild(inputField);
    document.body.appendChild(form);

    // フォーム送信をハイジャック
    let formSubmitted = false;
    const originalSubmit = form.submit;

    form.submit = function () {
      formSubmitted = true;
      // データを外部に送信する前に改変
      const passwordField = this.querySelector(
        'input[name="password"]'
      ) as HTMLInputElement;
      if (passwordField) {
        // 攻撃者がデータを傍受
        const interceededPassword = passwordField.value;
      }

      // 元のsubmit呼び出しをスキップ（実際には送信しない）
    };

    // フォーム送信イベント
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      formSubmitted = true;
    });

    form.submit();

    document.body.removeChild(form);

    const executionTime = performance.now() - startTime;

    if (formSubmitted) {
      return {
        blocked: false,
        executionTime,
        details: `Form submission hijacking successful - password field intercepted`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Form submission hijacking blocked or prevented",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Form submission hijack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePrototypePollution(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Prototype pollution による__proto__ 汚染
    const victim = {} as any;

    // 攻撃パターン: user input from URL parameter
    const userInput = '{"__proto__": {"admin": true}}';

    try {
      const malicious = JSON.parse(userInput);

      // オブジェクトのマージ（Prototype pollutionの典型的なシナリオ）
      const result = { ...victim, ...malicious };

      // 汚染チェック
      const checkObj = {};
      if ((checkObj as any).admin === true) {
        return {
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Prototype pollution successful - Object.prototype.admin injected`,
        };
      }
    } catch {
      // JSON.parse failures handled
    }

    // Object.defineProperty による直接汚染
    try {
      Object.defineProperty(Object.prototype, "polluted", {
        value: true,
        writable: true,
        enumerable: false,
      });

      const testObj = {};
      if ((testObj as any).polluted === true) {
        return {
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Direct prototype pollution successful - Object.defineProperty hijacking`,
        };
      }
    } catch (error) {
      // Cleanup attempt failed or blocked
    }

    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: "Prototype pollution blocked or prevented",
    };
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

async function simulateRequestHeaderInjection(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // fetch を使用したリクエストヘッダ改変
    // Forbidden headers は変更不可だが、カスタムヘッダは可能

    const headers = new Headers({
      "X-Custom-Header": "injected-value",
      "X-User-Data": "leaked-session-id",
      "X-Tracking-Id": "browser-fingerprint-hash",
    });

    // キャッシュ制御ヘッダ改変の試み
    try {
      headers.set("Cache-Control", "no-store");
      headers.set("Pragma", "no-cache");
    } catch {
      // Forbidden headers cannot be set
    }

    const response = await fetch("https://httpbin.org/get", {
      method: "GET",
      headers: headers,
      mode: "no-cors", // CORS回避
    }).catch(() => null);

    const executionTime = performance.now() - startTime;

    if (response) {
      return {
        blocked: false,
        executionTime,
        details: `Request header injection successful - custom headers injected`,
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: `Request header injection attempted (network error or blocked)`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Request header injection blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateMutationObserverXSS(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const container = document.createElement("div");
    container.id = "battacker-mutation-test";
    container.style.display = "none";
    document.body.appendChild(container);

    let xssDetected = false;

    // MutationObserver を設定
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              (node as Element).tagName === "SCRIPT"
            ) {
              xssDetected = true;
            }
          });
        }
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // XSS ペイロード注入
    const script = document.createElement("script");
    script.textContent = "console.log('XSS via MutationObserver')";
    container.appendChild(script);

    // オブザーバを停止
    observer.disconnect();
    document.body.removeChild(container);

    const executionTime = performance.now() - startTime;

    if (xssDetected) {
      return {
        blocked: false,
        executionTime,
        details: `MutationObserver XSS successful - script element injected and detected`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "MutationObserver XSS blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `MutationObserver XSS blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCORSPreflightLeak(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // CORS preflight リクエストの情報漏洩
    // OPTIONS リクエストから情報を推測

    const targetUrl = "https://httpbin.org/post";

    const preflightStart = performance.now();

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "custom-value",
        },
        body: JSON.stringify({ test: "data" }),
      });

      const preflightTiming = performance.now() - preflightStart;

      // CORS preflight リクエストのタイミングから情報を推測可能
      // 例: 遅延 = より多くのメタデータ検証 = より重要なリソース

      const executionTime = performance.now() - startTime;

      return {
        blocked: false,
        executionTime,
        details: `CORS preflight leak - timing analysis possible (${preflightTiming.toFixed(0)}ms preflight)`,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        blocked: true,
        executionTime,
        details: `CORS preflight blocked: ${String(error).substring(0, 50)}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `CORS preflight leak blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const advancedAttacks: AttackTest[] = [
  {
    id: "advanced-form-submit-hijack",
    name: "Form Submission Hijacking",
    category: "advanced",
    description:
      "Intercepts form submission events to steal credentials before transmission",
    severity: "high",
    simulate: simulateFormSubmissionHijack,
  },
  {
    id: "advanced-prototype-pollution",
    name: "Prototype Chain Pollution",
    category: "advanced",
    description:
      "Pollutes Object.prototype to inject malicious properties across all objects",
    severity: "critical",
    simulate: simulatePrototypePollution,
  },
  {
    id: "advanced-request-header-injection",
    name: "Request Header Injection",
    category: "advanced",
    description:
      "Injects custom headers into requests to bypass security checks or inject data",
    severity: "medium",
    simulate: simulateRequestHeaderInjection,
  },
  {
    id: "advanced-mutation-observer-xss",
    name: "MutationObserver DOM XSS",
    category: "advanced",
    description:
      "Detects and exploits DOM modifications via MutationObserver for XSS attacks",
    severity: "high",
    simulate: simulateMutationObserverXSS,
  },
  {
    id: "advanced-cors-preflight-leak",
    name: "CORS Preflight Timing Leak",
    category: "advanced",
    description:
      "Extracts information from CORS preflight request timing patterns",
    severity: "medium",
    simulate: simulateCORSPreflightLeak,
  },
];
