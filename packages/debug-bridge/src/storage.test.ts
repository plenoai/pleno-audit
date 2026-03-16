import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStorage,
  getStorageKeys,
  getStorageValue,
  isValidStorageKey,
  setStorageValue,
} from "./storage";

function createMockChromeStorage() {
  const store: Record<string, unknown> = {};
  return {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...store };
        if (typeof keys === "string") return { [keys]: store[keys] };
        const result: Record<string, unknown> = {};
        for (const k of keys) result[k] = store[k];
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      clear: vi.fn(async () => {
        for (const key of Object.keys(store)) delete store[key];
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = typeof keys === "string" ? [keys] : keys;
        for (const k of arr) delete store[k];
      }),
    },
    _store: store,
  };
}

describe("isValidStorageKey", () => {
  it("有効なキー 'services' を受け入れる", () => {
    expect(isValidStorageKey("services")).toBe(true);
  });

  it("有効なキー 'networkConfig' を受け入れる", () => {
    expect(isValidStorageKey("networkConfig")).toBe(true);
  });

  it("空文字列を拒否する", () => {
    expect(isValidStorageKey("")).toBe(false);
  });

  it("'__proto__' を拒否する（プロトタイプ汚染防止）", () => {
    expect(isValidStorageKey("__proto__")).toBe(false);
  });

  it("'constructor' を拒否する", () => {
    expect(isValidStorageKey("constructor")).toBe(false);
  });

  it("'prototype' を拒否する", () => {
    expect(isValidStorageKey("prototype")).toBe(false);
  });
});

describe("storage operations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupMock(initialData?: Record<string, unknown>) {
    const storage = createMockChromeStorage();
    if (initialData) {
      Object.assign(storage._store, initialData);
    }
    vi.stubGlobal("chrome", { storage });
    return storage;
  }

  describe("getStorageKeys", () => {
    it("ストレージの全キーを返す", async () => {
      setupMock({ services: [], networkConfig: { enabled: true } });

      const result = await getStorageKeys();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["services", "networkConfig"]);
    });

    it("空ストレージでは空配列を返す", async () => {
      setupMock();

      const result = await getStorageKeys();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getStorageValue", () => {
    it("有効なキーの値を返す", async () => {
      setupMock({ services: [{ name: "github" }] });

      const result = await getStorageValue({ key: "services" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ name: "github" }]);
    });

    it("存在しないキーではundefinedを返す", async () => {
      setupMock();

      const result = await getStorageValue({ key: "nonexistent" });

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe("setStorageValue", () => {
    it("有効なキーで値を保存し success: true を返す", async () => {
      const storage = setupMock();

      const result = await setStorageValue({
        key: "services",
        value: [{ name: "gitlab" }],
      });

      expect(result).toEqual({ success: true });
      expect(storage._store.services).toEqual([{ name: "gitlab" }]);
    });

    it("'__proto__' キーを拒否し success: false を返す", async () => {
      const storage = setupMock();

      const result = await setStorageValue({
        key: "__proto__",
        value: { malicious: true },
      });

      expect(result).toEqual({ success: false, error: "Invalid storage key" });
      expect(storage.local.set).not.toHaveBeenCalled();
    });

    it("'constructor' キーを拒否する", async () => {
      setupMock();

      const result = await setStorageValue({
        key: "constructor",
        value: "overwrite",
      });

      expect(result.success).toBe(false);
    });

    it("空文字列キーを拒否する", async () => {
      setupMock();

      const result = await setStorageValue({ key: "", value: "data" });

      expect(result.success).toBe(false);
    });

    it("Object.create(null) で安全なオブジェクトを使って保存する", async () => {
      const storage = setupMock();

      await setStorageValue({ key: "test", value: 42 });

      // set が呼ばれた引数のオブジェクトがプロトタイプを持たないことを確認
      const setArg = storage.local.set.mock.calls[0][0] as object;
      expect(Object.getPrototypeOf(setArg)).toBeNull();
    });
  });

  describe("clearStorage", () => {
    it("全データを消去し success: true を返す", async () => {
      const storage = setupMock({ a: 1, b: 2 });

      const result = await clearStorage();

      expect(result).toEqual({ success: true });
      expect(storage.local.clear).toHaveBeenCalledTimes(1);
      expect(Object.keys(storage._store)).toHaveLength(0);
    });
  });
});
