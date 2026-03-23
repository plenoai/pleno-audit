/**
 * Typosquatting Heuristics
 *
 * ドメイン名の文字特性を分析し、ホモグリフ攻撃の可能性を検出する。
 * 外部DBやドメインリストは使用せず、純粋に文字の特徴から判定。
 *
 * スコアリングルール:
 * - シーケンス (rn→m, vv→w, nn→m, uu→w): ラベル先頭のみ30点 (上限50)
 * - 数字 (0→O, 1→l): 文字挟み(letter-digit-letter)30点、片側のみ15点 (上限30)
 *   ラベル先頭の数字はスキップ（自然な命名パターン: 1password, 000webhost等）
 * - キリル文字: 1文字25点 (上限50) + mixed script 40点
 * - ギリシャ文字: 1文字25点 (上限50) + mixed script 40点
 * - 日本語全角: 1文字15点 (上限30)
 * - Punycode: 10点（xn--ラベルのASCII部分はhomoglyph分析対象外）
 * - 閾値: デフォルト30点以上で検出
 */

import type {
  HomoglyphMatch,
  TyposquatScores,
  ScriptType,
  ScoreBreakdown,
  TyposquatConfig,
} from "./types.js";

// ============================================================================
// ホモグリフマッピング
// ============================================================================

/**
 * ラテン文字・数字のホモグリフ
 * 注：通常の文字（l, O等）からの検出は無効化し、
 * 明らかに不自然な文字（0, 1等の数字がドメインに含まれる場合）のみを検出
 */
export const LATIN_HOMOGLYPHS: Map<string, string[]> = new Map([
  // 数字がドメインにある場合のみ検出（より厳密なホモグリフ検出）
  ["0", ["O", "o"]], // 数字の0がドメインにある → O/oの置換かも
  ["1", ["l", "I", "i"]], // 数字の1がドメインにある → l/I/iの置換かも
]);

/**
 * キリル文字→ラテン文字のホモグリフマッピング
 */
export const CYRILLIC_TO_LATIN: Map<string, string> = new Map([
  // 完全一致ホモグリフ
  ["\u0430", "a"], // а → a
  ["\u0435", "e"], // е → e
  ["\u043E", "o"], // о → o
  ["\u0440", "p"], // р → p
  ["\u0441", "c"], // с → c
  ["\u0445", "x"], // х → x
  ["\u0443", "y"], // у → y
  ["\u0456", "i"], // і → i (Ukrainian)
  ["\u0458", "j"], // ј → j
  ["\u04BB", "h"], // һ → h
  // 類似ホモグリフ
  ["\u043A", "k"], // к → k
  ["\u043D", "n"], // н → n
  ["\u0432", "b"], // в → b
  ["\u0433", "r"], // г → r
  ["\u0442", "t"], // т → t (近似)
  ["\u043C", "m"], // м → m (近似)
]);

/**
 * ギリシャ文字→ラテン文字のホモグリフマッピング
 * Latin + Greek の混在は isSuspiciousMixedScript で検出されるが、
 * 個別のホモグリフ検出も行うことでスコアを高精度化
 */
export const GREEK_TO_LATIN: Map<string, string> = new Map([
  ["\u03BF", "o"], // ο (omicron) → o
  ["\u03B1", "a"], // α (alpha) → a (近似)
  ["\u03B5", "e"], // ε (epsilon) → e (近似)
  ["\u03B9", "i"], // ι (iota) → i
  ["\u03BA", "k"], // κ (kappa) → k
  ["\u03BD", "v"], // ν (nu) → v
  ["\u03C1", "p"], // ρ (rho) → p
  ["\u03C4", "t"], // τ (tau) → t (近似)
  ["\u03C5", "u"], // υ (upsilon) → u
  ["\u03C7", "x"], // χ (chi) → x
  ["\u0391", "A"], // Α (Alpha) → A
  ["\u0392", "B"], // Β (Beta) → B
  ["\u0395", "E"], // Ε (Epsilon) → E
  ["\u0397", "H"], // Η (Eta) → H
  ["\u0399", "I"], // Ι (Iota) → I
  ["\u039A", "K"], // Κ (Kappa) → K
  ["\u039C", "M"], // Μ (Mu) → M
  ["\u039D", "N"], // Ν (Nu) → N
  ["\u039F", "O"], // Ο (Omicron) → O
  ["\u03A1", "P"], // Ρ (Rho) → P
  ["\u03A4", "T"], // Τ (Tau) → T
  ["\u03A7", "X"], // Χ (Chi) → X
  ["\u03A5", "Y"], // Υ (Upsilon) → Y
  ["\u0396", "Z"], // Ζ (Zeta) → Z
]);

/**
 * 日本語文字のホモグリフ
 */
export const JAPANESE_HOMOGLYPHS: Map<string, string[]> = new Map([
  // 長音記号・ハイフン類似
  ["\u30FC", ["-"]], // ー (カタカナ長音)
  ["\u2015", ["-"]], // ― (ダッシュ)
  ["\u2014", ["-"]], // — (EMダッシュ)
  ["\u2212", ["-"]], // − (マイナス記号)
  ["\u4E00", ["-"]], // 一 (漢数字)
  // 全角英数字
  ["\uFF10", ["0"]], // ０
  ["\uFF11", ["1"]], // １
  ["\uFF12", ["2"]], // ２
  ["\uFF13", ["3"]], // ３
  ["\uFF14", ["4"]], // ４
  ["\uFF15", ["5"]], // ５
  ["\uFF16", ["6"]], // ６
  ["\uFF17", ["7"]], // ７
  ["\uFF18", ["8"]], // ８
  ["\uFF19", ["9"]], // ９
  ["\uFF21", ["A"]], // Ａ
  ["\uFF22", ["B"]], // Ｂ
  ["\uFF23", ["C"]], // Ｃ
  ["\uFF24", ["D"]], // Ｄ
  ["\uFF25", ["E"]], // Ｅ
  ["\uFF26", ["F"]], // Ｆ
  ["\uFF27", ["G"]], // Ｇ
  ["\uFF28", ["H"]], // Ｈ
  ["\uFF29", ["I"]], // Ｉ
  ["\uFF2A", ["J"]], // Ｊ
  ["\uFF2B", ["K"]], // Ｋ
  ["\uFF2C", ["L"]], // Ｌ
  ["\uFF2D", ["M"]], // Ｍ
  ["\uFF2E", ["N"]], // Ｎ
  ["\uFF2F", ["O"]], // Ｏ
  ["\uFF30", ["P"]], // Ｐ
  ["\uFF31", ["Q"]], // Ｑ
  ["\uFF32", ["R"]], // Ｒ
  ["\uFF33", ["S"]], // Ｓ
  ["\uFF34", ["T"]], // Ｔ
  ["\uFF35", ["U"]], // Ｕ
  ["\uFF36", ["V"]], // Ｖ
  ["\uFF37", ["W"]], // Ｗ
  ["\uFF38", ["X"]], // Ｘ
  ["\uFF39", ["Y"]], // Ｙ
  ["\uFF3A", ["Z"]], // Ｚ
  ["\uFF41", ["a"]], // ａ
  ["\uFF42", ["b"]], // ｂ
  ["\uFF43", ["c"]], // ｃ
  ["\uFF44", ["d"]], // ｄ
  ["\uFF45", ["e"]], // ｅ
  ["\uFF46", ["f"]], // ｆ
  ["\uFF47", ["g"]], // ｇ
  ["\uFF48", ["h"]], // ｈ
  ["\uFF49", ["i"]], // ｉ
  ["\uFF4A", ["j"]], // ｊ
  ["\uFF4B", ["k"]], // ｋ
  ["\uFF4C", ["l"]], // ｌ
  ["\uFF4D", ["m"]], // ｍ
  ["\uFF4E", ["n"]], // ｎ
  ["\uFF4F", ["o"]], // ｏ
  ["\uFF50", ["p"]], // ｐ
  ["\uFF51", ["q"]], // ｑ
  ["\uFF52", ["r"]], // ｒ
  ["\uFF53", ["s"]], // ｓ
  ["\uFF54", ["t"]], // ｔ
  ["\uFF55", ["u"]], // ｕ
  ["\uFF56", ["v"]], // ｖ
  ["\uFF57", ["w"]], // ｗ
  ["\uFF58", ["x"]], // ｘ
  ["\uFF59", ["y"]], // ｙ
  ["\uFF5A", ["z"]], // ｚ
]);

// ============================================================================
// スクリプト検出
// ============================================================================

/**
 * 文字のUnicodeスクリプトを判定
 */
export function getCharacterScript(char: string): ScriptType {
  const code = char.codePointAt(0) || 0;

  // Latin (Basic Latin + Extended)
  if (
    (code >= 0x0041 && code <= 0x005a) || // A-Z
    (code >= 0x0061 && code <= 0x007a) || // a-z
    (code >= 0x00c0 && code <= 0x024f) // Extended
  ) {
    return "latin";
  }

  // Numbers (ASCII)
  if (code >= 0x0030 && code <= 0x0039) {
    return "latin"; // 数字はラテンとして扱う
  }

  // Cyrillic
  if (code >= 0x0400 && code <= 0x04ff) {
    return "cyrillic";
  }

  // Greek
  if (code >= 0x0370 && code <= 0x03ff) {
    return "greek";
  }

  // Hiragana
  if (code >= 0x3040 && code <= 0x309f) {
    return "hiragana";
  }

  // Katakana
  if (code >= 0x30a0 && code <= 0x30ff) {
    return "katakana";
  }

  // CJK Unified Ideographs
  if (code >= 0x4e00 && code <= 0x9fff) {
    return "cjk";
  }

  // Fullwidth forms (全角文字)
  if (code >= 0xff00 && code <= 0xffef) {
    return "cjk"; // 全角は日本語として扱う
  }

  return "unknown";
}

/**
 * ドメイン内の全スクリプトを検出
 */
export function detectScripts(domain: string): Set<ScriptType> {
  const scripts = new Set<ScriptType>();

  for (const char of domain) {
    if (char === "." || char === "-") continue;
    scripts.add(getCharacterScript(char));
  }

  scripts.delete("unknown");
  return scripts;
}

/**
 * 混在スクリプトの危険度を判定
 * Latin + Cyrillic の組み合わせが最も危険
 */
export function isSuspiciousMixedScript(scripts: Set<ScriptType>): boolean {
  // Latin + Cyrillic は IDN Homograph Attack の典型パターン
  if (scripts.has("latin") && scripts.has("cyrillic")) {
    return true;
  }

  // Latin + Greek も危険
  if (scripts.has("latin") && scripts.has("greek")) {
    return true;
  }

  return false;
}

// ============================================================================
// ホモグリフ検出
// ============================================================================

/**
 * ラテン文字のホモグリフを検出
 */
export function detectLatinHomoglyphs(domain: string): HomoglyphMatch[] {
  const matches: HomoglyphMatch[] = [];

  for (let i = 0; i < domain.length; i++) {
    const char = domain[i];
    const homoglyphs = LATIN_HOMOGLYPHS.get(char);

    if (homoglyphs) {
      for (const replacement of homoglyphs) {
        matches.push({
          original: char,
          possibleReplacement: replacement,
          position: i,
          type: "latin_digit",
        });
      }
    }
  }

  // シーケンス検出 (rn, vv, nn, uu)
  // cl→d は除外: clで始まる英単語が多すぎ (click, clean, cloud...) 、視覚的類似性も弱い
  const sequences = [
    { pattern: "rn", replacement: "m" },
    { pattern: "vv", replacement: "w" },
    { pattern: "nn", replacement: "m" },
    { pattern: "uu", replacement: "w" },
  ];

  for (const seq of sequences) {
    let idx = domain.indexOf(seq.pattern);
    while (idx !== -1) {
      matches.push({
        original: seq.pattern,
        possibleReplacement: seq.replacement,
        position: idx,
        type: "latin_sequence",
      });
      idx = domain.indexOf(seq.pattern, idx + 1);
    }
  }

  return matches;
}

/**
 * キリル文字のホモグリフを検出
 */
export function detectCyrillicHomoglyphs(domain: string): HomoglyphMatch[] {
  const matches: HomoglyphMatch[] = [];

  for (let i = 0; i < domain.length; i++) {
    const char = domain[i];
    const latinEquiv = CYRILLIC_TO_LATIN.get(char);

    if (latinEquiv) {
      matches.push({
        original: char,
        possibleReplacement: latinEquiv,
        position: i,
        type: "cyrillic",
      });
    }
  }

  return matches;
}

/**
 * ギリシャ文字のホモグリフを検出
 */
export function detectGreekHomoglyphs(domain: string): HomoglyphMatch[] {
  const matches: HomoglyphMatch[] = [];

  for (let i = 0; i < domain.length; i++) {
    const char = domain[i];
    const latinEquiv = GREEK_TO_LATIN.get(char);

    if (latinEquiv) {
      matches.push({
        original: char,
        possibleReplacement: latinEquiv,
        position: i,
        type: "greek",
      });
    }
  }

  return matches;
}

/**
 * 日本語ホモグリフを検出
 */
export function detectJapaneseHomoglyphs(domain: string): HomoglyphMatch[] {
  const matches: HomoglyphMatch[] = [];

  for (let i = 0; i < domain.length; i++) {
    const char = domain[i];
    const homoglyphs = JAPANESE_HOMOGLYPHS.get(char);

    if (homoglyphs) {
      for (const replacement of homoglyphs) {
        matches.push({
          original: char,
          possibleReplacement: replacement,
          position: i,
          type: "japanese",
        });
      }
    }
  }

  return matches;
}

// ============================================================================
// Punycode 処理
// ============================================================================

/**
 * Punycodeドメインを検出
 * 各ラベル（ドットで区切られた部分）がxn--で始まるかをチェック
 */
export function isPunycodeDomain(domain: string): boolean {
  return domain.split(".").some((label) => label.startsWith("xn--"));
}

/**
 * Punycodeをデコード
 */
export function decodePunycode(domain: string): string {
  try {
    const url = new URL(`https://${domain}`);
    return url.hostname;
  } catch {
    return domain;
  }
}

// ============================================================================
// スコア計算
// ============================================================================

/**
 * 総合ヒューリスティックスコアを計算
 */
export function calculateTyposquatHeuristics(
  domain: string,
  config: TyposquatConfig
): TyposquatScores {
  // Punycode処理
  const isPunycode = isPunycodeDomain(domain);
  const normalizedDomain = isPunycode ? decodePunycode(domain) : domain;

  // スクリプト検出
  const scripts = detectScripts(normalizedDomain);
  const hasMixedScript = isSuspiciousMixedScript(scripts);

  // xn--ラベルを除外したドメインでホモグリフ検出
  // Punycodeエンコード済みラベルのASCII文字は視覚的攻撃ではない
  const analysisLabels = normalizedDomain.split(".");
  const analysisDomain = analysisLabels
    .map(label => label.startsWith("xn--") ? "" : label)
    .join(".");

  // ホモグリフ検出
  const latinHomoglyphs = detectLatinHomoglyphs(analysisDomain);
  const cyrillicHomoglyphs = detectCyrillicHomoglyphs(analysisDomain);
  const greekHomoglyphs = detectGreekHomoglyphs(analysisDomain);
  const japaneseHomoglyphs = config.detectJapaneseHomoglyphs
    ? detectJapaneseHomoglyphs(analysisDomain)
    : [];

  const allHomoglyphs = [
    ...latinHomoglyphs,
    ...cyrillicHomoglyphs,
    ...greekHomoglyphs,
    ...japaneseHomoglyphs,
  ];

  // ラテンシーケンスホモグリフ（rn→m等）をカウント
  const sequenceHomoglyphs = latinHomoglyphs.filter(h => h.type === "latin_sequence");
  const digitHomoglyphs = latinHomoglyphs.filter(h => h.type === "latin_digit");

  // ドメインラベル（ドットで分割）を取得
  const labels = normalizedDomain.split(".");

  // シーケンスはラベル先頭（position 0）のみスコアリング
  // "rnicrosoft" のrn は危険だが "learn" のrn は自然な英語
  const labelStarts = new Set<number>();
  let offset = 0;
  for (const label of labels) {
    labelStarts.add(offset);
    offset += label.length + 1;
  }
  const dangerousSequences = sequenceHomoglyphs.filter(h => labelStarts.has(h.position));

  // 数字は「文字列中に埋め込まれた」もののみスコアリング
  // "g00gle" の0は危険（文字gの後）、"000webhost" の0はラベル先頭で自然
  // 連続する数字はグループとして扱い、グループ前後の文字をチェック
  const embeddedDigitPositions = new Set<number>();
  const surroundedDigitPositions = new Set<number>();

  // ラベルごとに数字グループを判定
  offset = 0;
  for (const label of labels) {
    // このラベル内の数字ホモグリフ位置を収集
    const digitPosInLabel: number[] = [];
    for (const match of digitHomoglyphs) {
      const posInLabel = match.position - offset;
      if (posInLabel >= 0 && posInLabel < label.length) {
        if (!digitPosInLabel.includes(posInLabel)) {
          digitPosInLabel.push(posInLabel);
        }
      }
    }
    digitPosInLabel.sort((a, b) => a - b);

    // 連続する数字をグループ化
    const groups: number[][] = [];
    for (const pos of digitPosInLabel) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && pos === lastGroup[lastGroup.length - 1] + 1) {
        lastGroup.push(pos);
      } else {
        groups.push([pos]);
      }
    }

    // グループごとに前後の文字をチェック
    for (const group of groups) {
      const firstPos = group[0];
      const lastPos = group[group.length - 1];
      const hasLetterBefore = firstPos > 0 && /[a-zA-Z]/.test(label[firstPos - 1]);
      const hasLetterAfter = lastPos < label.length - 1 && /[a-zA-Z]/.test(label[lastPos + 1]);

      if (hasLetterBefore) {
        for (const pos of group) {
          embeddedDigitPositions.add(pos + offset);
          if (hasLetterAfter) {
            surroundedDigitPositions.add(pos + offset);
          }
        }
      }
    }

    offset += label.length + 1;
  }

  // スコア計算
  // シーケンス: ラベル先頭のみ、1件30点（上限50）
  // 数字: 両側文字挟みは30点、片側のみは15点（上限30）
  const digitScore = Math.min(
    surroundedDigitPositions.size * 30 +
    (embeddedDigitPositions.size - surroundedDigitPositions.size) * 15,
    30
  );
  const breakdown: ScoreBreakdown = {
    latinHomoglyphs: digitScore + Math.min(dangerousSequences.length * 30, 50),
    cyrillicHomoglyphs: Math.min(cyrillicHomoglyphs.length * 25, 50),
    greekHomoglyphs: Math.min(greekHomoglyphs.length * 25, 50),
    japaneseHomoglyphs: Math.min(japaneseHomoglyphs.length * 15, 30),
    mixedScript: hasMixedScript ? 40 : 0,
    punycode: isPunycode && config.warnOnPunycode ? 10 : 0,
  };

  const totalScore = Math.min(
    breakdown.latinHomoglyphs +
      breakdown.cyrillicHomoglyphs +
      breakdown.greekHomoglyphs +
      breakdown.japaneseHomoglyphs +
      breakdown.mixedScript +
      breakdown.punycode,
    100
  );

  return {
    homoglyphs: allHomoglyphs,
    hasMixedScript,
    detectedScripts: Array.from(scripts),
    isPunycode,
    totalScore,
    breakdown,
  };
}

/**
 * スコアが閾値を超えているか判定
 */
export function isHighRiskTyposquat(
  scores: TyposquatScores,
  threshold: number
): boolean {
  return scores.totalScore >= threshold;
}
