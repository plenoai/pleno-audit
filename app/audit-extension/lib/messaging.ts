/**
 * Messaging utilities with Service Worker readiness check
 *
 * Always use sendMessage() instead of chrome.runtime.sendMessage().
 * Direct calls may return undefined if Service Worker is not fully initialized.
 */

let serviceWorkerReady = false;
let readyPromise: Promise<void> | null = null;

const PING_MAX_ATTEMPTS = 3;
const PING_DELAY_MS = 50;

async function ensureServiceWorkerReady(): Promise<void> {
  if (serviceWorkerReady) return;

  if (!readyPromise) {
    readyPromise = (async () => {
      for (let attempt = 0; attempt < PING_MAX_ATTEMPTS; attempt++) {
        const response = await chrome.runtime.sendMessage({ type: "PING" });
        if (response === "PONG") {
          serviceWorkerReady = true;
          return;
        }
        if (attempt < PING_MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, PING_DELAY_MS));
        }
      }
      throw new Error("Service Worker not ready after PING attempts");
    })();
  }

  return readyPromise;
}

export async function sendMessage<T>(
  message: { type: string; data?: unknown }
): Promise<T> {
  await ensureServiceWorkerReady();
  const response = await chrome.runtime.sendMessage(message);

  if (response === undefined) {
    throw new Error(`No response for message type: ${message.type}`);
  }

  return response as T;
}
