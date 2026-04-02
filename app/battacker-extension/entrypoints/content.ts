import { createLogger } from "libztbs/extension-runtime";
import {
  allAttacks,
  calculateDefenseScore,
  runAllTests,
  type DefenseScore,
  type ScanProgressEvent,
} from "libztbs/battacker";

const logger = createLogger("battacker-content");

interface BattackerMessage {
  type: "BATTACKER_RUN_TESTS";
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    logger.debug("Content script loaded");

    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ type: "BATTACKER_CONTENT_READY" }).catch(() => {
      // Background might not be listening yet, that's ok
    });

    chrome.runtime.onMessage.addListener(
      (
        message: BattackerMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: DefenseScore | { error: string }) => void,
      ) => {
        if (message.type === "BATTACKER_RUN_TESTS") {
          logger.info("Running tests in page context...");
          executeTests().then(sendResponse);
          return true;
        }
        return false;
      },
    );
  },
});

async function executeTests(): Promise<DefenseScore | { error: string }> {
  try {
    logger.info(`Starting ${allAttacks.length} attack simulations...`);

    const results = await runAllTests(allAttacks, (completedIndex, total, current) => {
      // Convert 0-based index to 1-based completed count
      const completed = completedIndex + 1;
      logger.debug(`Progress: ${completed}/${total} - ${current.name}`);

      // Send progress via sendMessage (simple and reliable)
      const progressEvent: ScanProgressEvent = {
        type: "BATTACKER_SCAN_PROGRESS",
        completed,
        total,
        currentTest: {
          id: current.id,
          name: current.name,
          category: current.category,
          severity: current.severity,
        },
        phase: "running",
      };
      chrome.runtime.sendMessage(progressEvent).catch(() => {
        // Ignore errors - panel might not be listening
      });
    });

    const score = calculateDefenseScore(results);
    logger.info(`Tests complete. Score: ${score.totalScore} (${score.grade})`);

    // Send completion event
    const completedEvent: ScanProgressEvent = {
      type: "BATTACKER_SCAN_PROGRESS",
      completed: results.length,
      total: results.length,
      currentTest: null,
      phase: "completed",
    };
    chrome.runtime.sendMessage(completedEvent).catch((err) => {
      logger.debug("Failed to notify scan completion:", err);
    });

    return score;
  } catch (error) {
    logger.error("Test execution error:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
