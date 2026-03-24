/**
 * Content script → Background messaging utility.
 *
 * `chrome.runtime.sendMessage` は拡張リロード後に "Extension context invalidated" を投げる。
 * 本モジュールは送信前に `chrome.runtime.id` の存在を確認し、
 * 死んだコンテキストでは例外を発生させずに `false` を返す。
 */

type Message = { type: string } & Record<string, unknown>;

/**
 * コンテキストが生存しているかを返す。
 * content script 側で繰り返し呼んでよい（軽量な参照チェックのみ）。
 */
export function isRuntimeAvailable(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Background へメッセージを送信する。
 * コンテキスト死亡時は送信せず `false` を返す。
 * 送信成功時は background からのレスポンスを返す。
 */
export async function sendRuntimeMessage<T = unknown>(
  message: Message,
): Promise<{ ok: true; data: T } | { ok: false }> {
  if (!isRuntimeAvailable()) return { ok: false };

  try {
    const data = (await chrome.runtime.sendMessage(message)) as T;
    return { ok: true, data };
  } catch {
    // 送信中にコンテキストが無効化された場合もここに落ちる
    return { ok: false };
  }
}

/**
 * Fire-and-forget で送信する。戻り値を必要としないケース向け。
 * コンテキスト死亡時は何もしない。
 */
export function fireMessage(message: Message): void {
  if (!isRuntimeAvailable()) return;
  chrome.runtime.sendMessage(message).catch(() => {});
}
