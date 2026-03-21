import { useEffect } from "preact/hooks";
import type { TabType } from "../types";
import { shortcutTabs, validTabs } from "../constants";
import { resolveTabFromHash } from "../utils";

interface UseDashboardNavigationOptions {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  loadData: () => void;
}

export function useDashboardNavigation({
  activeTab,
  setActiveTab,
  loadData,
}: UseDashboardNavigationOptions) {
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const resolved = resolveTabFromHash(hash);
      if (resolved && validTabs.includes(resolved)) {
        setActiveTab(resolved);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setActiveTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        !!target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (shortcutTabs[idx]) setActiveTab(shortcutTabs[idx]);
      }
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !isEditableTarget) {
        loadData();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadData, setActiveTab]);
}
