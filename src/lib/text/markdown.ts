/**
 * X（Twitter）投稿向けマークダウン除去ユーティリティ。
 * note 等マークダウン描画がある媒体には適用しない。
 */

/**
 * X投稿テキストからマークダウン記法を取り除く。
 *
 * 除去対象:
 * - 見出し記号: `# 〜` / `＃ 〜`（行頭の記号を除去、テキストは残す）
 * - 太字: `**text**` / `__text__` → text
 * - 斜体: `*text*`（太字処理後の残り）→ text
 * - コードスパン: `code` → code
 *
 * 保持するもの:
 * - ハッシュタグ `#AI` のように記号の直後に空白がないもの
 */
export function stripMarkdownForX(text: string): string {
  let result = text;

  // 1. 行頭見出し記号を除去（半角/全角）
  //    `# text` `## text` → `text`
  //    `＃ text` → `text`
  //    ハッシュタグ(`#AI`)は行頭でもスペースなしなので除去されない
  result = result.replace(/^[ \t　]*[#＃]{1,6}[ \t　]+/gm, "");

  // 2. 太字 **text** / __text__ → text（先に処理して斜体と競合しないようにする）
  result = result.replace(/\*\*([^*]+?)\*\*/g, "$1");
  result = result.replace(/__([^_]+?)__/g, "$1");

  // 3. 斜体 *text* → text（**は処理済みなので残る単発*を除去）
  //    改行をまたがないように [^\n*] で制限
  result = result.replace(/\*([^\n*]+?)\*/g, "$1");

  // 4. コードスパン `code` → code（改行なし）
  result = result.replace(/`([^\n`]+?)`/g, "$1");

  // 5. 末尾の過剰な改行を2行以内に整理
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
