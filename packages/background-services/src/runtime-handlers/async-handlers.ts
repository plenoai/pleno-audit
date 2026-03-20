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
import { createNetworkAndExtensionHandlers } from "./network-extension-handlers.js";
import { createSecurityAsyncHandlers } from "./security-handlers.js";
import { createComputationHandlers } from "./computation-handlers.js";

export function createAsyncHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, AsyncMessageHandlerConfig> {
  const entries: AsyncHandlerEntry[] = [
    ...createSecurityAsyncHandlers(deps),
    ...createCspHandlers(deps),
    ...createConnectionAndAuthHandlers(deps),
    ...createAIPromptHandlers(deps),
    ...createDomainRiskHandlers(deps),
    ...createNetworkAndExtensionHandlers(deps),
    ...createConfigurationHandlers(deps),
    ...createComputationHandlers(deps),
  ];
  return new Map(entries);
}
