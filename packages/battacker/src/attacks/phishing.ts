import type { AttackResult, AttackTest } from "../types.js";

async function simulateClipboardHijack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const maliciousContent = "malicious-crypto-address-1234567890";
    await navigator.clipboard.writeText(maliciousContent);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      executionTime,
      details: "Clipboard hijack successful - content replaced",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Clipboard hijack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCredentialAPIHarvest(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("credentials" in navigator)) {
      return {
        blocked: false,
        executionTime: performance.now() - startTime,
        details: "Credential Management API not available (browser may not support it)",
      };
    }

    const credential = await navigator.credentials.get({
      password: true,
      mediation: "silent",
    } as CredentialRequestOptions);

    const executionTime = performance.now() - startTime;

    if (credential) {
      return {
        blocked: false,
        executionTime,
        details: `Credential API harvest successful: retrieved ${credential.type} credential`,
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: "Credential API accessed but no stored credentials found",
      };
    }
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Credential API harvest blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateNotificationPhishing(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("Notification" in window)) {
      return {
        blocked: false,
        executionTime: performance.now() - startTime,
        details: "Notification API not available",
      };
    }

    const permission = await Notification.requestPermission();
    const executionTime = performance.now() - startTime;

    if (permission === "granted") {
      const notification = new Notification("Security Alert", {
        body: "Your session has expired. Click to re-authenticate.",
        icon: "https://example.com/fake-security-icon.png",
        tag: "phishing-test",
      });

      setTimeout(() => notification.close(), 100);

      return {
        blocked: false,
        executionTime,
        details: "Notification phishing successful - fake security alert displayed",
      };
    } else if (permission === "denied") {
      return {
        blocked: true,
        executionTime,
        details: "Notification permission denied by user/browser",
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: "Notification permission in default state (not yet granted)",
      };
    }
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      executionTime,
      details: `Notification phishing blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const phishingAttacks: AttackTest[] = [
  {
    id: "phishing-clipboard",
    name: "Clipboard Hijacking",
    category: "phishing",
    description: "Attempts to replace clipboard content with malicious data",
    severity: "high",
    simulate: simulateClipboardHijack,
  },
  {
    id: "phishing-credential-api",
    name: "Credential API Harvest",
    category: "phishing",
    description: "Attempts to silently harvest stored credentials via Credential Management API",
    severity: "high",
    simulate: simulateCredentialAPIHarvest,
  },
  {
    id: "phishing-notification",
    name: "Notification Phishing",
    category: "phishing",
    description: "Displays fake security notification to lure user into re-authentication",
    severity: "medium",
    simulate: simulateNotificationPhishing,
  },
];
