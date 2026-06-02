// 投稿に添付された画像の中身を、xAI のビジョンモデルで日本語テキスト化する。
// 「画像で示す」とだけ書かれた投稿でも、画像内のテキスト・図・スクショを読み取り、
// 記事本文や動画文字起こしと同列の「学習素材」として扱えるようにするための前処理。
import { getAuthHeader } from "@/lib/xai/client";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

const VISION_PROMPT =
  "このX投稿に添付された画像の内容を、投稿の意図を正しく理解するための素材として日本語でまとめてください。" +
  "画像内のテキスト（英語などの外国語を含む）はすべて漏れなく書き起こし、図・表・グラフ・スクリーンショットがあれば構造と要点を説明してください。" +
  "後から読んで内容を再現できる粒度で、装飾的な感想や「この画像には〜が写っています」といった前置きは書かず、中身だけを出力してください。";

/**
 * 画像URLを取得して base64 化し、xAI のビジョンモデルに内容説明を依頼する。
 * 失敗時は throw する（呼び出し側で1枚単位の握りつぶし可否を判断する）。
 */
export async function describeImageUrl(
  url: string,
  model = process.env.GROK_MODEL ?? "grok-4.3"
): Promise<string> {
  // X の画像CDN(pbs.twimg.com)等が外部fetcherを弾く場合に備え、サーバ側で取得して base64 で渡す。
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new Error(`画像の取得に失敗しました (${imgRes.status})`);
  }
  const arrayBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const authHeader = await getAuthHeader();
  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI Vision ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
