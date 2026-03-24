import type { TabType } from "./types";

export const tabs: { id: TabType; label: string }[] = [
  { id: "services", label: "サービス" },
  { id: "extensions", label: "拡張機能" },
];

export const loadingTabs: { id: TabType; label: string }[] = [
  { id: "services", label: "サービス" },
];

export const validTabs: TabType[] = tabs.map((tab) => tab.id);

export const shortcutTabs: TabType[] = [
  "services",
  "extensions",
];
