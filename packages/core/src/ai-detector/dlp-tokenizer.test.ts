import { describe, it, expect } from "vitest";
import {
  murmurhash3_x64_128_uint64,
  hashEmbedIndices,
  HASH_EMBED_SEEDS,
} from "./dlp-tokenizer.js";

describe("murmurhash3_x64_128_uint64", () => {
  it("produces correct hash for spaCy reference value (田中 NORM hash, seed=8)", () => {
    // val = spaCy hash_string("田中") = 15402563338817210201
    const result = murmurhash3_x64_128_uint64(15402563338817210201n, 8);
    expect(result).toEqual([371344852, 1629207481, 2704500926, 2443811221]);
  });

  it("returns different results for different seeds", () => {
    const val = 15402563338817210201n;
    const r8 = murmurhash3_x64_128_uint64(val, 8);
    const r9 = murmurhash3_x64_128_uint64(val, 9);
    expect(r8).not.toEqual(r9);
  });

  it("returns different results for different keys", () => {
    const r1 = murmurhash3_x64_128_uint64(12345n, 8);
    const r2 = murmurhash3_x64_128_uint64(67890n, 8);
    expect(r1).not.toEqual(r2);
  });

  it("handles zero key", () => {
    const result = murmurhash3_x64_128_uint64(0n, 0);
    expect(result).toHaveLength(4);
    result.forEach((v) => expect(typeof v).toBe("number"));
  });
});

describe("hashEmbedIndices", () => {
  it("produces correct indices mod 2000 for reference value", () => {
    const indices = hashEmbedIndices(15402563338817210201n, 8, 2000);
    expect(indices).toEqual([852, 1481, 926, 1221]);
  });

  it("all indices are within table size", () => {
    const tableSize = 1000;
    const indices = hashEmbedIndices(15402563338817210201n, 8, tableSize);
    indices.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(tableSize);
    });
  });
});

describe("HASH_EMBED_SEEDS", () => {
  it("has 4 seeds matching spaCy convention", () => {
    expect(HASH_EMBED_SEEDS).toEqual([8, 9, 10, 11]);
  });
});
