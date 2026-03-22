/**
 * EventStore - IndexedDB-backed event storage (optimized)
 *
 * Performance optimizations:
 * - Cursor-based queries with early termination
 * - cursor.advance() for fast offset skipping
 * - Index-based count() for O(1) counting
 * - Set-based filtering for O(1) lookups
 * - Cursor direction for sorting (no memory sort)
 */

import type { EventLog, EventLogType } from "@pleno-audit/casb-types";
import { DB_CONFIG, initializeDatabase } from "./schema.js";

export interface EventQueryOptions {
  limit?: number;
  offset?: number;
  type?: EventLogType[];
  domain?: string;
  since?: number;
  until?: number;
  orderBy?: "timestamp" | "-timestamp";
}

export interface EventQueryResult {
  events: EventLog[];
  total: number;
  hasMore: boolean;
}

export class EventStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.db = await initializeDatabase();
    })();

    return this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("EventStore not initialized. Call init() first.");
    }
    return this.db;
  }

  async add(event: EventLog): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.add(event);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addBatch(events: EventLog[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);

      events.forEach((event) => {
        store.add(event);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 高速クエリ - カーソルベースでインデックスを活用
   * limit: Infinity で全データ取得可能
   */
  async query(options?: EventQueryOptions): Promise<EventQueryResult> {
    await this.init();

    const limit = options?.limit ?? Infinity;
    const offset = options?.offset ?? 0;
    const descending = (options?.orderBy ?? "-timestamp") === "-timestamp";
    const hasTypeFilter = !!(options?.type?.length);
    const hasDomainFilter = !!options?.domain;

    // フィルタなし: 高速パス（timestampインデックス直接使用）
    if (!hasTypeFilter && !hasDomainFilter) {
      return this.queryByTimestampOnly(options?.since, options?.until, limit, offset, descending);
    }

    // フィルタあり: カーソルベースで処理
    return this.queryWithFilters(options, limit, offset, descending);
  }

  /**
   * 期間フィルタのみ - timestampインデックスを直接使用（最速）
   */
  private async queryByTimestampOnly(
    since: number | undefined,
    until: number | undefined,
    limit: number,
    offset: number,
    descending: boolean
  ): Promise<EventQueryResult> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const index = store.index("timestamp");
      const range = this.buildRange(since, until);
      const direction: IDBCursorDirection = descending ? "prev" : "next";

      const results: EventLog[] = [];
      let total = 0;
      let skipped = false;

      // totalを並列でカウント（高速）
      const countRequest = range ? index.count(range) : index.count();
      countRequest.onsuccess = () => {
        total = countRequest.result;
      };

      const cursorRequest = index.openCursor(range, direction);

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve({
            events: results,
            total,
            hasMore: offset + results.length < total,
          });
          return;
        }

        // offsetをadvance()で高速スキップ（1回だけ）
        if (!skipped && offset > 0) {
          skipped = true;
          cursor.advance(offset);
          return;
        }
        skipped = true;

        // limitに達したら終了
        if (limit !== Infinity && results.length >= limit) {
          resolve({
            events: results,
            total,
            hasMore: offset + results.length < total,
          });
          return;
        }

        results.push(cursor.value);
        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * フィルタありクエリ - カーソルで逐次フィルタリング
   */
  private async queryWithFilters(
    options: EventQueryOptions | undefined,
    limit: number,
    offset: number,
    descending: boolean
  ): Promise<EventQueryResult> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const index = store.index("timestamp");
      const range = this.buildRange(options?.since, options?.until);
      const direction: IDBCursorDirection = descending ? "prev" : "next";

      const typeSet = options?.type ? new Set(options.type) : null;
      const domain = options?.domain;

      const results: EventLog[] = [];
      let matchedCount = 0;

      const cursorRequest = index.openCursor(range, direction);

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve({
            events: results,
            total: matchedCount,
            hasMore: false,
          });
          return;
        }

        const event = cursor.value as EventLog;

        // フィルタ適用（Set.has()でO(1)）
        const matchesType = !typeSet || typeSet.has(event.type);
        const matchesDomain = !domain || event.domain === domain;

        if (matchesType && matchesDomain) {
          matchedCount++;

          // offsetをスキップした後、limitまで取得
          if (matchedCount > offset && (limit === Infinity || results.length < limit)) {
            results.push(event);
          }

          // limitに達したら即座に終了（全件カウント不要の場合）
          if (limit !== Infinity && results.length >= limit) {
            resolve({
              events: results,
              total: matchedCount,
              hasMore: true, // まだデータがある可能性
            });
            return;
          }
        }

        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getById(id: string): Promise<EventLog | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 高速count - インデックスのcount()を使用
   */
  async count(options?: {
    type?: EventLogType[];
    domain?: string;
    since?: number;
    until?: number;
  }): Promise<number> {
    await this.init();

    const hasFilters = !!(options?.type?.length || options?.domain);

    // フィルタなし: インデックスのcount()を使用（O(1)）
    if (!hasFilters) {
      return new Promise((resolve, reject) => {
        const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
        const store = tx.objectStore(DB_CONFIG.stores.events.name);
        const index = store.index("timestamp");
        const range = this.buildRange(options?.since, options?.until);

        const request = range ? index.count(range) : index.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onerror = () => reject(tx.error);
      });
    }

    // フィルタあり: カーソルでカウント
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const index = store.index("timestamp");
      const range = this.buildRange(options?.since, options?.until);

      const typeSet = options?.type ? new Set(options.type) : null;
      const domain = options?.domain;

      let count = 0;
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(count);
          return;
        }

        const event = cursor.value as EventLog;
        const matchesType = !typeSet || typeSet.has(event.type);
        const matchesDomain = !domain || event.domain === domain;

        if (matchesType && matchesDomain) {
          count++;
        }

        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 全データエクスポート（制限なし）
   */
  async exportAll(): Promise<EventLog[]> {
    await this.init();
    const result = await this.query({ limit: Infinity, orderBy: "-timestamp" });
    return result.events;
  }

  /**
   * 期間指定で全データ取得（制限なし・高速）
   */
  async queryAll(options?: {
    since?: number;
    until?: number;
    type?: EventLogType[];
    domain?: string;
  }): Promise<EventLog[]> {
    const result = await this.query({
      ...options,
      limit: Infinity,
      orderBy: "-timestamp",
    });
    return result.events;
  }

  /**
   * getAll()を使った高速一括取得（フィルタなし専用）
   */
  async getAllByRange(since?: number, until?: number): Promise<EventLog[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const index = store.index("timestamp");
      const range = this.buildRange(since, until);

      const request = range ? index.getAll(range) : index.getAll();

      request.onsuccess = () => {
        const results = request.result as EventLog[];
        // 降順ソート（timestampインデックスは昇順）
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  private buildRange(since?: number, until?: number): IDBKeyRange | null {
    if (since && until) {
      return IDBKeyRange.bound(since, until);
    }
    if (since) {
      return IDBKeyRange.lowerBound(since);
    }
    if (until) {
      return IDBKeyRange.upperBound(until);
    }
    return null;
  }

  /**
   * 指定タイムスタンプより古いイベントを削除
   */
  async deleteOldEvents(beforeTimestamp: number): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const index = store.index("timestamp");
      const range = IDBKeyRange.upperBound(beforeTimestamp, true);

      let deletedCount = 0;
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(deletedCount);
          return;
        }

        cursor.delete();
        deletedCount++;
        cursor.continue();
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }
}
