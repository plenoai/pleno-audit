import type { DefenseScore } from "../types.js";
import type { BattackerStorage } from "./types.js";

const DB_NAME = "battacker";
const DB_VERSION = 1;
const STORE_NAME = "results";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "testedAt" });
        store.createIndex("testedAt", "testedAt", { unique: true });
      }
    };
  });
}

export function createWebStorage(): BattackerStorage {
  return {
    async getLastResult(): Promise<DefenseScore | null> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("testedAt");
        const request = index.openCursor(null, "prev");

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          resolve(cursor ? (cursor.value as DefenseScore) : null);
        };
      });
    },

    async saveResult(result: DefenseScore): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(result);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async getHistory(): Promise<DefenseScore[]> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const results = request.result as DefenseScore[];
          results.sort((a, b) => b.testedAt - a.testedAt);
          resolve(results);
        };
      });
    },

    async clearHistory(): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },
  };
}
