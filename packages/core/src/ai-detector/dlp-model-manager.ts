/**
 * DLP Model Manager
 *
 * Transformers.js のモデルキャッシュ状態を管理する。
 * Transformers.js は内部で Cache API を使用してモデルを永続化するため、
 * IndexedDB による手動管理は不要。
 */

import { createLogger } from "../extension-runtime/logger.js";

const logger = createLogger("dlp-model-manager");

const MODEL_CACHE_KEY = "ja-ner-onnx";

export interface ModelStatus {
  downloaded: boolean;
  loading: boolean;
  ready: boolean;
  error?: string;
  downloadProgress?: number;
}

export interface DLPModelManager {
  getStatus(): ModelStatus;
  setReady(): void;
  setLoading(): void;
  setError(message: string): void;
  reset(): void;
  delete(): Promise<void>;
  isDownloaded(): Promise<boolean>;
}

export function createDLPModelManager(): DLPModelManager {
  const status: ModelStatus = {
    downloaded: false,
    loading: false,
    ready: false,
  };

  function getStatus(): ModelStatus {
    return { ...status };
  }

  function setReady(): void {
    status.downloaded = true;
    status.loading = false;
    status.ready = true;
    status.error = undefined;
    status.downloadProgress = 1;
  }

  function setLoading(): void {
    status.loading = true;
    status.error = undefined;
  }

  function setError(message: string): void {
    status.loading = false;
    status.error = message;
  }

  function reset(): void {
    status.downloaded = false;
    status.loading = false;
    status.ready = false;
    status.error = undefined;
    status.downloadProgress = undefined;
  }

  async function deleteModel(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        for (const key of keys) {
          if (key.url.includes(MODEL_CACHE_KEY)) {
            await cache.delete(key);
          }
        }
      }
    } catch (error) {
      logger.error("Model cache delete failed", error);
      throw error;
    }

    reset();
    logger.info("Model cache deleted");
  }

  async function isDownloaded(): Promise<boolean> {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        if (keys.some(k => k.url.includes(MODEL_CACHE_KEY))) {
          status.downloaded = true;
          return true;
        }
      }
      status.downloaded = false;
      return false;
    } catch {
      return false;
    }
  }

  return {
    getStatus,
    setReady,
    setLoading,
    setError,
    reset,
    delete: deleteModel,
    isDownloaded,
  };
}
