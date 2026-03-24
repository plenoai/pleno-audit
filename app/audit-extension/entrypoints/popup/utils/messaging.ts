/**
 * Popup messaging utilities with Service Worker readiness check
 *
 * IMPORTANT: Always use sendMessage() instead of chrome.runtime.sendMessage() in popup.
 * Direct calls may return undefined if Service Worker is not fully initialized.
 *
 * @example
 * // Bad - may return undefined
 * const data = await chrome.runtime.sendMessage({ type: "GET_DATA" });
 *
 * // Good - ensures Service Worker is ready first
 * const data = await sendMessage<DataType>({ type: "GET_DATA" });
 */

let serviceWorkerReady = false;
let readyPromise: Promise<void> | null = null;

const PING_MAX_ATTEMPTS = 3;
const PING_DELAY_MS = 50;

/**
 * Ensures Service Worker is ready before sending messages.
 * Only checks once per popup session. PING uses retry to handle startup timing.
 */
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

/**
 * Send a message to the background script.
 * Ensures Service Worker is ready before sending.
 */
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
