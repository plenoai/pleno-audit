import type {
  AsyncHandlerEntry,
  AsyncMessageHandlerConfig,
  RuntimeHandlerDependencies,
} from "./types";
import { createAIPromptHandlers } from "./ai-handlers";
import { createConfigurationHandlers } from "./config-handlers";
import { createConnectionAndAuthHandlers } from "./connection-auth-handlers";
import { createCspHandlers } from "./csp-handlers";
import { createDomainRiskHandlers } from "./domain-risk-handlers";
import { createEventStoreHandlers } from "./event-store-handlers";
import { createNetworkAndExtensionHandlers } from "./network-extension-handlers";
import { createComputationHandlers } from "./computation-handlers";
import { createSecurityEventHandlers } from "./security-handlers";

export function createAsyncHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, AsyncMessageHandlerConfig> {
  const entries: AsyncHandlerEntry[] = [
    ...createSecurityEventHandlers(deps),
    ...createCspHandlers(deps),
    ...createConnectionAndAuthHandlers(deps),
    ...createAIPromptHandlers(deps),
    ...createDomainRiskHandlers(deps),
    ...createEventStoreHandlers(deps),
    ...createNetworkAndExtensionHandlers(deps),
    ...createConfigurationHandlers(deps),
    ...createComputationHandlers(deps),
  ];
  return new Map(entries);
}
