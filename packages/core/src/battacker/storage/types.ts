import type { DefenseScore } from "../types.js";

export interface BattackerStorage {
  getLastResult(): Promise<DefenseScore | null>;
  saveResult(result: DefenseScore): Promise<void>;
  getHistory(): Promise<DefenseScore[]>;
  clearHistory(): Promise<void>;
}
