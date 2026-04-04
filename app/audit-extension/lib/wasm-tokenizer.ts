/**
 * WASM Tokenizer Adapter
 *
 * IndexedDBから読み込んだWASMバイナリを使って
 * wasm-bindgen JSグルーコード経由でJaTokenizerを初期化する。
 */

import type { WasmTokenResult } from "libztbs/ai-detector";
// @ts-expect-error -- wasm-bindgen output has no module types
import { initSync, JaTokenizer } from "./pleno-tokenizer-wasm/pleno_tokenizer_wasm.js";

export interface WasmTokenizerInstance {
  tokenize(text: string): WasmTokenResult[];
  dispose(): void;
}

let initialized = false;

/**
 * WASMバイナリからトークナイザインスタンスを作成する。
 * initSyncは1回のみ呼び出し可能（内部でグローバルwasmを設定するため）。
 */
export function createWasmTokenizer(wasmBytes: ArrayBuffer): WasmTokenizerInstance {
  if (!initialized) {
    initSync(wasmBytes);
    initialized = true;
  }

  const inner = new JaTokenizer();

  return {
    tokenize: (text: string): WasmTokenResult[] => inner.tokenize(text) as WasmTokenResult[],
    dispose: () => inner.free(),
  };
}
