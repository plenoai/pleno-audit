import type {
  NetworkRequestRecord,
} from "@libztbs/extension-runtime";
import { createNetworkMonitor } from "./network-monitor/index.js";
import type { ExtensionNetworkContext } from "./types.js";

/** バッファの最大サイズ */
const MAX_REQUEST_BUFFER_SIZE = 5000;

export async function initExtensionMonitor(context: ExtensionNetworkContext): Promise<void> {
  if (context.state.extensionMonitor) {
    context.deps.logger.debug("Extension monitor already started");
    return;
  }

  context.state.extensionMonitor = createNetworkMonitor(context.deps.getRuntimeId());

  context.state.extensionMonitor.onRequest((record) => {
    const networkRecord = record as NetworkRequestRecord;

    // インメモリバッファに保持（リングバッファ方式）
    context.state.requestBuffer.push(networkRecord);
    if (context.state.requestBuffer.length > MAX_REQUEST_BUFFER_SIZE) {
      context.state.requestBuffer = context.state.requestBuffer.slice(-MAX_REQUEST_BUFFER_SIZE);
    }

    // 通信先集約等の外部コールバック
    context.deps.onNetworkRequest?.(networkRecord);

  });

  await context.state.extensionMonitor.start();
  context.deps.logger.info("Extension monitor started");
}

export async function stopExtensionMonitor(context: ExtensionNetworkContext): Promise<void> {
  if (!context.state.extensionMonitor) return;
  await context.state.extensionMonitor.stop();
  context.state.extensionMonitor = null;
}

export async function checkDNRMatchesHandler(context: ExtensionNetworkContext): Promise<void> {
  if (!context.state.extensionMonitor) {
    context.deps.logger.debug("DNR check skipped: monitor not initialized yet");
    return;
  }
  try {
    await context.state.extensionMonitor.checkDNRMatches();
  } catch (error) {
    context.deps.logger.debug("DNR match check failed:", error);
  }
}

export function getKnownExtensions(
  context: ExtensionNetworkContext
): Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }> {
  if (!context.state.extensionMonitor) return {};
  const map = context.state.extensionMonitor.getKnownExtensions();
  return Object.fromEntries(map);
}
