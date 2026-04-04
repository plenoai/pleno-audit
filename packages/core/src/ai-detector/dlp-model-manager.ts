/**
 * DLP Model Manager
 *
 * NERモデルのダウンロード・保存・ロードを管理する。
 * IndexedDBを使ってモデルバイナリをブラウザ内に永続化する。
 */

import { createLogger } from "../extension-runtime/logger.js";
import { loadNERModel, type NERModel } from "./dlp-local-ner.js";

const logger = createLogger("dlp-model-manager");

const DB_NAME = "pleno-dlp-models";
const STORE_NAME = "models";
const MODEL_KEY = "ja-ner";
const WASM_KEY = "ja-tokenizer-wasm";

export interface ModelStatus {
  downloaded: boolean;
  loading: boolean;
  ready: boolean;
  error?: string;
  modelSize?: number;
  downloadProgress?: number;
}

export interface DLPModelManager {
  getStatus(): ModelStatus;
  download(
    modelUrl: string,
    wasmUrl: string,
    onProgress?: (progress: number) => void,
  ): Promise<void>;
  load(): Promise<NERModel>;
  loadWasm(): Promise<ArrayBuffer>;
  delete(): Promise<void>;
  isDownloaded(): Promise<boolean>;
}

// --- IndexedDB helpers ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Manager ---

export function createDLPModelManager(): DLPModelManager {
  const status: ModelStatus = {
    downloaded: false,
    loading: false,
    ready: false,
  };

  let cachedModel: NERModel | null = null;

  function getStatus(): ModelStatus {
    return { ...status };
  }

  async function downloadSingle(
    url: string,
    key: string,
    onProgress?: (progress: number) => void,
  ): Promise<number> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get("Content-Length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      const db = await openDB();
      await idbPut(db, key, buffer);
      db.close();
      onProgress?.(1);
      return buffer.byteLength;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.byteLength;
      if (totalBytes > 0) {
        onProgress?.(receivedBytes / totalBytes);
      }
    }

    const buffer = new ArrayBuffer(receivedBytes);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const db = await openDB();
    await idbPut(db, key, buffer);
    db.close();
    onProgress?.(1);
    return receivedBytes;
  }

  async function download(
    modelUrl: string,
    wasmUrl: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    status.loading = true;
    status.error = undefined;
    status.downloadProgress = 0;

    try {
      // Download model (phase 1: 0-0.5)
      const modelSize = await downloadSingle(modelUrl, MODEL_KEY, (p) => {
        const total = p * 0.5;
        status.downloadProgress = total;
        onProgress?.(total);
      });
      logger.info("Model downloaded", { size: modelSize });

      // Download WASM (phase 2: 0.5-1.0)
      const wasmSize = await downloadSingle(wasmUrl, WASM_KEY, (p) => {
        const total = 0.5 + p * 0.5;
        status.downloadProgress = total;
        onProgress?.(total);
      });
      logger.info("WASM downloaded", { size: wasmSize });

      status.downloaded = true;
      status.modelSize = modelSize;
      status.downloadProgress = 1;
      onProgress?.(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.error = message;
      logger.error("Download failed", error);
      throw error;
    } finally {
      status.loading = false;
    }
  }

  async function load(): Promise<NERModel> {
    if (cachedModel) return cachedModel;

    status.loading = true;
    status.error = undefined;

    try {
      const db = await openDB();
      const buffer = await idbGet(db, MODEL_KEY);
      db.close();

      if (!buffer) {
        throw new Error("Model not downloaded. Call download() first.");
      }

      cachedModel = loadNERModel(buffer);
      status.downloaded = true;
      status.ready = true;
      status.modelSize = buffer.byteLength;
      logger.info("Model loaded", { config: cachedModel.config });
      return cachedModel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.error = message;
      status.ready = false;
      logger.error("Model load failed", error);
      throw error;
    } finally {
      status.loading = false;
    }
  }

  async function loadWasm(): Promise<ArrayBuffer> {
    try {
      const db = await openDB();
      const buffer = await idbGet(db, WASM_KEY);
      db.close();

      if (!buffer) {
        throw new Error("WASM not downloaded. Call download() first.");
      }

      logger.info("WASM loaded", { size: buffer.byteLength });
      return buffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("WASM load failed", error);
      throw new Error(message);
    }
  }

  async function deleteModel(): Promise<void> {
    if (cachedModel) {
      cachedModel.dispose();
      cachedModel = null;
    }

    try {
      const db = await openDB();
      await idbDelete(db, MODEL_KEY);
      await idbDelete(db, WASM_KEY);
      db.close();
    } catch (error) {
      logger.error("Model delete failed", error);
      throw error;
    }

    status.downloaded = false;
    status.ready = false;
    status.modelSize = undefined;
    status.error = undefined;
    logger.info("Model deleted");
  }

  async function isDownloaded(): Promise<boolean> {
    try {
      const db = await openDB();
      const buffer = await idbGet(db, MODEL_KEY);
      db.close();
      const downloaded = buffer !== undefined;
      status.downloaded = downloaded;
      if (downloaded && buffer) {
        status.modelSize = buffer.byteLength;
      }
      return downloaded;
    } catch {
      return false;
    }
  }

  return {
    getStatus,
    download,
    load,
    loadWasm,
    delete: deleteModel,
    isDownloaded,
  };
}
