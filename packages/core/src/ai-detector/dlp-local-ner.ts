/**
 * DLP Local NER Engine
 *
 * ブラウザ内CNNベースNER推論エンジン。
 * spaCyのHashEmbedCNN + TransitionBasedParserアーキテクチャを
 * Pure TypeScriptで実装。
 */

import { tokenize, type TokenFeatures } from "./dlp-tokenizer.js";

// --- Types ---

export interface NERModelConfig {
  labels: string[];
  moves: string[];
  embedSizes: number[];
  width: number;
  depth: number;
  hiddenWidth: number;
  maxoutPiecesTok2vec: number;
  maxoutPiecesNer: number;
  nFeatures: number;
}

export interface NERModel {
  config: NERModelConfig;
  predict(text: string): NEREntity[];
  predictWithFeatures(features: TokenFeatures): NEREntity[];
  dispose(): void;
}

export interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  score: number;
}

// --- Tensor Storage ---

interface Tensors {
  [name: string]: { shape: number[]; data: Float32Array };
}

// --- Model Binary Parser ---

function parsePNER(buffer: ArrayBuffer): { config: NERModelConfig; tensors: Tensors } {
  const view = new DataView(buffer);
  let offset = 0;

  // Magic: "PNER"
  const magic =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3));
  if (magic !== "PNER") {
    throw new Error(`Invalid model magic: ${magic}`);
  }
  offset += 4;

  // Version
  const version = view.getUint32(offset, true);
  if (version !== 1) {
    throw new Error(`Unsupported model version: ${version}`);
  }
  offset += 4;

  // Config JSON
  const configLen = view.getUint32(offset, true);
  offset += 4;
  const configBytes = new Uint8Array(buffer, offset, configLen);
  const raw = JSON.parse(new TextDecoder().decode(configBytes)) as Record<string, unknown>;
  const config: NERModelConfig = {
    labels: raw.labels as string[],
    moves: raw.moves as string[],
    embedSizes: raw.embed_sizes as number[],
    width: raw.width as number,
    depth: raw.depth as number,
    hiddenWidth: raw.hidden_width as number,
    maxoutPiecesTok2vec: raw.maxout_pieces_tok2vec as number,
    maxoutPiecesNer: raw.maxout_pieces_ner as number,
    nFeatures: raw.n_features as number,
  };
  offset += configLen;

  // Tensors
  const numTensors = view.getUint32(offset, true);
  offset += 4;

  const tensors: Tensors = {};
  for (let t = 0; t < numTensors; t++) {
    // Name
    const nameLen = view.getUint8(offset);
    offset += 1;
    let name = "";
    for (let i = 0; i < nameLen; i++) {
      name += String.fromCharCode(view.getUint8(offset + i));
    }
    offset += nameLen;

    // Shape
    const ndim = view.getUint8(offset);
    offset += 1;
    const shape: number[] = [];
    for (let i = 0; i < ndim; i++) {
      shape.push(view.getUint32(offset, true));
      offset += 4;
    }

    // Data
    const dataByteLen = view.getUint32(offset, true);
    offset += 4;

    // Ensure 4-byte alignment for Float32Array
    const floatCount = dataByteLen / 4;
    const data = new Float32Array(floatCount);
    for (let i = 0; i < floatCount; i++) {
      data[i] = view.getFloat32(offset + i * 4, true);
    }
    offset += dataByteLen;

    tensors[name] = { shape, data };
  }

  return { config, tensors };
}

// --- Linear Algebra Ops ---

/**
 * Maxout: W @ input + b, then take max over pieces dimension
 * W shape: (outWidth * pieces, inWidth)
 * b shape: (outWidth * pieces,)
 * input shape: (inWidth,)
 * output shape: (outWidth,)
 */
function maxout(
  W: Float32Array,
  b: Float32Array,
  input: Float32Array,
  outWidth: number,
  pieces: number,
  inWidth: number,
  output: Float32Array,
): void {
  // W is stored as (outWidth * pieces, inWidth) row-major
  for (let o = 0; o < outWidth; o++) {
    let maxVal = -Infinity;
    for (let p = 0; p < pieces; p++) {
      const rowIdx = o * pieces + p;
      let val = b[rowIdx]!;
      const rowOffset = rowIdx * inWidth;
      for (let i = 0; i < inWidth; i++) {
        val += W[rowOffset + i]! * input[i]!;
      }
      if (val > maxVal) maxVal = val;
    }
    output[o] = maxVal;
  }
}

/**
 * Batch maxout for N tokens
 */
function maxoutBatch(
  W: Float32Array,
  b: Float32Array,
  inputs: Float32Array,
  N: number,
  outWidth: number,
  pieces: number,
  inWidth: number,
  outputs: Float32Array,
): void {
  const singleInput = new Float32Array(inWidth);
  const singleOutput = new Float32Array(outWidth);
  for (let n = 0; n < N; n++) {
    singleInput.set(inputs.subarray(n * inWidth, n * inWidth + inWidth));
    maxout(W, b, singleInput, outWidth, pieces, inWidth, singleOutput);
    outputs.set(singleOutput, n * outWidth);
  }
}

/**
 * Layer normalization
 */
function layernorm(
  x: Float32Array,
  G: Float32Array,
  bLn: Float32Array,
  N: number,
  width: number,
): void {
  for (let n = 0; n < N; n++) {
    const off = n * width;
    // mean
    let sum = 0;
    for (let i = 0; i < width; i++) sum += x[off + i]!;
    const mean = sum / width;
    // variance
    let varSum = 0;
    for (let i = 0; i < width; i++) {
      const d = x[off + i]! - mean;
      varSum += d * d;
    }
    const invStd = 1 / Math.sqrt(varSum / width + 1e-12);
    // normalize
    for (let i = 0; i < width; i++) {
      x[off + i] = G[i]! * ((x[off + i]! - mean) * invStd) + bLn[i]!;
    }
  }
}

/**
 * expand_window: concat(x[i-1], x[i], x[i+1])
 */
function expandWindow(
  x: Float32Array,
  N: number,
  width: number,
  output: Float32Array,
): void {
  for (let n = 0; n < N; n++) {
    const outOff = n * width * 3;
    // left
    if (n > 0) {
      output.set(x.subarray((n - 1) * width, n * width), outOff);
    } else {
      output.fill(0, outOff, outOff + width);
    }
    // center
    output.set(x.subarray(n * width, (n + 1) * width), outOff + width);
    // right
    if (n < N - 1) {
      output.set(x.subarray((n + 1) * width, (n + 2) * width), outOff + width * 2);
    } else {
      output.fill(0, outOff + width * 2, outOff + width * 3);
    }
  }
}

// --- tok2vec ---

function runTok2Vec(
  features: TokenFeatures,
  tensors: Tensors,
  config: NERModelConfig,
): Float32Array {
  const N = features.tokens.length;
  if (N === 0) return new Float32Array(0);

  const width = config.width; // 128
  const pieces = config.maxoutPiecesTok2vec; // 3

  // 1. HashEmbed
  const embedNorm = tensors["tok2vec.embed_norm.E"]!;
  const embedPrefix = tensors["tok2vec.embed_prefix.E"]!;
  const embedSuffix = tensors["tok2vec.embed_suffix.E"]!;
  const embedShape = tensors["tok2vec.embed_shape.E"]!;

  const embedSizes = config.embedSizes; // [2000, 1000, 1000, 1000]
  const concatWidth = width * 4; // 512
  const concat = new Float32Array(N * concatWidth);

  for (let n = 0; n < N; n++) {
    const hashNorm = features.hashes[n * 4]!;
    const hashPrefix = features.hashes[n * 4 + 1]!;
    const hashSuffix = features.hashes[n * 4 + 2]!;
    const hashShape = features.hashes[n * 4 + 3]!;

    const idxNorm = Number(hashNorm % BigInt(embedSizes[0]!));
    const idxPrefix = Number(hashPrefix % BigInt(embedSizes[1]!));
    const idxSuffix = Number(hashSuffix % BigInt(embedSizes[2]!));
    const idxShape = Number(hashShape % BigInt(embedSizes[3]!));

    const outOff = n * concatWidth;
    concat.set(embedNorm.data.subarray(idxNorm * width, idxNorm * width + width), outOff);
    concat.set(embedPrefix.data.subarray(idxPrefix * width, idxPrefix * width + width), outOff + width);
    concat.set(embedSuffix.data.subarray(idxSuffix * width, idxSuffix * width + width), outOff + width * 2);
    concat.set(embedShape.data.subarray(idxShape * width, idxShape * width + width), outOff + width * 3);
  }

  // 2. Mixing layer: maxout + layernorm
  const mixW = tensors["tok2vec.mix.maxout.W"]!;
  const mixB = tensors["tok2vec.mix.maxout.b"]!;
  const mixLnG = tensors["tok2vec.mix.ln.G"]!;
  const mixLnB = tensors["tok2vec.mix.ln.b"]!;

  const x = new Float32Array(N * width);
  maxoutBatch(mixW.data, mixB.data, concat, N, width, pieces, concatWidth, x);
  layernorm(x, mixLnG.data, mixLnB.data, N, width);

  // 3. CNN layers (residual)
  const depth = config.depth; // 4
  const windowedWidth = width * 3; // 384
  const windowed = new Float32Array(N * windowedWidth);
  const y = new Float32Array(N * width);

  for (let d = 0; d < depth; d++) {
    const cnnW = tensors[`tok2vec.cnn.${d}.maxout.W`]!;
    const cnnB = tensors[`tok2vec.cnn.${d}.maxout.b`]!;
    const cnnLnG = tensors[`tok2vec.cnn.${d}.ln.G`]!;
    const cnnLnB = tensors[`tok2vec.cnn.${d}.ln.b`]!;

    expandWindow(x, N, width, windowed);
    maxoutBatch(cnnW.data, cnnB.data, windowed, N, width, pieces, windowedWidth, y);
    layernorm(y, cnnLnG.data, cnnLnB.data, N, width);

    // residual
    for (let i = 0; i < N * width; i++) {
      x[i] += y[i]!;
    }
  }

  return x;
}

// --- NER Transition-Based Parser ---

interface ParserState {
  stack: number[];
  buffer: number[];
  entities: Array<{ start: number; end: number; label: string }>;
  /** Current entity label being built (B-X or I-X active) */
  currentLabel: string | null;
}

function runNER(
  tok2vecOutput: Float32Array,
  features: TokenFeatures,
  tensors: Tensors,
  config: NERModelConfig,
): NEREntity[] {
  const N = features.tokens.length;
  if (N === 0) return [];

  const width = config.width; // 128
  const hiddenWidth = config.hiddenWidth; // 64
  const nF = config.nFeatures; // 3
  const nerPieces = config.maxoutPiecesNer; // 2
  const moves = config.moves;
  const nMoves = moves.length;

  // Lower projection: tok2vec → hidden
  const lowerW = tensors["ner.lower.W"]!;
  const lowerB = tensors["ner.lower.b"]!;

  // token_feats[i] = lowerW @ tok2vec[i] + lowerB → (hiddenWidth,)
  const tokenFeats = new Float32Array(N * hiddenWidth);
  for (let n = 0; n < N; n++) {
    for (let h = 0; h < hiddenWidth; h++) {
      let val = lowerB.data[h]!;
      const rowOff = h * width;
      const tokOff = n * width;
      for (let w = 0; w < width; w++) {
        val += lowerW.data[rowOff + w]! * tok2vecOutput[tokOff + w]!;
      }
      tokenFeats[n * hiddenWidth + h] = val;
    }
  }

  // Precompute: for each token and each feature position
  // precomp_W[f] shape: (hiddenWidth, nerPieces, hiddenWidth)
  // precomputed[n][f] shape: (hiddenWidth, nerPieces)
  const precompW = tensors["ner.precomp.W"]!;
  const precompB = tensors["ner.precomp.b"]!;
  const precompPad = tensors["ner.precomp.pad"]!;

  // precompW shape: (nF, hiddenWidth, nerPieces, hiddenWidth) stored flat
  // precomputed: (N, nF, hiddenWidth * nerPieces)
  const precomputedSize = hiddenWidth * nerPieces;
  const precomputed = new Float32Array(N * nF * precomputedSize);

  for (let n = 0; n < N; n++) {
    for (let f = 0; f < nF; f++) {
      for (let h = 0; h < hiddenWidth; h++) {
        for (let p = 0; p < nerPieces; p++) {
          // precompW index: [f][h][p][i] → f * (hiddenWidth * nerPieces * hiddenWidth) + h * (nerPieces * hiddenWidth) + p * hiddenWidth + i
          const wBase = f * (hiddenWidth * nerPieces * hiddenWidth) + h * (nerPieces * hiddenWidth) + p * hiddenWidth;
          let val = 0;
          for (let i = 0; i < hiddenWidth; i++) {
            val += precompW.data[wBase + i]! * tokenFeats[n * hiddenWidth + i]!;
          }
          precomputed[n * nF * precomputedSize + f * precomputedSize + h * nerPieces + p] = val;
        }
      }
    }
  }

  // Upper layer
  const upperW = tensors["ner.upper.W"]!;
  const upperB = tensors["ner.upper.b"]!;

  // Greedy transition parsing
  const state: ParserState = {
    stack: [],
    buffer: Array.from({ length: N }, (_, i) => i),
    entities: [],
    currentLabel: null,
  };

  const hidden = new Float32Array(precomputedSize);
  const activated = new Float32Array(hiddenWidth);
  const scores = new Float32Array(nMoves);

  // Track scores for entities
  const tokenScores = new Float32Array(N);
  tokenScores.fill(0);

  while (state.buffer.length > 0 || state.stack.length > 0) {
    const s0 = state.stack.length > 0 ? state.stack[state.stack.length - 1]! : -1;
    const b0 = state.buffer.length > 0 ? state.buffer[0]! : -1;

    // Find entity end token
    let entEnd = -1;
    if (state.currentLabel !== null && state.stack.length > 0) {
      entEnd = state.stack[state.stack.length - 1]!;
    }

    // Sum precomputed features
    hidden.fill(0);

    // s0 feature (position 0)
    if (s0 >= 0) {
      const src = s0 * nF * precomputedSize; // feature position 0
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precomputed[src + i]!;
    } else {
      // pad[0]
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precompPad.data[i]!;
    }

    // b0 feature (position 1)
    if (b0 >= 0) {
      const src = b0 * nF * precomputedSize + 1 * precomputedSize;
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precomputed[src + i]!;
    } else {
      const padOff = precomputedSize;
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precompPad.data[padOff + i]!;
    }

    // entEnd feature (position 2)
    if (entEnd >= 0) {
      const src = entEnd * nF * precomputedSize + 2 * precomputedSize;
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precomputed[src + i]!;
    } else {
      const padOff = 2 * precomputedSize;
      for (let i = 0; i < precomputedSize; i++) hidden[i] += precompPad.data[padOff + i]!;
    }

    // Add bias
    for (let i = 0; i < precomputedSize; i++) hidden[i] += precompB.data[i]!;

    // Maxout activation: (hiddenWidth, nerPieces) → (hiddenWidth,)
    for (let h = 0; h < hiddenWidth; h++) {
      let maxVal = -Infinity;
      for (let p = 0; p < nerPieces; p++) {
        const val = hidden[h * nerPieces + p]!;
        if (val > maxVal) maxVal = val;
      }
      activated[h] = maxVal;
    }

    // Upper layer: scores = upperW @ activated + upperB
    for (let m = 0; m < nMoves; m++) {
      let val = upperB.data[m]!;
      const rowOff = m * hiddenWidth;
      for (let h = 0; h < hiddenWidth; h++) {
        val += upperW.data[rowOff + h]! * activated[h]!;
      }
      scores[m] = val;
    }

    // Find best valid action
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let m = 0; m < nMoves; m++) {
      if (!isValidAction(moves[m]!, state)) continue;
      if (scores[m]! > bestScore) {
        bestScore = scores[m]!;
        bestIdx = m;
      }
    }

    if (bestIdx === -1) {
      // No valid action — force O or break
      if (state.buffer.length > 0) {
        state.buffer.shift();
      } else {
        break;
      }
      continue;
    }

    const action = moves[bestIdx]!;
    applyAction(state, action, bestScore, tokenScores);
  }

  // Convert entities to NEREntity[]
  return state.entities.map((ent) => {
    const startChar = features.tokens[ent.start]!.start;
    const endChar = features.tokens[ent.end]!.end;
    // Average score over tokens in entity
    let scoreSum = 0;
    let count = 0;
    for (let t = ent.start; t <= ent.end; t++) {
      scoreSum += tokenScores[t]!;
      count++;
    }
    return {
      text: features.tokens
        .slice(ent.start, ent.end + 1)
        .map((t) => t.text)
        .join(""),
      label: ent.label,
      start: startChar,
      end: endChar,
      score: count > 0 ? scoreSum / count : 0,
    };
  });
}

function isValidAction(action: string, state: ParserState): boolean {
  const inEntity = state.currentLabel !== null;
  const hasBuffer = state.buffer.length > 0;

  if (action === "O") {
    return !inEntity && hasBuffer;
  }

  if (action.startsWith("B-")) {
    return !inEntity && hasBuffer;
  }

  if (action.startsWith("U-")) {
    return !inEntity && hasBuffer;
  }

  if (action.startsWith("I-")) {
    if (!inEntity) return false;
    const label = action.slice(2);
    return state.currentLabel === label && hasBuffer;
  }

  if (action.startsWith("L-")) {
    if (!inEntity) return false;
    const label = action.slice(2);
    return state.currentLabel === label;
  }

  return false;
}

function applyAction(
  state: ParserState,
  action: string,
  score: number,
  tokenScores: Float32Array,
): void {
  if (action === "O") {
    const tok = state.buffer.shift()!;
    tokenScores[tok] = score;
    return;
  }

  if (action.startsWith("B-")) {
    const label = action.slice(2);
    const tok = state.buffer.shift()!;
    state.stack.push(tok);
    state.currentLabel = label;
    tokenScores[tok] = score;
    return;
  }

  if (action.startsWith("I-")) {
    const tok = state.buffer.shift()!;
    state.stack.push(tok);
    tokenScores[tok] = score;
    return;
  }

  if (action.startsWith("L-")) {
    const label = action.slice(2);
    // If there are tokens in buffer, the last token of entity is from buffer
    // Otherwise, we close what's on the stack
    if (state.buffer.length > 0) {
      const tok = state.buffer.shift()!;
      state.stack.push(tok);
      tokenScores[tok] = score;
    }
    const startTok = state.stack[0]!;
    const endTok = state.stack[state.stack.length - 1]!;
    state.entities.push({ start: startTok, end: endTok, label });
    state.stack.length = 0;
    state.currentLabel = null;
    return;
  }

  if (action.startsWith("U-")) {
    const label = action.slice(2);
    const tok = state.buffer.shift()!;
    tokenScores[tok] = score;
    state.entities.push({ start: tok, end: tok, label });
    return;
  }
}

// --- Public API ---

/**
 * PNERバイナリからNERモデルをロードする。
 */
export function loadNERModel(buffer: ArrayBuffer): NERModel {
  const { config, tensors } = parsePNER(buffer);

  function predict(text: string): NEREntity[] {
    const features = tokenize(text);
    if (features.tokens.length === 0) return [];

    const tok2vecOutput = runTok2Vec(features, tensors, config);
    return runNER(tok2vecOutput, features, tensors, config);
  }

  function predictWithFeatures(features: TokenFeatures): NEREntity[] {
    if (features.tokens.length === 0) return [];

    const tok2vecOutput = runTok2Vec(features, tensors, config);
    return runNER(tok2vecOutput, features, tensors, config);
  }

  function dispose(): void {
    // Float32Arraysはすべてクロージャ参照のみ。
    // GCに任せるが、明示的にnull化はできないため空実装。
  }

  return {
    config,
    predict,
    predictWithFeatures,
    dispose,
  };
}
