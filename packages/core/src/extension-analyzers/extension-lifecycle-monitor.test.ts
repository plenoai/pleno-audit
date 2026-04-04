import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startExtensionLifecycleMonitor,
  stopExtensionLifecycleMonitor,
  onExtensionLifecycle,
  type ExtensionLifecycleEvent,
} from "./extension-lifecycle-monitor.js";

const installedListeners: ((info: chrome.management.ExtensionInfo) => void)[] = [];
const uninstalledListeners: ((id: string) => void)[] = [];
const enabledListeners: ((info: chrome.management.ExtensionInfo) => void)[] = [];
const disabledListeners: ((info: chrome.management.ExtensionInfo) => void)[] = [];

vi.stubGlobal("chrome", {
  management: {
    onInstalled: {
      addListener: (fn: (info: chrome.management.ExtensionInfo) => void) => installedListeners.push(fn),
      removeListener: (fn: (info: chrome.management.ExtensionInfo) => void) => {
        const idx = installedListeners.indexOf(fn);
        if (idx >= 0) installedListeners.splice(idx, 1);
      },
    },
    onUninstalled: {
      addListener: (fn: (id: string) => void) => uninstalledListeners.push(fn),
      removeListener: (fn: (id: string) => void) => {
        const idx = uninstalledListeners.indexOf(fn);
        if (idx >= 0) uninstalledListeners.splice(idx, 1);
      },
    },
    onEnabled: {
      addListener: (fn: (info: chrome.management.ExtensionInfo) => void) => enabledListeners.push(fn),
      removeListener: (fn: (info: chrome.management.ExtensionInfo) => void) => {
        const idx = enabledListeners.indexOf(fn);
        if (idx >= 0) enabledListeners.splice(idx, 1);
      },
    },
    onDisabled: {
      addListener: (fn: (info: chrome.management.ExtensionInfo) => void) => disabledListeners.push(fn),
      removeListener: (fn: (info: chrome.management.ExtensionInfo) => void) => {
        const idx = disabledListeners.indexOf(fn);
        if (idx >= 0) disabledListeners.splice(idx, 1);
      },
    },
  },
});

function makeExtensionInfo(
  id: string,
  overrides: Partial<chrome.management.ExtensionInfo> = {},
): chrome.management.ExtensionInfo {
  return {
    id,
    name: `Extension ${id}`,
    type: "extension",
    enabled: true,
    version: "1.0.0",
    description: "",
    mayDisable: true,
    installType: "normal",
    offlineEnabled: false,
    ...overrides,
  } as chrome.management.ExtensionInfo;
}

describe("extension-lifecycle-monitor", () => {
  const OWN_ID = "own-extension-id";

  beforeEach(() => {
    installedListeners.length = 0;
    uninstalledListeners.length = 0;
    enabledListeners.length = 0;
    disabledListeners.length = 0;
  });

  afterEach(() => {
    stopExtensionLifecycleMonitor();
  });

  it("installed イベントを発火する", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    onExtensionLifecycle((e) => events.push(e));

    const info = makeExtensionInfo("ext-1");
    for (const fn of installedListeners) fn(info);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("installed");
    expect(events[0].extensionId).toBe("ext-1");
    expect(events[0].info).toBeDefined();
  });

  it("uninstalled イベントを発火する", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    onExtensionLifecycle((e) => events.push(e));

    for (const fn of uninstalledListeners) fn("ext-2");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("uninstalled");
    expect(events[0].extensionId).toBe("ext-2");
    expect(events[0].info).toBeUndefined();
  });

  it("enabled/disabled イベントを発火する", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    onExtensionLifecycle((e) => events.push(e));

    const info = makeExtensionInfo("ext-3");
    for (const fn of enabledListeners) fn(info);
    for (const fn of disabledListeners) fn(info);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("enabled");
    expect(events[1].type).toBe("disabled");
  });

  it("自身の拡張機能IDはフィルタする", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    onExtensionLifecycle((e) => events.push(e));

    const ownInfo = makeExtensionInfo(OWN_ID);
    for (const fn of installedListeners) fn(ownInfo);
    for (const fn of enabledListeners) fn(ownInfo);

    expect(events).toHaveLength(0);
  });

  it("extension以外のtype（theme等）はフィルタする", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    onExtensionLifecycle((e) => events.push(e));

    const themeInfo = makeExtensionInfo("theme-1", { type: "theme" as chrome.management.ExtensionType });
    for (const fn of installedListeners) fn(themeInfo);

    expect(events).toHaveLength(0);
  });

  it("購読解除後はコールバックが呼ばれない", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    const events: ExtensionLifecycleEvent[] = [];
    const unsubscribe = onExtensionLifecycle((e) => events.push(e));

    unsubscribe();

    const info = makeExtensionInfo("ext-4");
    for (const fn of installedListeners) fn(info);

    expect(events).toHaveLength(0);
  });

  it("stopで全リスナーが解除される", () => {
    startExtensionLifecycleMonitor(OWN_ID);

    expect(installedListeners).toHaveLength(1);
    expect(enabledListeners).toHaveLength(1);

    stopExtensionLifecycleMonitor();

    expect(installedListeners).toHaveLength(0);
    expect(uninstalledListeners).toHaveLength(0);
    expect(enabledListeners).toHaveLength(0);
    expect(disabledListeners).toHaveLength(0);
  });

  it("二重startは無視される", () => {
    startExtensionLifecycleMonitor(OWN_ID);
    startExtensionLifecycleMonitor(OWN_ID);

    expect(installedListeners).toHaveLength(1);
  });
});
