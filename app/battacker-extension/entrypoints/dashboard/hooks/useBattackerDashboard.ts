import { createLogger } from "libztbs/extension-runtime";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { DefenseScore, ScanProgressEvent } from "libztbs/battacker";
import type { ScanState } from "../types";

const logger = createLogger("battacker-dashboard");

export function useBattackerDashboard() {
  const [score, setScore] = useState<DefenseScore | null>(null);
  const [history, setHistory] = useState<DefenseScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({
    completed: 0,
    total: 0,
    currentTest: null,
  });

  const loadData = useCallback(async () => {
    try {
      const [result, historyData] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" }),
        chrome.runtime.sendMessage({ type: "GET_HISTORY" }),
      ]);
      setScore(result);
      setHistory(historyData);
    } catch (error) {
      logger.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleMessage = (message: ScanProgressEvent) => {
      if (message.type === "BATTACKER_SCAN_PROGRESS") {
        setScanState({
          completed: message.completed,
          total: message.total,
          currentTest: message.currentTest
            ? { name: message.currentTest.name, category: message.currentTest.category }
            : null,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [loadData]);

  const runTests = useCallback(async () => {
    setRunning(true);
    setScanState({ completed: 0, total: 0, currentTest: null });

    try {
      const result = await chrome.runtime.sendMessage({ type: "RUN_TESTS" });
      if ("error" in result) {
        logger.error("Test execution failed:", result.error);
      } else {
        setScore(result);
        setHistory((prev) => [...prev, result]);
      }
    } catch (error) {
      logger.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
      setScanState({ completed: 0, total: 0, currentTest: null });
    }
  }, []);

  return {
    score,
    history,
    loading,
    running,
    scanState,
    runTests,
  };
}
