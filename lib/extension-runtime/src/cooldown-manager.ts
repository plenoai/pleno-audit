/**
 * @fileoverview Cooldown Manager
 *
 * Manages alert cooldown with persistent storage to prevent duplicate alerts
 * across Service Worker restarts.
 */

/**
 * Storage adapter interface for cooldown persistence
 */
export interface CooldownStorage {
  get(): Promise<Record<string, number>>;
  set(data: Record<string, number>): Promise<void>;
}

/**
 * In-memory storage adapter (for testing - simulates Service Worker restart issue)
 */
export function createInMemoryCooldownStorage(): CooldownStorage {
  let data: Record<string, number> = {};

  return {
    async get() {
      return { ...data };
    },
    async set(newData) {
      data = { ...newData };
    },
  };
}

/**
 * Persistent storage adapter (production use)
 */
export function createPersistentCooldownStorage(
  getStorage: () => Promise<{ alertCooldown?: Record<string, number> }>,
  setStorage: (data: { alertCooldown: Record<string, number> }) => Promise<void>
): CooldownStorage {
  return {
    async get() {
      const storage = await getStorage();
      return storage.alertCooldown || {};
    },
    async set(data) {
      await setStorage({ alertCooldown: data });
    },
  };
}

export interface CooldownManagerConfig {
  defaultCooldownMs: number;
}

export interface CooldownManager {
  /**
   * Check if cooldown is active for a key
   */
  isOnCooldown(key: string): Promise<boolean>;

  /**
   * Set cooldown for a key
   */
  setCooldown(key: string, timestamp?: number): Promise<void>;

  /**
   * Get remaining cooldown time in ms (0 if not on cooldown)
   */
  getRemainingCooldown(key: string): Promise<number>;

  /**
   * Clear cooldown for a key
   */
  clearCooldown(key: string): Promise<void>;

  /**
   * Clear all cooldowns
   */
  clearAll(): Promise<void>;
}

/**
 * Create a cooldown manager with configurable storage
 *
 * @example
 * // Production: use persistent storage
 * const manager = createCooldownManager(
 *   createPersistentCooldownStorage(getStorage, setStorage),
 *   { defaultCooldownMs: 1000 * 60 * 60 } // 1 hour
 * );
 *
 * // Testing: use in-memory storage to simulate SW restart
 * const memoryStorage = createInMemoryCooldownStorage();
 * const manager = createCooldownManager(memoryStorage, { defaultCooldownMs: 1000 });
 */
export function createCooldownManager(
  storage: CooldownStorage,
  config: CooldownManagerConfig
): CooldownManager {
  const { defaultCooldownMs } = config;

  async function isOnCooldown(key: string): Promise<boolean> {
    const data = await storage.get();
    const lastTime = data[key] || 0;
    return Date.now() - lastTime < defaultCooldownMs;
  }

  async function setCooldown(key: string, timestamp?: number): Promise<void> {
    const data = await storage.get();
    data[key] = timestamp ?? Date.now();
    await storage.set(data);
  }

  async function getRemainingCooldown(key: string): Promise<number> {
    const data = await storage.get();
    const lastTime = data[key] || 0;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, defaultCooldownMs - elapsed);
  }

  async function clearCooldown(key: string): Promise<void> {
    const data = await storage.get();
    delete data[key];
    await storage.set(data);
  }

  async function clearAll(): Promise<void> {
    await storage.set({});
  }

  return {
    isOnCooldown,
    setCooldown,
    getRemainingCooldown,
    clearCooldown,
    clearAll,
  };
}
