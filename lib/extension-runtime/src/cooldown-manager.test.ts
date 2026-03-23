import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCooldownManager,
  createInMemoryCooldownStorage,
  createPersistentCooldownStorage,
  type CooldownStorage,
} from "./cooldown-manager.js";

describe("CooldownManager", () => {
  const COOLDOWN_MS = 1000; // 1 second for testing

  describe("basic functionality", () => {
    let storage: CooldownStorage;
    let manager: ReturnType<typeof createCooldownManager>;

    beforeEach(() => {
      storage = createInMemoryCooldownStorage();
      manager = createCooldownManager(storage, { defaultCooldownMs: COOLDOWN_MS });
    });

    it("returns false for keys not on cooldown", async () => {
      expect(await manager.isOnCooldown("test-key")).toBe(false);
    });

    it("returns true after setting cooldown", async () => {
      await manager.setCooldown("test-key");
      expect(await manager.isOnCooldown("test-key")).toBe(true);
    });

    it("returns false after cooldown expires", async () => {
      vi.useFakeTimers();
      try {
        await manager.setCooldown("test-key");
        expect(await manager.isOnCooldown("test-key")).toBe(true);

        vi.advanceTimersByTime(COOLDOWN_MS + 1);
        expect(await manager.isOnCooldown("test-key")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("tracks multiple keys independently", async () => {
      await manager.setCooldown("key-1");
      expect(await manager.isOnCooldown("key-1")).toBe(true);
      expect(await manager.isOnCooldown("key-2")).toBe(false);

      await manager.setCooldown("key-2");
      expect(await manager.isOnCooldown("key-1")).toBe(true);
      expect(await manager.isOnCooldown("key-2")).toBe(true);
    });

    it("clears specific cooldown", async () => {
      await manager.setCooldown("key-1");
      await manager.setCooldown("key-2");

      await manager.clearCooldown("key-1");

      expect(await manager.isOnCooldown("key-1")).toBe(false);
      expect(await manager.isOnCooldown("key-2")).toBe(true);
    });

    it("clears all cooldowns", async () => {
      await manager.setCooldown("key-1");
      await manager.setCooldown("key-2");

      await manager.clearAll();

      expect(await manager.isOnCooldown("key-1")).toBe(false);
      expect(await manager.isOnCooldown("key-2")).toBe(false);
    });

    it("returns remaining cooldown time", async () => {
      vi.useFakeTimers();
      try {
        await manager.setCooldown("test-key");
        expect(await manager.getRemainingCooldown("test-key")).toBe(COOLDOWN_MS);

        vi.advanceTimersByTime(300);
        expect(await manager.getRemainingCooldown("test-key")).toBe(COOLDOWN_MS - 300);

        vi.advanceTimersByTime(COOLDOWN_MS);
        expect(await manager.getRemainingCooldown("test-key")).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Service Worker restart simulation - IN-MEMORY (BUG SCENARIO)", () => {
    it("cooldown is lost when SW restarts with in-memory storage", async () => {
      const storage1 = createInMemoryCooldownStorage();
      const manager1 = createCooldownManager(storage1, { defaultCooldownMs: COOLDOWN_MS });

      await manager1.setCooldown("extension:abc123");
      expect(await manager1.isOnCooldown("extension:abc123")).toBe(true);

      // SW restart: new in-memory storage loses data
      const storage2 = createInMemoryCooldownStorage();
      const manager2 = createCooldownManager(storage2, { defaultCooldownMs: COOLDOWN_MS });

      expect(await manager2.isOnCooldown("extension:abc123")).toBe(false);
    });
  });

  describe("Service Worker restart simulation - PERSISTENT (FIX)", () => {
    it("cooldown survives SW restart with persistent storage", async () => {
      let persistentData: Record<string, number> = {};

      const createPersistentStorage = () =>
        createPersistentCooldownStorage(
          async () => ({ alertCooldown: persistentData }),
          async (data) => {
            persistentData = data.alertCooldown;
          }
        );

      const storage1 = createPersistentStorage();
      const manager1 = createCooldownManager(storage1, { defaultCooldownMs: COOLDOWN_MS });

      await manager1.setCooldown("extension:abc123");
      expect(await manager1.isOnCooldown("extension:abc123")).toBe(true);

      // SW restart: new manager, same persistent storage
      const storage2 = createPersistentStorage();
      const manager2 = createCooldownManager(storage2, { defaultCooldownMs: COOLDOWN_MS });

      expect(await manager2.isOnCooldown("extension:abc123")).toBe(true);
    });

    it("cooldown eventually expires even with persistent storage", async () => {
      vi.useFakeTimers();
      try {
        let persistentData: Record<string, number> = {};

        const createPersistentStorage = () =>
          createPersistentCooldownStorage(
            async () => ({ alertCooldown: persistentData }),
            async (data) => {
              persistentData = data.alertCooldown;
            }
          );

        const manager1 = createCooldownManager(createPersistentStorage(), {
          defaultCooldownMs: COOLDOWN_MS,
        });
        await manager1.setCooldown("extension:abc123");

        vi.advanceTimersByTime(COOLDOWN_MS + 1);

        const manager2 = createCooldownManager(createPersistentStorage(), {
          defaultCooldownMs: COOLDOWN_MS,
        });
        expect(await manager2.isOnCooldown("extension:abc123")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("createPersistentCooldownStorage", () => {
    it("reads from storage correctly", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        alertCooldown: { "key-1": 1000, "key-2": 2000 },
      });
      const mockSet = vi.fn().mockResolvedValue(undefined);

      const storage = createPersistentCooldownStorage(mockGet, mockSet);
      const data = await storage.get();

      expect(mockGet).toHaveBeenCalled();
      expect(data).toEqual({ "key-1": 1000, "key-2": 2000 });
    });

    it("handles empty storage", async () => {
      const mockGet = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockResolvedValue(undefined);

      const storage = createPersistentCooldownStorage(mockGet, mockSet);
      const data = await storage.get();

      expect(data).toEqual({});
    });

    it("writes to storage correctly", async () => {
      const mockGet = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockResolvedValue(undefined);

      const storage = createPersistentCooldownStorage(mockGet, mockSet);
      await storage.set({ "key-1": 1000 });

      expect(mockSet).toHaveBeenCalledWith({ alertCooldown: { "key-1": 1000 } });
    });
  });

  describe("edge cases", () => {
    it("handles custom timestamp for setCooldown", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(4500);

      try {
        const storage = createInMemoryCooldownStorage();
        const manager = createCooldownManager(storage, { defaultCooldownMs: COOLDOWN_MS });

        await manager.setCooldown("test-key", 4000);
        expect(await manager.isOnCooldown("test-key")).toBe(true);

        vi.advanceTimersByTime(501);
        expect(await manager.isOnCooldown("test-key")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("handles very long cooldown periods", async () => {
      const HOUR = 1000 * 60 * 60;
      const storage = createInMemoryCooldownStorage();
      const manager = createCooldownManager(storage, { defaultCooldownMs: HOUR });

      vi.useFakeTimers();
      try {
        await manager.setCooldown("test-key");

        vi.advanceTimersByTime(59 * 60 * 1000);
        expect(await manager.isOnCooldown("test-key")).toBe(true);

        vi.advanceTimersByTime(2 * 60 * 1000);
        expect(await manager.isOnCooldown("test-key")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
