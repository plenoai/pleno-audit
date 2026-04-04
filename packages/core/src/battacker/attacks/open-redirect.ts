import type { AttackResult, AttackTest } from "../types.js";

/**
 * Test 1: Parameter-based open redirect via window.location
 * Attempts to redirect using common URL parameter names
 */
async function simulateParameterRedirect(): Promise<AttackResult> {
  const startTime = performance.now();
  try {
    // Build a URL with a redirect parameter pointing to an external domain
    const maliciousUrl = new URL(window.location.href);
    maliciousUrl.searchParams.set(
      "redirect",
      "https://evil.attacker.example.com/phish",
    );

    // Attempt to extract and follow the redirect parameter
    const redirectTarget = maliciousUrl.searchParams.get("redirect");
    if (!redirectTarget) {
      return {
        blocked: true,
        executionTime: performance.now() - startTime,
        details: "Redirect parameter was stripped or blocked",
      };
    }

    // Try creating an anchor element to simulate navigation
    const anchor = document.createElement("a");
    anchor.href = redirectTarget;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);

    // Check if the href was sanitized or blocked by CSP
    const wasBlocked = anchor.href !== redirectTarget;
    document.body.removeChild(anchor);

    return {
      blocked: wasBlocked,
      executionTime: performance.now() - startTime,
      details: wasBlocked
        ? "Redirect URL was sanitized or blocked"
        : "Parameter-based redirect URL was accepted without validation",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime,
      details: `Parameter redirect blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Test 2: JavaScript-based redirect via location.assign
 * Attempts to use window.location methods with external URLs
 */
async function simulateJSRedirect(): Promise<AttackResult> {
  const startTime = performance.now();
  try {
    // Create an iframe to test redirect behavior in isolation
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    document.body.appendChild(iframe);

    let blocked = true;
    try {
      // Attempt to set location in sandboxed iframe
      if (iframe.contentWindow) {
        // This should be blocked by sandbox
        iframe.contentWindow.location.href =
          "https://evil.attacker.example.com/steal";
        blocked = false;
      }
    } catch {
      blocked = true;
    }

    document.body.removeChild(iframe);

    return {
      blocked,
      executionTime: performance.now() - startTime,
      details: blocked
        ? "JavaScript redirect via iframe sandboxing was blocked"
        : "JavaScript redirect was not blocked by sandbox",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime,
      details: `JS redirect blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Test 3: Meta refresh redirect injection
 * Attempts to inject a meta refresh tag for redirect
 */
async function simulateMetaRefreshRedirect(): Promise<AttackResult> {
  const startTime = performance.now();
  try {
    const meta = document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = "0;url=https://evil.attacker.example.com/phish";
    document.head.appendChild(meta);

    // Check if meta tag was added successfully
    const injectedMeta = document.querySelector(
      'meta[http-equiv="refresh"]',
    );
    const wasInjected = injectedMeta !== null;

    // Clean up
    if (injectedMeta) {
      injectedMeta.remove();
    }

    return {
      blocked: !wasInjected,
      executionTime: performance.now() - startTime,
      details: wasInjected
        ? "Meta refresh tag injection succeeded - redirect possible"
        : "Meta refresh tag injection was blocked",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime,
      details: `Meta refresh redirect blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * Test 4: Form action redirect
 * Attempts to create a form that submits to an external URL
 */
async function simulateFormActionRedirect(): Promise<AttackResult> {
  const startTime = performance.now();
  try {
    const form = document.createElement("form");
    form.method = "GET";
    form.action = "https://evil.attacker.example.com/collect";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token";
    input.value = "sensitive-data-test";
    form.appendChild(input);

    document.body.appendChild(form);

    // Check if form action points to external domain
    const formAction = new URL(form.action, window.location.origin);
    const isExternal = formAction.hostname !== window.location.hostname;

    document.body.removeChild(form);

    return {
      blocked: !isExternal,
      executionTime: performance.now() - startTime,
      details: isExternal
        ? "Form action redirect to external domain was accepted"
        : "Form action was restricted to same-origin",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime,
      details: `Form action redirect blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const openRedirectAttacks: AttackTest[] = [
  {
    id: "open-redirect-parameter",
    name: "Parameter-Based Open Redirect",
    category: "phishing",
    description:
      "Tests if URL parameter-based redirects to external domains are possible",
    severity: "high",
    simulate: simulateParameterRedirect,
  },
  {
    id: "open-redirect-js-location",
    name: "JavaScript Location Redirect",
    category: "phishing",
    description:
      "Tests if JavaScript-based redirects via location methods are sandboxed",
    severity: "high",
    simulate: simulateJSRedirect,
  },
  {
    id: "open-redirect-meta-refresh",
    name: "Meta Refresh Redirect Injection",
    category: "phishing",
    description: "Tests if meta refresh tags can be injected for redirect",
    severity: "medium",
    simulate: simulateMetaRefreshRedirect,
  },
  {
    id: "open-redirect-form-action",
    name: "Form Action External Redirect",
    category: "phishing",
    description:
      "Tests if form actions can redirect to external domains",
    severity: "high",
    simulate: simulateFormActionRedirect,
  },
];
