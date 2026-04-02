/**
 * @fileoverview WebSocket Detection Hooks
 *
 * WebSocket connections are common in legitimate apps (chat, real-time dashboards,
 * collaborative editing). Alerting on every connection creates excessive false positives.
 * This hook is intentionally a no-op to avoid noise.
 * Real C2 detection should be done at the network layer (DNR/webRequest).
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type SharedHookUtils } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initWebSocketHooks(_emitSecurityEvent: SharedHookUtils["emitSecurityEvent"]): void {
  // Intentionally empty - WebSocket monitoring moved to network layer
  // to avoid false positives from legitimate real-time applications.
}
