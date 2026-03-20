import type {
  AsyncHandlerEntry,
  AsyncMessageHandlerConfig,
  RuntimeHandlerDependencies,
} from "./types.js";
import { createAIPromptHandlers } from "./ai-handlers.js";
import { createConfigurationHandlers } from "./config-handlers.js";
import { createConnectionAndAuthHandlers } from "./connection-auth-handlers.js";
import { createCspHandlers } from "./csp-handlers.js";
import { createDomainRiskHandlers } from "./domain-risk-handlers.js";
import { createEventStoreHandlers } from "./event-store-handlers.js";
import { createNetworkAndExtensionHandlers } from "./network-extension-handlers.js";
import { createSecurityAsyncHandlers } from "./security-handlers.js";

export function createAsyncHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, AsyncMessageHandlerConfig> {
  const entries: AsyncHandlerEntry[] = [
    ...createSecurityAsyncHandlers(deps),
    ...createCspHandlers(deps),
    ...createConnectionAndAuthHandlers(deps),
    ...createAIPromptHandlers(deps),
    ...createDomainRiskHandlers(deps),
    ...createEventStoreHandlers(deps),
    ...createNetworkAndExtensionHandlers(deps),
    ...createConfigurationHandlers(deps),
  ];
  return new Map(entries);
}
