import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRedirectMonitor,
  type RedirectMonitorDeps,
  type RedirectAlertInfo,
} from "./redirect-monitor.js";

// Mock chrome APIs
const committedListeners: Array<(details: unknown) => void> = [];
const tabRemovedListeners: Array<(tabId: number) => void> = [];

vi.stubGlobal("chrome", {
  webNavigation: {
    onCommitted: {
      addListener: (fn: (details: unknown) => void) => committedListeners.push(fn),
      removeListener: (fn: (details: unknown) => void) => {
        const idx = committedListeners.indexOf(fn);
        if (idx >= 0) committedListeners.splice(idx, 1);
      },
    },
  },
  tabs: {
    onRemoved: {
      addListener: (fn: (tabId: number) => void) => tabRemovedListeners.push(fn),
      removeListener: (fn: (tabId: number) => void) => {
        const idx = tabRemovedListeners.indexOf(fn);
        if (idx >= 0) tabRemovedListeners.splice(idx, 1);
      },
    },
  },
});

function emitCommitted(details: {
  tabId: number;
  url: string;
  frameId?: number;
  transitionType?: string;
  transitionQualifiers?: string[];
}) {
  const full = {
    frameId: 0,
    transitionType: "link",
    transitionQualifiers: [],
    ...details,
  };
  for (const listener of committedListeners) {
    listener(full);
  }
}

describe("createRedirectMonitor", () => {
  let deps: RedirectMonitorDeps;
  let alerts: RedirectAlertInfo[];
  let serviceUpdates: Array<{ domain: string; info: unknown }>;

  beforeEach(() => {
    committedListeners.length = 0;
    tabRemovedListeners.length = 0;
    alerts = [];
    serviceUpdates = [];
    deps = {
      logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
      onRedirectChainDetected: (info) => alerts.push(info),
      onServiceRedirectUpdate: (domain, info) => serviceUpdates.push({ domain, info }),
    };
  });

  it("detects server redirect chain across domains", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    // First navigation with server redirect qualifier
    emitCommitted({
      tabId: 1,
      url: "https://login.example.com/auth?redirect=https://evil.com",
      transitionQualifiers: ["server_redirect"],
    });

    // Second navigation — server redirect to different domain
    emitCommitted({
      tabId: 1,
      url: "https://evil.com/phish",
      transitionQualifiers: ["server_redirect"],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].sourceDomain).toBe("login.example.com");
    expect(alerts[0].destinationDomain).toBe("evil.com");
    expect(alerts[0].redirectType).toBe("server_redirect");
    expect(alerts[0].chainLength).toBe(2);

    expect(serviceUpdates).toHaveLength(1);
    expect(serviceUpdates[0].domain).toBe("login.example.com");

    monitor.stop();
  });

  it("detects client redirect chain", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 2,
      url: "https://site.com/redirect",
      transitionQualifiers: ["client_redirect"],
    });

    emitCommitted({
      tabId: 2,
      url: "https://tracker.com/collect",
      transitionQualifiers: ["client_redirect"],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].redirectType).toBe("client_redirect");

    monitor.stop();
  });

  it("does not alert for same-domain redirects", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 3,
      url: "https://example.com/a",
      transitionQualifiers: ["server_redirect"],
    });

    emitCommitted({
      tabId: 3,
      url: "https://example.com/b",
      transitionQualifiers: ["server_redirect"],
    });

    expect(alerts).toHaveLength(0);

    monitor.stop();
  });

  it("ignores non-main-frame navigations", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 4,
      url: "https://evil.com/iframe",
      frameId: 1,
      transitionQualifiers: ["server_redirect"],
    });

    expect(alerts).toHaveLength(0);

    monitor.stop();
  });

  it("resets chain on normal navigation", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 5,
      url: "https://a.com/start",
      transitionQualifiers: ["server_redirect"],
    });

    // Normal navigation (no redirect qualifier) — resets chain
    emitCommitted({
      tabId: 5,
      url: "https://b.com/normal",
      transitionQualifiers: [],
    });

    // New redirect — should not continue previous chain
    emitCommitted({
      tabId: 5,
      url: "https://c.com/new",
      transitionQualifiers: ["server_redirect"],
    });

    expect(alerts).toHaveLength(0);

    monitor.stop();
  });

  it("cleans up chain on tab removal", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 6,
      url: "https://a.com/redirect",
      transitionQualifiers: ["server_redirect"],
    });

    expect(monitor.getChain(6)).toBeDefined();

    // Simulate tab close
    for (const listener of tabRemovedListeners) {
      listener(6);
    }

    expect(monitor.getChain(6)).toBeUndefined();

    monitor.stop();
  });

  it("ignores chrome:// internal URLs", () => {
    const monitor = createRedirectMonitor(deps);
    monitor.start();

    emitCommitted({
      tabId: 7,
      url: "chrome://settings",
      transitionQualifiers: ["server_redirect"],
    });

    expect(monitor.getChain(7)).toBeUndefined();

    monitor.stop();
  });
});
