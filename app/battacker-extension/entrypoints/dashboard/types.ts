import type { AttackCategory } from "@libztbs/battacker";

export type TabType = "overview" | "results" | "history";

export interface ScanState {
  completed: number;
  total: number;
  currentTest: {
    name: string;
    category: AttackCategory;
  } | null;
}
