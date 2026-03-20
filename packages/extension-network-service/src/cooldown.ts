import { createCooldownManager, createPersistentCooldownStorage } from "@pleno-audit/extension-runtime";
import type { CooldownManager } from "@pleno-audit/extension-runtime";
import type { ExtensionNetworkContext } from "./types.js";

const EXTENSION_ALERT_COOLDOWN_MS = 1000 * 60 * 60;

export function getCooldownManager(context: ExtensionNetworkContext): CooldownManager {
  if (!context.state.cooldownManager) {
    const storage = createPersistentCooldownStorage(
      async () => {
        const data = await context.deps.getStorage();
        return { alertCooldown: data.alertCooldown };
      },
      async (data) => {
        await context.deps.setStorage({ alertCooldown: data.alertCooldown });
      }
    );
    context.state.cooldownManager = createCooldownManager(storage, {
      defaultCooldownMs: EXTENSION_ALERT_COOLDOWN_MS,
    });
  }
  return context.state.cooldownManager;
}
