import { getDateString } from "./schema.js";
import type { ParquetLogType, WriteBuffer as WriteBufferType } from "./types.js";

const BUFFER_CONFIG = {
  flushIntervalMs: 5000, // 5秒
  maxBufferSize: 100, // 100件
};

export class WriteBuffer<T> {
  private buffers: Map<ParquetLogType, WriteBufferType<T>> = new Map();
  private flushTimers: Map<ParquetLogType, ReturnType<typeof setTimeout>> =
    new Map();
  private onFlush: (type: ParquetLogType, records: T[], date: string) => Promise<void>;

  constructor(
    onFlush: (type: ParquetLogType, records: T[], date: string) => Promise<void>
  ) {
    this.onFlush = onFlush;
  }

  async add(type: ParquetLogType, records: T[]): Promise<void> {
    const buffer = this.getOrCreateBuffer(type);
    for (const record of records) {
      buffer.records.push(record);
    }
    buffer.lastFlush = Date.now();

    // バッファサイズチェック
    if (buffer.records.length >= BUFFER_CONFIG.maxBufferSize) {
      await this.flush(type);
    } else {
      // デバウンス：既存のタイマーをクリア
      const timer = this.flushTimers.get(type);
      if (timer) clearTimeout(timer);

      // 新しいタイマーを設定
      const newTimer = setTimeout(
        () => this.flush(type),
        BUFFER_CONFIG.flushIntervalMs
      );
      this.flushTimers.set(type, newTimer);
    }
  }

  async flush(type: ParquetLogType): Promise<void> {
    const buffer = this.buffers.get(type);
    if (!buffer || buffer.records.length === 0) return;

    const records = buffer.records;
    const date = getDateString(buffer.targetDate);

    // バッファをリセット
    buffer.records = [];
    buffer.targetDate = new Date().toISOString();

    // タイマーをクリア
    const timer = this.flushTimers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(type);
    }

    // フラッシュ処理を実行
    await this.onFlush(type, records, date);
  }

  async flushAll(): Promise<void> {
    const types = Array.from(this.buffers.keys());
    await Promise.all(types.map((type) => this.flush(type)));
  }

  private getOrCreateBuffer(type: ParquetLogType): WriteBufferType<T> {
    let buffer = this.buffers.get(type);
    if (!buffer) {
      buffer = {
        records: [],
        lastFlush: Date.now(),
        targetDate: new Date().toISOString(),
      };
      this.buffers.set(type, buffer);
    }
    return buffer;
  }

  getBufferSize(type: ParquetLogType): number {
    return this.buffers.get(type)?.records.length ?? 0;
  }

  clearBuffer(type: ParquetLogType): void {
    const timer = this.flushTimers.get(type);
    if (timer) clearTimeout(timer);
    this.buffers.delete(type);
    this.flushTimers.delete(type);
  }

  dispose(): void {
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer);
    }
    this.flushTimers.clear();
    this.buffers.clear();
  }
}
