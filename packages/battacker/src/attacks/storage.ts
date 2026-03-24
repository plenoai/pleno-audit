import type { AttackResult, AttackTest } from "../types.js";

async function simulateLocalStorageExfil(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testKey = `battacker_exfil_${Date.now()}`;
    const testValue = JSON.stringify({
      type: "exfiltrated_data",
      userEmail: "user@example.com",
      sessionToken: "xyz789abc123",
      timestamp: Date.now(),
      data: Array(1000)
        .fill("sensitive_data_payload")
        .join("|"),
    });

    // Store sensitive data
    localStorage.setItem(testKey, testValue);

    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    const executionTime = performance.now() - startTime;

    if (retrieved === testValue) {
      return {
        blocked: false,
        executionTime,
        details: `localStorage exfiltration successful - ${testValue.length} bytes persisted`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "localStorage write succeeded but retrieval failed",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `localStorage exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSessionStorageExfil(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testKey = `battacker_session_${Date.now()}`;
    const testValue = JSON.stringify({
      type: "session_exfil",
      credentials: "username:password_hash",
      sessionId: "abc123xyz",
      csrfToken: "csrf_token_value",
      timestamp: Date.now(),
    });

    sessionStorage.setItem(testKey, testValue);

    const retrieved = sessionStorage.getItem(testKey);
    sessionStorage.removeItem(testKey);

    const executionTime = performance.now() - startTime;

    if (retrieved === testValue) {
      return {
        blocked: false,
        executionTime,
        details: `sessionStorage exfiltration successful - ${testValue.length} bytes persisted`,
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "sessionStorage write succeeded but retrieval failed",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `sessionStorage exfiltration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateStorageEventSpying(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testKey = `battacker_spy_${Date.now()}`;
    let eventCaught = false;

    const listener = (e: StorageEvent) => {
      if (e.key === testKey) {
        eventCaught = true;
      }
    };

    window.addEventListener("storage", listener);

    try {
      localStorage.setItem(testKey, "test_value");

      await new Promise((resolve) => setTimeout(resolve, 100));

      localStorage.removeItem(testKey);
    } finally {
      window.removeEventListener("storage", listener);
    }

    const executionTime = performance.now() - startTime;

    if (eventCaught) {
      return {
        blocked: false,
        executionTime,
        details:
          "Storage event spying successful - cross-tab data leakage detected",
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details:
          "Storage event listener set but no external tab changes (single-tab test)",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Storage event spying blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateStorageQuotaExhaustion(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const testKey = "battacker_quota_test";
    let bytesStored = 0;
    let quotaExhausted = false;

    try {
      // Try to store increasingly large data until quota exceeded
      for (let i = 0; i < 100; i++) {
        const largeData = "x".repeat(1024 * 100); // 100KB chunks
        const key = `${testKey}_${i}`;

        try {
          localStorage.setItem(key, largeData);
          bytesStored += largeData.length;
        } catch (e) {
          if (
            e instanceof Error &&
            (e.name === "QuotaExceededError" ||
              e.message.includes("quota"))
          ) {
            quotaExhausted = true;
            break;
          }
          throw e;
        }
      }

      // Cleanup
      for (let i = 0; i < 100; i++) {
        try {
          localStorage.removeItem(`${testKey}_${i}`);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Quota test completed
    }

    const executionTime = performance.now() - startTime;

    if (quotaExhausted) {
      return {
        blocked: false,
        executionTime,
        details: `Storage quota attack successful - exhausted after ${bytesStored} bytes`,
      };
    } else {
      return {
        blocked: false,
        executionTime,
        details: `Storage quota exploration - stored ${bytesStored} bytes before test limit`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Storage quota attack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const storageAttacks: AttackTest[] = [
  {
    id: "storage-localstorage-exfil",
    name: "localStorage Exfiltration",
    category: "storage",
    description:
      "Exfiltrates sensitive data via localStorage (persists across sessions)",
    severity: "high",
    simulate: simulateLocalStorageExfil,
  },
  {
    id: "storage-sessionstorage-exfil",
    name: "sessionStorage Exfiltration",
    category: "storage",
    description:
      "Exfiltrates session data via sessionStorage (cross-document access)",
    severity: "high",
    simulate: simulateSessionStorageExfil,
  },
  {
    id: "storage-event-spy",
    name: "Storage Event Spying",
    category: "storage",
    description:
      "Spies on storage events to intercept cross-tab data sharing",
    severity: "medium",
    simulate: simulateStorageEventSpying,
  },
  {
    id: "storage-quota-exhaustion",
    name: "Storage Quota Exhaustion",
    category: "storage",
    description:
      "Exhausts storage quota as denial-of-service or side-channel attack",
    severity: "medium",
    simulate: simulateStorageQuotaExhaustion,
  },
];
