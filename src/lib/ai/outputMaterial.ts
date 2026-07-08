import type { GenerateOutputInput, LearningOutput } from "./types";

type OutputStep = GenerateOutputInput["steps"][number];

/**
 * 学習カードの outputJson（LearningOutput 全体の生JSON）を、発信生成が
 * 「素材の4層仕分け」しやすいラベル付きステップ列に変換する。
 * 生JSONを1ブロックで渡すと、モデルがまずJSON解読から始まり素材を活かしきれない。
 * 各ステップは buildLearningMaterialBlock が「### ステップN: title / AI解説: aiContent」
 * の形で展開するため、aiContent は人間が読める文章にする（JSONのまま渡さない）。
 */
export function buildOutputMaterialSteps(outputJson: string, userMemo: string | null): OutputStep[] {
  let parsed: Partial<LearningOutput> | null = null;
  try {
    parsed = JSON.parse(outputJson) as Partial<LearningOutput>;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return [{ title: "学習内容", question: "", aiContent: outputJson, userNote: userMemo }];
  }

  const steps: OutputStep[] = [];

  // ① 投稿の中身（論点層の骨格。1つも落とさず使う素材）
  if (parsed.capture) {
    const c = parsed.capture;
    const body = c.verbatim
      ? `【${c.headline ?? ""}】\n${c.verbatim}${c.usage ? `\n使い方: ${c.usage}` : ""}`
      : `【${c.headline ?? ""}】\n${(c.items ?? [])
          .map((it, i) => `${i + 1}. ${it.label}: ${it.body}${it.detail ? `（${it.detail}）` : ""}`)
          .join("\n")}`;
    if (body.trim()) {
      steps.push({ title: "投稿の中身（論点層）", question: "", aiContent: body, userNote: null });
    }
  }

  // ② なぜすごいのか・変化の文脈（解読。発信の導入・共感フックに直結する最重要素材）
  const decode = parsed.decode;
  if (decode) {
    const why = (decode.whySignificant ?? [])
      .map((w) => `- ${w.point}（根拠:「${w.evidence}」）`)
      .join("\n");
    const ba = decode.beforeAfter;
    const body = [
      decode.oneLiner ? `正体: ${decode.oneLiner}` : "",
      why ? `なぜすごいか:\n${why}` : "",
      ba ? `今まで: ${ba.before}\nこれが出た: ${ba.trigger}\nこう変わる: ${ba.after}` : "",
      decode.outputSeed?.angle ? `発信の切り口: ${decode.outputSeed.angle}` : "",
      decode.outputSeed?.hook ? `冒頭フック案: ${decode.outputSeed.hook}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (body) {
      steps.push({ title: "なぜすごいのか・変化の文脈（解読）", question: "", aiContent: body, userNote: null });
    }

    if (decode.mechanism && decode.mechanism.items.length > 0) {
      const mechBody =
        decode.mechanism.items.map((m) => `- ${m.element} → ${m.role}`).join("\n") +
        (decode.mechanism.lineage ? `\n原典・系譜: ${decode.mechanism.lineage}` : "");
      steps.push({ title: "仕組みの解読", question: "", aiContent: mechBody, userNote: null });
    }
  } else if (parsed.backgroundContext) {
    // 解読がない旧カードの後方互換: 周辺情報を背景・本質の素材として渡す
    const bg = parsed.backgroundContext;
    const body = [
      bg.origin ? `原典・出典: ${bg.origin}` : "",
      bg.historicalContext ? `時代背景: ${bg.historicalContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (body) {
      steps.push({ title: "背景・周辺情報", question: "", aiContent: body, userNote: null });
    }
  }

  // ③ 初心者のつまずき・用語（補助層。本文に溶かして使う素材）
  if (parsed.beginnerZone) {
    const bz = parsed.beginnerZone;
    const stumbling = (bz.stumblingPoints ?? []).map((s) => `- ${s.point}: ${s.explanation}`).join("\n");
    const glossary = (bz.glossary ?? []).map((g) => `- ${g.term}: ${g.explanation}`).join("\n");
    const body = [stumbling ? `つまずきポイント:\n${stumbling}` : "", glossary ? `用語:\n${glossary}` : ""]
      .filter(Boolean)
      .join("\n\n");
    if (body) {
      steps.push({ title: "初心者のつまずき・用語（補助層）", question: "", aiContent: body, userNote: null });
    }
  }

  // ④ 応用アイデア・コツ・用途（実践層。締めのワークに使う素材）
  const ideas = (parsed.applicationIdeas ?? [])
    .map((i) => `- ${i.title}: ${i.description}${i.actionable ? `\n  そのまま使える形: ${i.actionable}` : ""}`)
    .join("\n");
  const tips = (parsed.tips ?? []).map((t) => `- ${t}`).join("\n");
  const useCases = (parsed.useCases ?? []).join("、");
  const practiceBody = [
    ideas ? `応用アイデア:\n${ideas}` : "",
    tips ? `コツ:\n${tips}` : "",
    useCases ? `向いている用途: ${useCases}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (practiceBody) {
    steps.push({ title: "応用アイデア・コツ（実践層）", question: "", aiContent: practiceBody, userNote: null });
  }

  // 何も取れなかった（旧カード・想定外の形）場合は生JSONにフォールバックする
  if (steps.length === 0) {
    return [{ title: "学習内容", question: "", aiContent: outputJson, userNote: userMemo }];
  }

  // ユーザーメモは末尾ステップにだけ付ける（buildLearningMaterialBlock は各ステップにメモ欄を出すため、重複表示を避ける）
  if (userMemo) {
    steps[steps.length - 1] = { ...steps[steps.length - 1], userNote: userMemo };
  }

  return steps;
}
