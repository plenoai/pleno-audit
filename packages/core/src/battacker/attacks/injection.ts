import type { AttackResult, AttackTest } from "../types.js";

async function simulateClipboardSilentRead(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!navigator.clipboard?.readText) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Clipboard read API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "Clipboard read permission pending - requires user interaction",
        });
      }, 2000);

      navigator.clipboard
        .readText()
        .then((text) => {
          clearTimeout(timeout);
          resolve({
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `Clipboard read successful - ${text.length} chars harvested (password/tokens?)`,
          });
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (
            error.name === "NotAllowedError" ||
            error.name === "SecurityError"
          ) {
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "Clipboard read blocked by browser/user",
            });
          } else {
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: `Clipboard read error: ${error.message}`,
            });
          }
        });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Clipboard read blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateRequestFullscreen(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const element = document.documentElement;

    if (!element.requestFullscreen && !(element as any).webkitRequestFullscreen) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Fullscreen API not available",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details:
            "Fullscreen request pending - attacker overlay could be displayed",
        });
      }, 2000);

      const exitListener = () => {
        clearTimeout(timeout);
        document.removeEventListener("fullscreenchange", exitListener);
        resolve({
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Fullscreen takeover successful - phishing overlay attack possible`,
        });
      };

      document.addEventListener("fullscreenchange", exitListener);

      const request =
        element.requestFullscreen?.() ||
        (element as any).webkitRequestFullscreen?.();

      if (request) {
        request
          .then(() => {
            // Exit fullscreen immediately
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
          })
          .catch((error) => {
            clearTimeout(timeout);
            document.removeEventListener("fullscreenchange", exitListener);

            if (
              error.name === "NotAllowedError" ||
              error.name === "SecurityError"
            ) {
              resolve({
                blocked: true,
                executionTime: performance.now() - startTime,
                details: "Fullscreen blocked by browser/user",
              });
            } else {
              resolve({
                blocked: true,
                executionTime: performance.now() - startTime,
                details: `Fullscreen request failed: ${error.message}`,
              });
            }
          });
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Fullscreen attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateInnerHTMLInjection(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const container = document.createElement("div");
    container.id = "battacker-injection-test";
    container.style.display = "none";
    document.body.appendChild(container);

    // Try to inject HTML
    const maliciousHTML =
      '<img src=x onerror="window.__battacker_xss_test__=true" /> <script>window.__battacker_xss_test__=true</script>';
    container.innerHTML = maliciousHTML;

    const hasScript = container.querySelector("script");
    const hasImg = container.querySelector("img[onerror]");

    document.body.removeChild(container);

    const executionTime = performance.now() - startTime;

    if (hasScript || hasImg) {
      return {
        blocked: false,
        executionTime,
        details: `innerHTML injection successful - dangerous elements persisted`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "innerHTML injection blocked - dangerous content stripped",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `innerHTML injection blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDynamicScriptExecution(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    // Try Function constructor
    try {
      const executeCode = new Function("return 'Function constructor works'");
      const result = executeCode();

      if (result === "Function constructor works") {
        return {
          blocked: false,
          executionTime: performance.now() - startTime,
          details: `Function constructor execution successful - arbitrary code execution possible`,
        };
      }
    } catch (funcError) {
      // Function constructor blocked, try eval
      try {
        eval("var testEval = 'eval works'");
        if (typeof (window as any).testEval !== "undefined") {
          return {
            blocked: false,
            executionTime: performance.now() - startTime,
            details: `eval() execution successful - arbitrary code execution possible`,
          };
        }
      } catch {
        // Both blocked
        return {
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "Dynamic script execution blocked - Function() and eval() both restricted",
        };
      }
    }

    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: "Dynamic script execution blocked",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Dynamic script execution blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const injectionAttacks: AttackTest[] = [
  {
    id: "injection-clipboard-read",
    name: "Silent Clipboard Read",
    category: "injection",
    description:
      "Silently reads clipboard contents for password/token harvesting",
    severity: "high",
    simulate: simulateClipboardSilentRead,
  },
  {
    id: "injection-fullscreen-phishing",
    name: "Fullscreen Phishing Overlay",
    category: "injection",
    description:
      "Hijacks fullscreen to display fake authentication/payment dialogs",
    severity: "critical",
    simulate: simulateRequestFullscreen,
  },
  {
    id: "injection-innerhtml",
    name: "innerHTML Malicious Injection",
    category: "injection",
    description:
      "Injects malicious HTML/scripts via innerHTML manipulation",
    severity: "high",
    simulate: simulateInnerHTMLInjection,
  },
  {
    id: "injection-dynamic-script",
    name: "Dynamic Script Execution",
    category: "injection",
    description:
      "Executes arbitrary JavaScript via Function constructor or eval()",
    severity: "critical",
    simulate: simulateDynamicScriptExecution,
  },
];
