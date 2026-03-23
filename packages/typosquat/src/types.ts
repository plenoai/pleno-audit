/**
 * Typosquatting Detection Types
 *
 * ホモグリフ（視覚的に類似した文字）を検出し、
 * IDN Homograph Attack等のタイポスクワッティングを判定する。
 */

/**
 * ホモグリフの種類
 */
export type HomoglyphType =
  | "latin_digit" // l→1, O→0
  | "latin_sequence" // rn→m, vv→w
  | "cyrillic" // キリル文字偽装
  | "greek" // ギリシャ文字偽装
  | "japanese" // 日本語文字悪用
  | "mixed_script"; // 混在スクリプト

/**
 * 検出されたホモグリフの詳細
 */
export interface HomoglyphMatch {
  /** 元の文字 */
  original: string;
  /** 置換された可能性のある文字 */
  possibleReplacement: string;
  /** 位置（ドメイン内のインデックス） */
  position: number;
  /** ホモグリフの種類 */
  type: HomoglyphType;
}

/**
 * Unicodeスクリプトの種類
 */
export type ScriptType =
  | "latin"
  | "cyrillic"
  | "greek"
  | "hiragana"
  | "katakana"
  | "cjk"
  | "unknown";

/**
 * スコア内訳
 */
export interface ScoreBreakdown {
  latinHomoglyphs: number;
  cyrillicHomoglyphs: number;
  greekHomoglyphs: number;
  japaneseHomoglyphs: number;
  mixedScript: number;
  punycode: number;
}

/**
 * ヒューリスティックスコア
 */
export interface TyposquatScores {
  /** 検出されたホモグリフ一覧 */
  homoglyphs: HomoglyphMatch[];
  /** 混在スクリプトが検出されたか */
  hasMixedScript: boolean;
  /** 使用されているスクリプト一覧 */
  detectedScripts: ScriptType[];
  /** Punycodeドメインか */
  isPunycode: boolean;
  /** 総合スコア (0-100) */
  totalScore: number;
  /** 各カテゴリのスコア内訳 */
  breakdown: ScoreBreakdown;
}

/**
 * 検出メソッド
 */
export type TyposquatDetectionMethod = "heuristic" | "cache" | "error";

/**
 * 信頼度レベル
 */
export type TyposquatConfidence = "high" | "medium" | "low" | "none";

/**
 * タイポスクワッティング検出結果
 */
export interface TyposquatResult {
  domain: string;
  /** タイポスクワッティングの疑いがあるか */
  isTyposquat: boolean;
  /** 信頼度 */
  confidence: TyposquatConfidence;
  /** 検出メソッド */
  method: TyposquatDetectionMethod;
  /** ヒューリスティック分析結果 */
  heuristics: TyposquatScores;
  /** チェック日時 */
  checkedAt: number;
  /** 正規化後のドメイン（Punycode解除等） */
  normalizedDomain: string;
}

/**
 * タイポスクワッティング検出設定
 */
export interface TyposquatConfig {
  enabled: boolean;
  /** ヒューリスティック閾値 (0-100) */
  heuristicThreshold: number;
  /** キャッシュ有効期限 (ms) */
  cacheExpiry: number;
  /** 日本語ホモグリフ検出を有効化 */
  detectJapaneseHomoglyphs: boolean;
  /** Punycodeドメインを警告 */
  warnOnPunycode: boolean;
}

/**
 * デフォルト設定
 */
export const DEFAULT_TYPOSQUAT_CONFIG: TyposquatConfig = {
  enabled: true,
  heuristicThreshold: 30,
  cacheExpiry: 86400000, // 24時間
  detectJapaneseHomoglyphs: true,
  warnOnPunycode: true,
};

/**
 * タイポスクワッティング検出イベントの詳細
 */
export interface TyposquatDetectedDetails {
  isTyposquat: boolean;
  confidence: TyposquatConfidence;
  totalScore: number;
  homoglyphCount: number;
  hasMixedScript: boolean;
  detectedScripts: string[];
}
