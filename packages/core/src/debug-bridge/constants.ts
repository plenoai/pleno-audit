declare const __DEBUG_PORT__: string;

export const DEBUG_PORT = typeof __DEBUG_PORT__ !== "undefined" ? __DEBUG_PORT__ : "9222";
export const DEBUG_SERVER_URL = `ws://localhost:${DEBUG_PORT}/debug`;

export const RECONNECT_INTERVAL = 5000;
export const LOG_BUFFER_SIZE = 100;
