/**
 * Network Monitor - Extension Tracker
 *
 * インストール済み拡張機能のリスト管理
 */

import { createLogger } from "../../extension-runtime/index.js";
import { state } from "./state.js";
import type { ExtensionInfo } from "./types.js";

const logger = createLogger("network-monitor");

/**
 * 拡張機能リストを更新
 */
export async function refreshExtensionList(): Promise<void> {
  try {
    const extensions = await chrome.management.getAll();
    state.knownExtensions.clear();
    for (const extension of extensions) {
      if (extension.type === "extension") {
        state.knownExtensions.set(extension.id, {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: extension.enabled,
          icons: extension.icons,
        });
      }
    }
    logger.debug(`Extension list refreshed: ${state.knownExtensions.size} extensions`);
  } catch (error) {
    logger.warn("Failed to get extension list:", error);
  }
}

/**
 * 既知の拡張機能マップを取得
 */
export function getKnownExtensions(): Map<string, ExtensionInfo> {
  return state.knownExtensions;
}
