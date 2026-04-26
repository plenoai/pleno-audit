import { useCallback, useEffect, useState } from "preact/hooks";
import type { DismissRecord } from "libztbs/alerts";
import { sendMessage } from "../../../lib/messaging";

const DISMISS_RECORDS_STORAGE_KEY = "pleno_dismiss_records";

export interface UseDismissedPatternsResult {
  dismissedPatterns: Set<string>;
  records: DismissRecord[];
  refresh: () => void;
}

export function useDismissedPatterns(): UseDismissedPatternsResult {
  const [records, setRecords] = useState<DismissRecord[]>([]);

  const refresh = useCallback(() => {
    sendMessage<DismissRecord[]>({ type: "GET_DISMISS_RECORDS" })
      .then(setRecords)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handleStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "local") return;
      if (!(DISMISS_RECORDS_STORAGE_KEY in changes)) return;
      refresh();
    }
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [refresh]);

  const dismissedPatterns = new Set(
    records.filter((r) => r.reopenedAt == null).map((r) => r.pattern),
  );

  return { dismissedPatterns, records, refresh };
}
