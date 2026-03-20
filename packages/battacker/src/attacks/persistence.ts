import type { AttackResult, AttackTest } from "../types.js";

async function simulateIndexedDBStash(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const dbName = "battacker_stash_test";
    const storeName = "exfil_data";

    const request = indexedDB.open(dbName, 1);

    return new Promise((resolve) => {
      request.onerror = () => {
        resolve({
          blocked: true,
          executionTime: performance.now() - startTime,
          details: "IndexedDB access blocked",
          error: request.error?.message,
        });
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          const transaction = db.transaction([storeName], "readwrite");
          const store = transaction.objectStore(storeName);

          const sensitiveData = {
            id: Date.now(),
            type: "stashed_credentials",
            email: "victim@example.com",
            password: "hashed_password_123",
            cookies: "session=abc123; auth=xyz789",
            timestamp: Date.now(),
          };

          const addRequest = store.add(sensitiveData);

          addRequest.onsuccess = () => {
            db.close();
            indexedDB.deleteDatabase(dbName);
            resolve({
              blocked: false,
              executionTime: performance.now() - startTime,
              details: "IndexedDB data stash successful - sensitive data persisted",
            });
          };

          addRequest.onerror = () => {
            db.close();
            indexedDB.deleteDatabase(dbName);
            resolve({
              blocked: true,
              executionTime: performance.now() - startTime,
              details: "IndexedDB write blocked",
              error: addRequest.error?.message,
            });
          };
        } catch (error) {
          db.close();
          indexedDB.deleteDatabase(dbName);
          const errorMessage = error instanceof Error ? error.message : String(error);
          resolve({
            blocked: true,
            executionTime: performance.now() - startTime,
            details: `IndexedDB operation blocked: ${errorMessage}`,
            error: errorMessage,
          });
        }
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `IndexedDB stash blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateCacheAPIAbuse(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    if (!("caches" in window)) {
      return {
        blocked: false,
        executionTime: performance.now() - startTime,
        details: "Cache API not available in this context",
      };
    }

    const cacheName = "battacker-exfil-cache";
    const cache = await caches.open(cacheName);

    const exfilData = {
      type: "cached_exfil",
      data: "sensitive-user-data-cached-for-later",
      timestamp: Date.now(),
    };

    const fakeUrl = "https://attacker.local/exfil-data.json";
    const response = new Response(JSON.stringify(exfilData), {
      headers: { "Content-Type": "application/json" },
    });

    await cache.put(fakeUrl, response);

    const cached = await cache.match(fakeUrl);
    await caches.delete(cacheName);

    const executionTime = performance.now() - startTime;

    if (cached) {
      return {
        blocked: false,
        executionTime,
        details: "Cache API abuse successful - data persisted and retrieved from cache",
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "Cache API write succeeded but retrieval failed",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `Cache API abuse blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateHistoryStateExfil(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const sensitivePayload = {
      type: "history_exfil",
      credentials: "username:password",
      sessionToken: "abc123xyz",
      timestamp: Date.now(),
    };

    const originalState = history.state;
    const originalUrl = location.href;

    history.replaceState(sensitivePayload, "", location.href);

    const retrievedState = history.state;

    history.replaceState(originalState, "", originalUrl);

    const executionTime = performance.now() - startTime;

    if (retrievedState && retrievedState.type === "history_exfil") {
      return {
        blocked: false,
        executionTime,
        details: "History state exfiltration successful - data hidden in browser history",
      };
    } else {
      return {
        blocked: true,
        executionTime,
        details: "History state manipulation detected or blocked",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      blocked: true,
      executionTime: performance.now() - startTime,
      details: `History state exfil blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const persistenceAttacks: AttackTest[] = [
  {
    id: "persistence-indexeddb",
    name: "IndexedDB Data Stash",
    category: "persistence",
    description: "Stores sensitive data in IndexedDB for later exfiltration (bypasses network monitoring)",
    severity: "high",
    simulate: simulateIndexedDBStash,
  },
  {
    id: "persistence-cache-api",
    name: "Cache API Abuse",
    category: "persistence",
    description: "Abuses Cache Storage API to persist exfiltration data",
    severity: "medium",
    simulate: simulateCacheAPIAbuse,
  },
  {
    id: "persistence-history",
    name: "History State Exfil",
    category: "persistence",
    description: "Hides sensitive data in browser history state for later retrieval",
    severity: "low",
    simulate: simulateHistoryStateExfil,
  },
];
