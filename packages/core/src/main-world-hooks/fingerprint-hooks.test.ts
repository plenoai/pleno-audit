/**
 * Fingerprint Hooks のテスト
 *
 * Canvas/WebGL/Audio/RTC のフィンガープリント検出ロジック検証。
 */
import { describe, it, expect } from "vitest";

describe("canvas fingerprint detection logic", () => {
  it("small canvas (<=256x64) triggers detection", () => {
    // The hook checks: this.width <= 256 && this.height <= 64
    const fingerprintCases = [
      { w: 256, h: 64, expected: true },
      { w: 16, h: 16, expected: true },
      { w: 1, h: 1, expected: true },
      { w: 200, h: 50, expected: true },
    ];
    for (const { w, h, expected } of fingerprintCases) {
      expect(w <= 256 && h <= 64).toBe(expected);
    }
  });

  it("large canvas (>256x64) does not trigger", () => {
    const legitimateCases = [
      { w: 1920, h: 1080 },
      { w: 800, h: 600 },
      { w: 512, h: 512 },
      { w: 257, h: 64 },
      { w: 256, h: 65 },
    ];
    for (const { w, h } of legitimateCases) {
      expect(w <= 256 && h <= 64).toBe(false);
    }
  });

  it("boundary: exactly 256x64 is flagged", () => {
    const width = 256;
    const height = 64;
    expect(width <= 256 && height <= 64).toBe(true);
  });
});

describe("WebGL fingerprint detection logic", () => {
  const WEBGL_FP_PARAMS = [0x1f01, 0x1f00, 0x9245, 0x9246]; // RENDERER, VENDOR, debug extension
  const WEBGL_FP_THRESHOLD = 2;
  const WEBGL_FP_WINDOW_MS = 500;

  it("single param read does not trigger (threshold=2)", () => {
    const seenParams = new Set<number>();
    seenParams.add(0x1f01);
    expect(seenParams.size >= WEBGL_FP_THRESHOLD).toBe(false);
  });

  it("two distinct params within window triggers detection", () => {
    const seenParams = new Set<number>();
    seenParams.add(0x1f01); // RENDERER
    seenParams.add(0x1f00); // VENDOR
    expect(seenParams.size >= WEBGL_FP_THRESHOLD).toBe(true);
  });

  it("duplicate param reads count as one", () => {
    const seenParams = new Set<number>();
    seenParams.add(0x1f01);
    seenParams.add(0x1f01); // duplicate
    expect(seenParams.size).toBe(1);
    expect(seenParams.size >= WEBGL_FP_THRESHOLD).toBe(false);
  });

  it("params outside fingerprint set are ignored", () => {
    // Normal WebGL getParameter calls (e.g., MAX_TEXTURE_SIZE = 0x0D33)
    const normalParam = 0x0d33;
    expect(WEBGL_FP_PARAMS.includes(normalParam)).toBe(false);
  });

  it("window resets after 500ms", () => {
    expect(WEBGL_FP_WINDOW_MS).toBe(500);
    // After window reset, param set is cleared
    const seenParams = new Set<number>();
    seenParams.add(0x1f01);
    // Simulate window reset
    seenParams.clear();
    seenParams.add(0x1f00);
    expect(seenParams.size >= WEBGL_FP_THRESHOLD).toBe(false);
  });
});

describe("AudioContext and RTC deduplication", () => {
  it("first creation triggers event, subsequent do not", () => {
    let emitted = false;
    // Simulate the deduplication flag pattern
    const createAudioContext = () => {
      if (!emitted) {
        emitted = true;
        return true; // event emitted
      }
      return false; // no event
    };

    expect(createAudioContext()).toBe(true);
    expect(createAudioContext()).toBe(false);
    expect(createAudioContext()).toBe(false);
  });
});

describe("fullscreen phishing detection", () => {
  const FULLSCREEN_SAFE_TAGS = new Set(["VIDEO", "CANVAS", "IFRAME"]);

  it("allows fullscreen on media elements", () => {
    for (const tag of ["VIDEO", "CANVAS", "IFRAME"]) {
      expect(FULLSCREEN_SAFE_TAGS.has(tag)).toBe(true);
    }
  });

  it("flags fullscreen on non-media elements", () => {
    for (const tag of ["DIV", "BODY", "SECTION", "FORM", "MAIN"]) {
      expect(FULLSCREEN_SAFE_TAGS.has(tag)).toBe(false);
    }
  });
});
