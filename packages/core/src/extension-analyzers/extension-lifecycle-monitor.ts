/**
 * Extension Lifecycle Monitor
 *
 * 拡張機能のライフサイクルイベント（インストール/アンインストール/有効化/無効化）を監視。
 * cookie-monitorと同じコールバックパターンを採用。
 */

export type ExtensionLifecycleEventType =
  | "installed"
  | "uninstalled"
  | "enabled"
  | "disabled";

export interface ExtensionLifecycleEvent {
  type: ExtensionLifecycleEventType;
  extensionId: string;
  /** uninstalledイベントではundefined */
  info?: chrome.management.ExtensionInfo;
  timestamp: number;
}

export type ExtensionLifecycleCallback = (
  event: ExtensionLifecycleEvent,
) => void;

let listeners: ExtensionLifecycleCallback[] = [];
let isStarted = false;
let ownExtensionId = "";

function emit(
  type: ExtensionLifecycleEventType,
  extensionId: string,
  info?: chrome.management.ExtensionInfo,
): void {
  const event: ExtensionLifecycleEvent = {
    type,
    extensionId,
    info,
    timestamp: Date.now(),
  };
  for (const listener of listeners) {
    listener(event);
  }
}

function handleInstalled(info: chrome.management.ExtensionInfo): void {
  if (info.type !== "extension") return;
  if (info.id === ownExtensionId) return;
  emit("installed", info.id, info);
}

function handleUninstalled(extensionId: string): void {
  emit("uninstalled", extensionId);
}

function handleEnabled(info: chrome.management.ExtensionInfo): void {
  if (info.type !== "extension") return;
  if (info.id === ownExtensionId) return;
  emit("enabled", info.id, info);
}

function handleDisabled(info: chrome.management.ExtensionInfo): void {
  if (info.type !== "extension") return;
  if (info.id === ownExtensionId) return;
  emit("disabled", info.id, info);
}

/**
 * ライフサイクル監視を開始
 */
export function startExtensionLifecycleMonitor(selfExtensionId: string): void {
  if (isStarted) return;

  ownExtensionId = selfExtensionId;
  isStarted = true;

  chrome.management.onInstalled.addListener(handleInstalled);
  chrome.management.onUninstalled.addListener(handleUninstalled);
  chrome.management.onEnabled.addListener(handleEnabled);
  chrome.management.onDisabled.addListener(handleDisabled);
}

/**
 * ライフサイクル監視を停止
 */
export function stopExtensionLifecycleMonitor(): void {
  if (!isStarted) return;

  chrome.management.onInstalled.removeListener(handleInstalled);
  chrome.management.onUninstalled.removeListener(handleUninstalled);
  chrome.management.onEnabled.removeListener(handleEnabled);
  chrome.management.onDisabled.removeListener(handleDisabled);

  isStarted = false;
}

/**
 * ライフサイクルイベントを購読。解除関数を返す。
 */
export function onExtensionLifecycle(
  callback: ExtensionLifecycleCallback,
): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
