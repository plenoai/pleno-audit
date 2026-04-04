/**
 * DLP Tokenizer
 *
 * 日本語テキストを文字クラスベースでトークン化し、
 * spaCy互換のハッシュ特徴量を計算する。
 *
 * ハッシュ関数はmurmurhash2_64a (seed=1, UTF-8バイト列)を使用。
 * spaCyのhash_stringと完全一致する。
 */

// --- MurmurHash2 64-bit (murmurhash2_64a) ---

const MURMUR_M = 0xc6a4a7935bd1e995n;
const MURMUR_R = 47n;
const MASK64 = 0xffffffffffffffffn;

function mul64(a: bigint, b: bigint): bigint {
  return (a * b) & MASK64;
}

/**
 * murmurhash2_64a — spaCy互換ハッシュ関数
 *
 * spaCyのhash_string("田中") = 15402563338817210201 と一致する。
 */
export function murmurhash2_64a(data: Uint8Array, seed: bigint = 1n): bigint {
  const len = data.length;
  let h = (seed ^ mul64(BigInt(len), MURMUR_M)) & MASK64;

  // 8バイトブロック処理
  const nBlocks = (len >> 3) | 0;
  for (let i = 0; i < nBlocks; i++) {
    const offset = i * 8;
    let k = 0n;
    for (let j = 0; j < 8; j++) {
      k |= BigInt(data[offset + j]!) << BigInt(j * 8);
    }
    k = mul64(k, MURMUR_M);
    k ^= k >> MURMUR_R;
    k = mul64(k, MURMUR_M);
    h ^= k;
    h = mul64(h, MURMUR_M);
  }

  // 残りバイト処理
  const tail = nBlocks * 8;
  const remaining = len & 7;
  for (let i = remaining - 1; i >= 0; i--) {
    h ^= BigInt(data[tail + i]!) << BigInt(i * 8);
  }
  if (remaining > 0) {
    h = mul64(h, MURMUR_M);
  }

  // 最終ミキシング
  h ^= h >> MURMUR_R;
  h = mul64(h, MURMUR_M);
  h ^= h >> MURMUR_R;

  return h;
}

// --- 文字クラス分類 ---

const enum CharClass {
  Kanji,
  Hiragana,
  Katakana,
  Ascii,
  Symbol,
}

function classifyChar(code: number): CharClass {
  // ひらがな U+3040-U+309F
  if (code >= 0x3040 && code <= 0x309f) return CharClass.Hiragana;
  // カタカナ U+30A0-U+30FF
  if (code >= 0x30a0 && code <= 0x30ff) return CharClass.Katakana;
  // 半角カタカナ U+FF65-U+FF9F
  if (code >= 0xff65 && code <= 0xff9f) return CharClass.Katakana;
  // CJK統合漢字 U+4E00-U+9FFF
  if (code >= 0x4e00 && code <= 0x9fff) return CharClass.Kanji;
  // CJK統合漢字拡張A U+3400-U+4DBF
  if (code >= 0x3400 && code <= 0x4dbf) return CharClass.Kanji;
  // CJK統合漢字拡張B以降 (surrogate pairs will give code > 0xFFFF)
  if (code >= 0x20000 && code <= 0x2a6df) return CharClass.Kanji;
  // ASCII英数字
  if (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) // a-z
  ) {
    return CharClass.Ascii;
  }
  // 全角英数字 → ASCIIとして扱う（正規化後）
  if (code >= 0xff10 && code <= 0xff19) return CharClass.Ascii; // ０-９
  if (code >= 0xff21 && code <= 0xff3a) return CharClass.Ascii; // Ａ-Ｚ
  if (code >= 0xff41 && code <= 0xff5a) return CharClass.Ascii; // ａ-ｚ

  return CharClass.Symbol;
}

// --- トークナイザ ---

export interface Token {
  text: string;
  start: number;
  end: number;
}

export interface TokenFeatures {
  tokens: Token[];
  /** [nTokens * 4] — NORM, PREFIX, SUFFIX, SHAPE per token */
  hashes: BigUint64Array;
}

// --- MurmurHash3 x64 128-bit (for HashEmbed 4-hash sum) ---

const C1 = 0x87c37b91114253d5n;
const C2 = 0x4cf5ad432745937fn;

function rotl64(x: bigint, r: bigint): bigint {
  return ((x << r) | (x >> (64n - r))) & MASK64;
}

function fmix64(h: bigint): bigint {
  h ^= h >> 33n;
  h = (h * 0xff51afd7ed558ccdn) & MASK64;
  h ^= h >> 33n;
  h = (h * 0xc4ceb9fe1a85ec53n) & MASK64;
  h ^= h >> 33n;
  return h;
}

/**
 * MurmurHash3_x64_128 — uint64キーから4つのuint32を生成する。
 * spaCy/ThincのHashEmbed層で使用される4-hash sum方式の基盤。
 *
 * 入力は8バイト(uint64 LE)なので16バイトブロックはなく、
 * 全データがtail処理を通る。
 */
export function murmurhash3_x64_128_uint64(
  key: bigint,
  seed: number,
): [number, number, number, number] {
  const seedBig = BigInt(seed) & MASK64;
  let h1 = seedBig;
  let h2 = seedBig;

  const len = 8n;

  // No 16-byte blocks for 8-byte input.

  // Tail processing: len & 15 == 8, so k1 = the full 8 bytes, k2 = 0
  // The key is already the uint64 LE value.
  let k1 = key & MASK64;
  // k2 remains 0 — no bytes go into k2 for 8-byte input.

  k1 = (k1 * C1) & MASK64;
  k1 = rotl64(k1, 31n);
  k1 = (k1 * C2) & MASK64;
  h1 ^= k1;

  // Finalization
  h1 ^= len;
  h2 ^= len;
  h1 = (h1 + h2) & MASK64;
  h2 = (h2 + h1) & MASK64;
  h1 = fmix64(h1);
  h2 = fmix64(h2);
  h1 = (h1 + h2) & MASK64;
  h2 = (h2 + h1) & MASK64;

  // Split into 4 uint32 values: [h1_lo, h1_hi, h2_lo, h2_hi]
  const h1Lo = Number(h1 & 0xffffffffn);
  const h1Hi = Number((h1 >> 32n) & 0xffffffffn);
  const h2Lo = Number(h2 & 0xffffffffn);
  const h2Hi = Number((h2 >> 32n) & 0xffffffffn);

  return [h1Lo, h1Hi, h2Lo, h2Hi];
}

/** HashEmbed seeds — spaCy/Thincの [NORM, PREFIX, SUFFIX, SHAPE] 用 */
export const HASH_EMBED_SEEDS = [8, 9, 10, 11] as const;

/** Hash入力をHashEmbed用の4インデックスに変換する */
export function hashEmbedIndices(
  hash: bigint,
  seed: number,
  tableSize: number,
): [number, number, number, number] {
  const [h1, h2, h3, h4] = murmurhash3_x64_128_uint64(hash, seed);
  return [
    h1 % tableSize,
    h2 % tableSize,
    h3 % tableSize,
    h4 % tableSize,
  ];
}

const textEncoder = new TextEncoder();

function hashString(s: string): bigint {
  return murmurhash2_64a(textEncoder.encode(s));
}

/**
 * 全角英数字を半角に正規化
 */
function normalizeFullWidth(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // 全角英数字 FF10-FF5A → 半角 0030-005A
    if (code >= 0xff10 && code <= 0xff19) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code >= 0xff21 && code <= 0xff3a) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code >= 0xff41 && code <= 0xff5a) {
      result += String.fromCharCode(code - 0xfee0);
    } else {
      result += text[i]!;
    }
  }
  return result;
}

/**
 * SHAPE特徴量の計算
 * 漢字→x、ひらがな→x、カタカナ→X、英大文字→X、英小文字→x、数字→d、他→自身
 */
function computeShape(text: string): string {
  let shape = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const cls = classifyChar(code);
    switch (cls) {
      case CharClass.Kanji:
      case CharClass.Hiragana:
        shape += "x";
        break;
      case CharClass.Katakana:
        shape += "X";
        break;
      case CharClass.Ascii: {
        // 全角を半角に変換後に判定
        let c = code;
        if (c >= 0xff10 && c <= 0xff5a) c -= 0xfee0;
        if (c >= 0x41 && c <= 0x5a) shape += "X";
        else if (c >= 0x61 && c <= 0x7a) shape += "x";
        else if (c >= 0x30 && c <= 0x39) shape += "d";
        else shape += ch;
        break;
      }
      default:
        shape += ch;
        break;
    }
  }
  return shape;
}

/**
 * テキストを文字クラスベースでトークン化し、spaCy互換のハッシュ特徴量を計算する。
 */
// --- WASM Tokenizer bridge ---

export interface WasmTokenResult {
  text: string;
  start: number;
  end: number;
  hashes_lo: [number, number, number, number];
  hashes_hi: [number, number, number, number];
}

/**
 * WASMトークナイザの結果をTokenFeaturesに変換する。
 * hashes_lo/hashes_hiのu32ペアをBigUint64Arrayに結合。
 */
export function convertWasmTokens(wasmResult: WasmTokenResult[]): TokenFeatures {
  const tokens: Token[] = wasmResult.map((r) => ({
    text: r.text,
    start: r.start,
    end: r.end,
  }));
  const hashes = new BigUint64Array(wasmResult.length * 4);
  for (let i = 0; i < wasmResult.length; i++) {
    const r = wasmResult[i]!;
    for (let j = 0; j < 4; j++) {
      hashes[i * 4 + j] =
        BigInt(r.hashes_lo[j] >>> 0) | (BigInt(r.hashes_hi[j] >>> 0) << 32n);
    }
  }
  return { tokens, hashes };
}

/**
 * テキストを文字クラスベースでトークン化し、spaCy互換のハッシュ特徴量を計算する。
 */
export function tokenize(text: string): TokenFeatures {
  const tokens: Token[] = [];

  if (text.length === 0) {
    return { tokens, hashes: new BigUint64Array(0) };
  }

  // 文字クラスベースの分割
  let i = 0;
  while (i < text.length) {
    const startPos = i;
    const code = text.codePointAt(i)!;
    const charLen = code > 0xffff ? 2 : 1;
    const cls = classifyChar(code);

    if (cls === CharClass.Symbol) {
      // 記号は1文字ずつ
      tokens.push({ text: text.slice(i, i + charLen), start: i, end: i + charLen });
      i += charLen;
    } else {
      // 同じ文字クラスの連続をまとめる
      i += charLen;
      while (i < text.length) {
        const nextCode = text.codePointAt(i)!;
        const nextLen = nextCode > 0xffff ? 2 : 1;
        if (classifyChar(nextCode) !== cls) break;
        i += nextLen;
      }
      tokens.push({ text: text.slice(startPos, i), start: startPos, end: i });
    }
  }

  // 特徴量計算
  const hashes = new BigUint64Array(tokens.length * 4);

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t]!;
    const rawText = tok.text;
    const normalized = normalizeFullWidth(rawText).toLowerCase();

    // NORM: 正規化テキストのハッシュ
    hashes[t * 4] = hashString(normalized);

    // PREFIX: 先頭1文字のハッシュ
    const firstChar = [...normalized][0] ?? "";
    hashes[t * 4 + 1] = hashString(firstChar);

    // SUFFIX: 末尾3文字のハッシュ
    const chars = [...normalized];
    const suffix = chars.length <= 3 ? normalized : chars.slice(-3).join("");
    hashes[t * 4 + 2] = hashString(suffix);

    // SHAPE: 文字種パターンのハッシュ
    hashes[t * 4 + 3] = hashString(computeShape(rawText));
  }

  return { tokens, hashes };
}
