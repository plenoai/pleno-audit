/**
 * @pleno-audit/typosquat
 *
 * タイポスクワッティング検出パッケージ
 * ホモグリフ（視覚的に類似した文字）を検出し、IDN Homograph Attack等を判定
 */

// Types
export type {
  HomoglyphType,
  HomoglyphMatch,
  ScriptType,
  ScoreBreakdown,
  TyposquatScores,
  TyposquatDetectionMethod,
  TyposquatConfidence,
  TyposquatResult,
  TyposquatConfig,
  TyposquatDetectedDetails,
} from "./types.js";

export { DEFAULT_TYPOSQUAT_CONFIG } from "./types.js";

// Heuristics
export {
  LATIN_HOMOGLYPHS,
  CYRILLIC_TO_LATIN,
  GREEK_TO_LATIN,
  JAPANESE_HOMOGLYPHS,
  getCharacterScript,
  detectScripts,
  isSuspiciousMixedScript,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  detectGreekHomoglyphs,
  detectJapaneseHomoglyphs,
  isPunycodeDomain,
  decodePunycode,
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
} from "./heuristics.js";

// Detector
export type { TyposquatCache } from "./detector.js";
export { createTyposquatDetector } from "./detector.js";
