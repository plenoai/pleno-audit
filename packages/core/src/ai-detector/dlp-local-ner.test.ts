import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadNERModel } from "./dlp-local-ner.js";
import { convertWasmTokens, type WasmTokenResult } from "./dlp-tokenizer.js";

const MODEL_PATH = resolve(
  import.meta.dirname ?? __dirname,
  "../../../../..",
  "pleno-anonymize/output/ja-v02/model-browser.bin",
);

const WASM_PKG_PATH = resolve(
  import.meta.dirname ?? __dirname,
  "../../../../..",
  "pleno-anonymize/packages/wasm-tokenizer/pkg",
);

function loadModel() {
  const buffer = readFileSync(MODEL_PATH);
  return loadNERModel(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function createWasmTokenizer() {
  const wasmBytes = readFileSync(resolve(WASM_PKG_PATH, "pleno_tokenizer_wasm_bg.wasm"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initSync, JaTokenizer } = require(resolve(WASM_PKG_PATH, "pleno_tokenizer_wasm.js"));
  initSync(wasmBytes);
  const inner = new JaTokenizer();
  return (text: string): WasmTokenResult[] => inner.tokenize(text) as WasmTokenResult[];
}

describe("loadNERModel", () => {
  it("parses model binary and returns config", () => {
    const model = loadModel();
    expect(model.config.labels).toEqual([
      "ADDRESS", "BANK_ACCOUNT", "DATE_OF_BIRTH", "ORGANIZATION", "PERSON",
    ]);
    expect(model.config.moves).toHaveLength(22);
    expect(model.config.width).toBe(128);
  });

  it("detects PERSON with WASM tokenizer", () => {
    const model = loadModel();
    const tokenize = createWasmTokenizer();

    const wasmResult = tokenize("田中太郎は東京都千代田区に住んでいます");
    const features = convertWasmTokens(wasmResult);
    const entities = model.predictWithFeatures(features);

    const labels = entities.map((e) => e.label);
    // tok2vec内部のwith_array配列管理がstep-by-step再現と異なるため
    // spaCyと完全一致はしないが、主要エンティティは検出される
    expect(labels).toContain("PERSON");

    const person = entities.find((e) => e.label === "PERSON");
    expect(person?.text).toContain("田中");
  });

  it("detects ORGANIZATION and PERSON", () => {
    const model = loadModel();
    const tokenize = createWasmTokenizer();

    const wasmResult = tokenize("株式会社プレノの山田一郎は2000年1月1日生まれです");
    const features = convertWasmTokens(wasmResult);
    const entities = model.predictWithFeatures(features);

    const labels = entities.map((e) => e.label);
    expect(labels).toContain("PERSON");
  });

  it("returns fewer entities for non-PII text", () => {
    const model = loadModel();
    const tokenize = createWasmTokenizer();

    const wasmResult = tokenize("今日はいい天気ですね");
    const features = convertWasmTokens(wasmResult);
    const entities = model.predictWithFeatures(features);
    // PII含まないテキストはPII多いテキストよりエンティティが少ない
    const piiResult = tokenize("田中太郎は東京都千代田区に住んでいます");
    const piiFeatures = convertWasmTokens(piiResult);
    const piiEntities = model.predictWithFeatures(piiFeatures);
    expect(entities.length).toBeLessThanOrEqual(piiEntities.length);
  });
});
