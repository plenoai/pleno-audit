import type { Period, TabType } from "./types";

export const periodOptions: { value: Period; label: string }[] = [
  { value: "1h", label: "1時間" },
  { value: "24h", label: "24時間" },
  { value: "7d", label: "7日" },
  { value: "30d", label: "30日" },
  { value: "all", label: "全期間" },
];

export const tabs: { id: TabType; label: string }[] = [
  { id: "ai", label: "AI監視" },
  { id: "services", label: "サービス" },
  { id: "events", label: "イベント" },
  { id: "extensions", label: "拡張機能" },
];

export const loadingTabs: { id: TabType; label: string }[] = [
  { id: "ai", label: "AI監視" },
];

export const validTabs: TabType[] = tabs.map((tab) => tab.id);

export const shortcutTabs: TabType[] = [
  "ai",
  "services",
  "events",
  "extensions",
];
