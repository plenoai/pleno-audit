/**
 * Preact 11 以降、コアは数値スタイル値に "px" を自動付与しない（preact/compat へ移動）。
 * 数値を受け取るコンポーネントはここで明示的に単位を付ける。
 */

// Preact 10 の IS_NON_DIMENSIONAL と同じ判定（opacity, zIndex, flex, lineHeight など単位なしのプロパティ）
const UNITLESS_PROPERTY = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;

/** 数値を px 付きの CSS 長さに変換する（文字列はそのまま） */
export function toCssLength(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value;
}

/** スタイルオブジェクト内の寸法プロパティの数値に px を付与する */
export function withPxUnits(
  style: Record<string, string | number>,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    result[key] =
      typeof value === "number" && !UNITLESS_PROPERTY.test(key)
        ? `${value}px`
        : value;
  }
  return result;
}
