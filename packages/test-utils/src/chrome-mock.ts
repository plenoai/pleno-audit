import { vi } from "vitest";

export interface ChromeMockOptions {
  storageData?: Record<string, unknown>;
}

export function setupChromeMock(options: ChromeMockOptions = {}): typeof chrome {
  const storageData: Record<string, unknown> = { ...options.storageData };

  const mock = {
    storage: {
      local: {
        get: vi.fn((key?: string | string[]) => {
          if (typeof key === "string") {
            return Promise.resolve({ [key]: storageData[key] });
          }
          if (Array.isArray(key)) {
            const result: Record<string, unknown> = {};
            for (const k of key) result[k] = storageData[k];
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...storageData });
        }),
        set: vi.fn((data: Record<string, unknown>) => {
          Object.assign(storageData, data);
          return Promise.resolve();
        }),
        remove: vi.fn((keys: string | string[]) => {
          const ks = Array.isArray(keys) ? keys : [keys];
          for (const k of ks) delete storageData[k];
          return Promise.resolve();
        }),
        clear: vi.fn(() => {
          for (const key of Object.keys(storageData)) delete storageData[key];
          return Promise.resolve();
        }),
      },
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      getManifest: vi.fn().mockReturnValue({ version: "0.0.1" }),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as typeof chrome;

  globalThis.chrome = mock;
  return mock;
}

export function resetChromeMock(): void {
  if (globalThis.chrome) {
    const storage = globalThis.chrome.storage.local;
    (storage.get as ReturnType<typeof vi.fn>).mockClear();
    (storage.set as ReturnType<typeof vi.fn>).mockClear();
    (storage.remove as ReturnType<typeof vi.fn>).mockClear();
  }
}
