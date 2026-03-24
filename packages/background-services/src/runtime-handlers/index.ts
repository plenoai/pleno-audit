import type { RuntimeHandlerDependencies, RuntimeMessageHandlers } from "./types.js";
import { createAsyncHandlers } from "./async-handlers.js";
import { createDirectHandlers } from "./direct-handlers.js";

export function createRuntimeMessageHandlers(
  deps: RuntimeHandlerDependencies,
): RuntimeMessageHandlers {
  return {
    direct: createDirectHandlers(deps),
    async: createAsyncHandlers(deps),
  };
}

export { runAsyncMessageHandler } from "./async-runner.js";
export type {
  AsyncMessageHandlerConfig,
  LoggerLike,
  RuntimeHandlerDependencies,
  RuntimeHandlerFallbacks,
  RuntimeMessage,
  RuntimeMessageHandler,
  RuntimeMessageHandlers,
} from "./types.js";
