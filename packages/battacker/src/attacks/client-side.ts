import type { AttackResult, AttackTest } from "../types.js";

async function simulateXSSPayload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testElement = document.createElement("div");
    testElement.id = "battacker-xss-test";
    testElement.style.display = "none";
    document.body.appendChild(testElement);

    const injected = document.getElementById("battacker-xss-test");
    document.body.removeChild(testElement);

    const executionTime = performance.now() - startTime;

    if (injected) {
      return {
        blocked: false,
        executionTime,
        details: "XSS-like script injection successful",
      };
    }

    return {
      blocked: true,
      executionTime,
      details: "XSS injection was blocked",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Script injection blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDOMManipulation(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const forms = document.querySelectorAll("form");
    const inputs = document.querySelectorAll("input");

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `DOM access successful, found ${forms.length} forms and ${inputs.length} inputs`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `DOM manipulation blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCookieTheft(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const cookies = document.cookie;
    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: `Cookie access successful, found ${cookies.length} chars of cookie data`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Cookie access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const clientSideAttacks: AttackTest[] = [
  {
    id: "client-xss",
    name: "XSS Payload Injection",
    category: "client-side",
    description: "Attempts to inject and execute script in the current page",
    severity: "critical",
    simulate: simulateXSSPayload,
  },
  {
    id: "client-dom",
    name: "DOM Manipulation",
    category: "client-side",
    description: "Attempts to access and manipulate page DOM elements",
    severity: "medium",
    simulate: simulateDOMManipulation,
  },
  {
    id: "client-cookie",
    name: "Cookie Theft",
    category: "client-side",
    description: "Attempts to read cookies from the current page",
    severity: "high",
    simulate: simulateCookieTheft,
  },
];
