import { createLogger, isManifestV3, getBrowserAPI } from "libztbs/extension-runtime";
import type { DefenseScore, ScanProgressEvent } from "libztbs/battacker";

const logger = createLogger("battacker");

// Panel window ID management
let panelWindowId: number | null = null;

interface MessageRequest {
  type: "RUN_TESTS" | "GET_LAST_RESULT" | "GET_HISTORY" | "BATTACKER_CONTENT_READY" | "BATTACKER_SCAN_PROGRESS";
}

// Track which tabs have content script ready
const readyTabs = new Set<number>();

let lastResult: DefenseScore | null = null;
let isRunning = false;

const TEST_TARGET_URL = "https://example.com";

interface TargetTabResult {
  targetTab: chrome.tabs.Tab;
  returnToTabId?: number;
}

async function findTargetTab(): Promise<TargetTabResult | null> {
  const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = currentWindowTabs[0];

  if (currentTab?.url && isTestableUrl(currentTab.url)) {
    logger.debug(`Using active tab in current window: ${currentTab.url}`);
    return { targetTab: currentTab };
  }

  // Panel/dashboard context: search active tabs across all windows
  const allActiveTabs = await chrome.tabs.query({ active: true });

  let lastFocusedWindowId: number | undefined;
  try {
    const lastFocused = await chrome.windows.getLastFocused({ populate: false });
    lastFocusedWindowId = lastFocused.id;
  } catch {
    // ignore
  }

  const testableTabs = allActiveTabs
    .filter((tab) => tab.url && isTestableUrl(tab.url))
    .sort((a, b) => {
      const aInLast = a.windowId === lastFocusedWindowId ? 0 : 1;
      const bInLast = b.windowId === lastFocusedWindowId ? 0 : 1;
      return aInLast - bInLast;
    });

  if (testableTabs.length > 0) {
    const bestTab = testableTabs[0];
    logger.debug(`Using active tab from another window: ${bestTab.url}`);
    return { targetTab: bestTab };
  }

  logger.info("No testable tab found in any window, opening test target page...");
  const targetTab = await openTestTargetTab();
  if (!targetTab) return null;

  return {
    targetTab,
    returnToTabId: currentTab?.id,
  };
}

async function openTestTargetTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const tab = await chrome.tabs.create({ url: TEST_TARGET_URL, active: true });

    if (!tab.id) {
      logger.error("Failed to create test tab");
      return null;
    }

    logger.debug(`Created test tab ${tab.id}, waiting for load...`);
    await waitForTabLoad(tab.id);

    const updatedTab = await chrome.tabs.get(tab.id);
    logger.info(`Test target ready: ${updatedTab.url}`);
    return updatedTab;
  } catch (error) {
    logger.error("Failed to open test target:", error);
    return null;
  }
}

async function returnToDashboard(tabId: number): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { active: true });
    logger.debug(`Returned to dashboard tab ${tabId}`);
  } catch (error) {
    logger.debug("Failed to return to dashboard:", error);
  }
}

async function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const checkStatus = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") {
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      } catch {
        resolve();
      }
    };
    checkStatus();
  });
}

function isTestableUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function openOrFocusPanelWindow(): Promise<void> {
  if (panelWindowId !== null) {
    try {
      await chrome.windows.get(panelWindowId);
      await chrome.windows.update(panelWindowId, { focused: true });
      return;
    } catch {
      panelWindowId = null;
    }
  }

  const newWindow = await chrome.windows.create({
    url: chrome.runtime.getURL("/panel.html"),
    type: "popup",
    width: 400,
    height: 580,
    focused: true,
  });

  if (newWindow.id) {
    panelWindowId = newWindow.id;
  }
}

export default defineBackground(() => {
  logger.info("Background started");

  chrome.action.onClicked.addListener(async () => {
    await openOrFocusPanelWindow();
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === panelWindowId) {
      panelWindowId = null;
    }
  });

  chrome.runtime.onMessage.addListener(
    (
      message: MessageRequest | ScanProgressEvent,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      // Handle progress events from content script - broadcast to extension pages
      if (message.type === "BATTACKER_SCAN_PROGRESS") {
        // Re-broadcast to all extension pages (panel, dashboard)
        chrome.runtime.sendMessage(message).catch(() => {
          // Ignore - no listeners
        });
        return false;
      }

      switch (message.type) {
        case "RUN_TESTS":
          handleRunTests().then(sendResponse);
          return true;

        case "GET_LAST_RESULT":
          handleGetLastResult().then(sendResponse);
          return true;

        case "GET_HISTORY":
          handleGetHistory().then(sendResponse);
          return true;

        case "BATTACKER_CONTENT_READY":
          if (sender.tab?.id) {
            readyTabs.add(sender.tab.id);
            logger.debug(`Content script ready in tab ${sender.tab.id}`);
          }
          sendResponse({ ok: true });
          return false;

        default:
          sendResponse({ error: "Unknown message type" });
          return false;
      }
    },
  );

  chrome.tabs.onRemoved.addListener((tabId) => {
    readyTabs.delete(tabId);
  });
});

async function handleRunTests(): Promise<DefenseScore | { error: string }> {
  if (isRunning) {
    return { error: "Tests are already running" };
  }

  isRunning = true;
  logger.info("Starting security tests via content script...");

  let returnToTabId: number | undefined;

  try {
    const result = await findTargetTab();

    if (!result?.targetTab?.id) {
      return { error: "No suitable web page found. Please open a regular web page to test." };
    }

    const { targetTab } = result;
    returnToTabId = result.returnToTabId;

    const url = targetTab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
      return { error: "Cannot run tests on browser internal pages. Please navigate to a regular web page." };
    }

    if (!readyTabs.has(targetTab.id)) {
      try {
        await injectContentScript(targetTab.id);
        logger.debug("Content script injected");
      } catch (injectError) {
        logger.debug("Content script injection skipped:", injectError);
      }

      const maxWaitTime = 5000;
      const checkInterval = 100;
      let waited = 0;

      while (!readyTabs.has(targetTab.id) && waited < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }

      if (!readyTabs.has(targetTab.id)) {
        logger.warn("Content script did not signal ready within timeout, attempting anyway...");
      }
    } else {
      logger.debug("Content script already ready");
    }

    logger.info("Sending message to content script...");

    let response: DefenseScore | { error: string };
    try {
      response = (await chrome.tabs.sendMessage(targetTab.id, {
        type: "BATTACKER_RUN_TESTS",
      })) as DefenseScore | { error: string };
    } catch (sendError) {
      logger.error("sendMessage error:", sendError);
      if (sendError instanceof Error && sendError.message.includes("Receiving end does not exist")) {
        return { error: "Content script not loaded. Please refresh the page and try again." };
      }
      return { error: `Message send failed: ${sendError instanceof Error ? sendError.message : String(sendError)}` };
    }

    logger.info("Received response from content script:", response);

    if (!response) {
      return { error: "No response from content script" };
    }

    if ("error" in response) {
      logger.error("Content script returned error:", response.error);
      return response;
    }

    lastResult = response;
    await saveResult(response);

    logger.info(`Tests complete. Score: ${response.totalScore} (${response.grade})`);

    return response;
  } catch (error) {
    logger.error("Unexpected error:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  } finally {
    isRunning = false;
    if (returnToTabId) {
      await returnToDashboard(returnToTabId);
    }
  }
}

async function handleGetLastResult(): Promise<DefenseScore | null> {
  if (lastResult) {
    return lastResult;
  }

  const stored = await chrome.storage.local.get("battacker_lastResult");
  return stored.battacker_lastResult ?? null;
}

async function handleGetHistory(): Promise<DefenseScore[]> {
  const stored = await chrome.storage.local.get("battacker_history");
  return stored.battacker_history ?? [];
}

async function saveResult(score: DefenseScore): Promise<void> {
  await chrome.storage.local.set({ battacker_lastResult: score });

  const historyData = await chrome.storage.local.get("battacker_history");
  const history: DefenseScore[] = historyData.battacker_history ?? [];

  history.push(score);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredHistory = history.filter((h) => h.testedAt > thirtyDaysAgo);

  await chrome.storage.local.set({ battacker_history: filteredHistory });
}

async function injectContentScript(tabId: number): Promise<void> {
  if (isManifestV3()) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-scripts/content.js"],
    });
  } else {
    const browserAPI = getBrowserAPI();
    await browserAPI.tabs.executeScript(tabId, {
      file: "content-scripts/content.js",
    });
  }
}
