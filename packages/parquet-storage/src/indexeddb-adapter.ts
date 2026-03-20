import type { ParquetFileRecord } from "./types.js";

const DB_NAME = "PlenoAuditParquet";
const DB_VERSION = 1;
const STORE_NAME = "parquet_files";

export class ParquetIndexedDBAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }

  async save(record: ParquetFileRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<ParquetFileRecord | undefined> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async loadByDate(
    type: string,
    date: string
  ): Promise<ParquetFileRecord | undefined> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const typeIndex = store.index("type");
      const request = typeIndex.getAll(type);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result as ParquetFileRecord[];
        const record = results.find((r) => r.date === date);
        resolve(record);
      };
    });
  }

  async listByType(type: string): Promise<ParquetFileRecord[]> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const typeIndex = store.index("type");
      const request = typeIndex.getAll(type);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as ParquetFileRecord[]);
    });
  }

  async listByDateRange(
    type: string,
    startDate: string,
    endDate: string
  ): Promise<ParquetFileRecord[]> {
    if (!this.db) throw new Error("Database not initialized");

    const allRecords = await this.listByType(type);
    return allRecords.filter((r) => r.date >= startDate && r.date <= endDate);
  }

  async delete(key: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteBeforeDate(type: string, beforeDate: string): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const records = await this.listByType(type);
    const toDelete = records.filter((r) => r.date < beforeDate);

    for (const record of toDelete) {
      await this.delete(record.key);
    }

    return toDelete.length;
  }

  async clear(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSize(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const records = await this.listAll();
    return records.reduce((sum, r) => sum + r.sizeBytes, 0);
  }

  private async listAll(): Promise<ParquetFileRecord[]> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as ParquetFileRecord[]);
    });
  }

  close(): void {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }
}
