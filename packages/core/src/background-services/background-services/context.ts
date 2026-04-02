import type { Logger } from "../../extension-runtime/index.js";
import { createBackgroundServiceState } from "./state.js";
import type { BackgroundServiceState } from "./state.js";

type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

export type BoundFn<
  // biome-ignore lint: `any` required for generic function binding to preserve parameter types
  Fn extends (state: BackgroundServiceState, ...args: any[]) => any
> = (...args: Tail<Parameters<Fn>>) => ReturnType<Fn>;

export interface BackgroundServiceContext {
  state: BackgroundServiceState;
  bind: <Fn extends (state: BackgroundServiceState, ...args: any[]) => any>(
    fn: Fn
  ) => BoundFn<Fn>;
}

export function createBackgroundServiceContext(logger: Logger): BackgroundServiceContext {
  const state = createBackgroundServiceState(logger);

  const bind = <Fn extends (state: BackgroundServiceState, ...args: any[]) => any>(
    fn: Fn
  ): BoundFn<Fn> => {
    return ((...args: Tail<Parameters<Fn>>): ReturnType<Fn> => fn(state, ...args)) as BoundFn<Fn>;
  };

  return { state, bind };
}
