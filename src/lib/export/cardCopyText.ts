import type { LearningOutput, StrictLearningOutput } from "@/lib/ai/types";

interface CopyMeta {
  title?: string | null;
  sourceUrl?: string | null;
  author?: string | null;
}

/**
 * 学習カードの全セクションを、他のAIに貼り付けたりDBに保存したりしやすい
 * 1つのMarkdownテキストに連結する。
 * 対象: 元の投稿 / 一言でいうと / 投稿の中身 / 解読（なぜすごいか・変化の文脈・
 * 仕組み・型・隣接する型・発信ネタの種）/ 手順 / 初心者ガイド / 背景・周辺情報 /
 * 本質を絞る / 応用アイデア・コツ・用途
 *
 * 「本質を絞る」はオンデマンド生成のため、未生成（strict が null）のときはそのセクションを省く。
 * 各セクションも、中身が無ければ丸ごと省略する（空見出しを残さない）。
 *
 * @param originalPostText 元投稿の本文（ツリーがあれば連結済みのもの。buildPostTextWithThread の出力を渡す）
 */
export function buildCardCopyText(
  output: LearningOutput,
  strict: StrictLearningOutput | null,
  meta?: CopyMeta,
  originalPostText?: string | null
): string {
  const sections: string[] = [];

  if (meta?.title) sections.push(`# ${meta.title}`);

  // 元の投稿（ツリーがあれば連結済みのテキストをそのまま使う）
  if (originalPostText) {
    const src = [meta?.author, meta?.sourceUrl].filter(Boolean).join(" ");
    sections.push(`## 元の投稿${src ? `\n\n${src}` : ""}\n\n${originalPostText}`);
  }

  // 一言でいうと（「まず掴む」の3点）
  {
    const parts: string[] = [];
    if (output.summary) parts.push(`**一言でいうと**\n${output.summary}`);
    if (output.originalIntent) parts.push(`**投稿者の狙い**\n${output.originalIntent}`);
    if (output.whyForYou) parts.push(`**なぜ見る価値があるか**\n${output.whyForYou}`);
    if (parts.length) sections.push(`## 一言でいうと\n\n${parts.join("\n\n")}`);
  }

  // 解読: なぜすごいのか・変化の文脈
  {
    const d = output.decode;
    if (d) {
      const parts: string[] = [];
      if (d.oneLiner) parts.push(`**正体**\n${d.oneLiner}`);
      if (d.whySignificant && d.whySignificant.length > 0) {
        parts.push(
          `**なぜすごいのか**\n${d.whySignificant
            .map((w) => `- ${w.point}${w.evidence ? `（根拠:「${w.evidence}」）` : ""}`)
            .join("\n")}`
        );
      }
      const ba = d.beforeAfter;
      if (ba && (ba.before || ba.trigger || ba.after)) {
        parts.push(
          `**変化の文脈**\n- 今まで: ${ba.before}\n- これが出た: ${ba.trigger}\n- こう変わる: ${ba.after}`
        );
      }
      if (parts.length) sections.push(`## なぜすごいのか（解読）\n\n${parts.join("\n\n")}`);

      if (d.mechanism && d.mechanism.items.length > 0) {
        const items = d.mechanism.items.map((m) => `- ${m.element} → ${m.role}`).join("\n");
        const lineage = d.mechanism.lineage ? `\n\n**原典・系譜**\n${d.mechanism.lineage}` : "";
        sections.push(`## 仕組みの解読\n\n${items}${lineage}`);
      }

      if (d.extractedPattern) {
        const p = d.extractedPattern;
        const parts2: string[] = [`**${p.name}**`];
        if (p.structure) parts2.push(`構造: ${p.structure}`);
        if (p.variableSlots?.length) parts2.push(`差し替えスロット: ${p.variableSlots.join(" / ")}`);
        if (p.transferScope) parts2.push(`転用範囲: ${p.transferScope}`);
        if (p.usageNote) parts2.push(`使い方メモ: ${p.usageNote}`);
        sections.push(`## 型として抽出\n\n${parts2.join("\n\n")}`);
      }

      if (d.adjacentPatterns && d.adjacentPatterns.length > 0) {
        sections.push(
          `## 派生できる隣接の型\n\n${d.adjacentPatterns
            .map((a) => `- **${a.name}**: ${a.description}${a.actionable ? `\n  - 実行形: ${a.actionable}` : ""}`)
            .join("\n")}`
        );
      }

      if (d.outputSeed?.angle) {
        const hook = d.outputSeed.hook ? `\n\n冒頭フック案: ${d.outputSeed.hook}` : "";
        sections.push(`## 発信ネタの種\n\n${d.outputSeed.angle}${hook}`);
      }
    }
  }

  // 投稿の中身
  {
    const cap = output.capture;
    if (cap) {
      const head = cap.headline ? `**${cap.headline}**\n\n` : "";
      if (cap.verbatim) {
        const usage = cap.usage ? `\n\n**使い方**\n${cap.usage}` : "";
        sections.push(`## 投稿の中身\n\n${head}\`\`\`\n${cap.verbatim}\n\`\`\`${usage}`);
      } else if (cap.items && cap.items.length > 0) {
        const items = cap.items
          .map((it, i) => `${i + 1}. **${it.label}** — ${it.body}${it.detail ? `\n   - ${it.detail}` : ""}`)
          .join("\n");
        sections.push(`## 投稿の中身\n\n${head}${items}`);
      }
    }
  }

  // 手順
  if (output.steps && output.steps.length > 0) {
    sections.push(
      `## 手順\n\n${output.steps
        .map(
          (s, i) =>
            `${i + 1}. **${s.title}** — ${s.description}${
              s.actions?.length ? `\n   - ${s.actions.join("\n   - ")}` : ""
            }`
        )
        .join("\n")}`
    );
  }

  // 初心者ガイド（glossary が無いときは背景の terminology を使う＝画面と同じフォールバック）
  {
    const zone = output.beginnerZone;
    const glossary = zone?.glossary ?? output.backgroundContext?.terminology ?? [];
    const parts: string[] = [];
    if (zone?.stumblingPoints && zone.stumblingPoints.length > 0) {
      parts.push(
        `**つまずきポイント**\n${zone.stumblingPoints.map((s) => `- **${s.point}**: ${s.explanation}`).join("\n")}`
      );
    }
    if (glossary.length > 0) {
      parts.push(`**用語解説**\n${glossary.map((g) => `- **${g.term}**: ${g.explanation}`).join("\n")}`);
    }
    if (parts.length) sections.push(`## 初心者ガイド\n\n${parts.join("\n\n")}`);
  }

  // 背景・周辺情報
  {
    const bg = output.backgroundContext;
    if (bg) {
      const parts: string[] = [];
      if (bg.postType) parts.push(`**投稿タイプ**: ${bg.postType}`);
      if (bg.origin) parts.push(`**原典・出典**\n${bg.origin}`);
      if (bg.historicalContext) parts.push(`**時代背景・文脈**\n${bg.historicalContext}`);
      if (bg.relatedFrameworks && bg.relatedFrameworks.length > 0) {
        parts.push(
          `**類似フレームワーク・関連する考え方**\n${bg.relatedFrameworks
            .map((f) => `- **${f.name}**: ${f.description}\n  - 関係: ${f.relation}`)
            .join("\n")}`
        );
      }
      if (bg.referencedWorks && bg.referencedWorks.length > 0) {
        parts.push(
          `**投稿で言及されているもの**\n${bg.referencedWorks.map((w) => `- **${w.name}**: ${w.context}`).join("\n")}`
        );
      }
      if (bg.furtherReading && bg.furtherReading.length > 0) {
        parts.push(
          `**もっと知りたい人へ**\n${bg.furtherReading.map((r) => `- **${r.topic}**: ${r.reason}`).join("\n")}`
        );
      }
      if (parts.length) sections.push(`## 背景・周辺情報\n\n${parts.join("\n\n")}`);
    }
  }

  // 本質を絞る（生成済みのときだけ）
  if (strict) {
    const parts: string[] = [];
    if (strict.oneLiner) parts.push(`**一言でいうと**\n${strict.oneLiner}`);
    if (strict.whyItMatters) parts.push(`**なぜ重要か**\n${strict.whyItMatters}`);
    if (strict.prerequisites) parts.push(`**前提知識**\n${strict.prerequisites}`);
    const cb = strict.claimBreakdown;
    if (cb) {
      parts.push(
        `**主張の分解**\n- 主張: ${cb.claim}\n- 背景: ${cb.background}\n- 前提: ${cb.assumption}\n- 根拠: ${cb.evidence}\n- 反例: ${cb.counterExample}\n- 限界: ${cb.limit}`
      );
    }
    const v = strict.strictLearningView;
    if (v) {
      const lines: string[] = [];
      if (v.positiveExamples?.length) lines.push(`- 正例: ${v.positiveExamples.join(" / ")}`);
      if (v.negativeExamples?.length) lines.push(`- 反例: ${v.negativeExamples.join(" / ")}`);
      if (v.boundaryExamples?.length) lines.push(`- 境界事例: ${v.boundaryExamples.join(" / ")}`);
      if (v.necessaryConditions?.length) lines.push(`- 必要条件: ${v.necessaryConditions.join(" / ")}`);
      if (v.typicalFeatures?.length) lines.push(`- 典型特徴: ${v.typicalFeatures.join(" / ")}`);
      if (v.essence) lines.push(`- 本質: ${v.essence}`);
      if (lines.length) parts.push(`**厳密学習で見る**\n${lines.join("\n")}`);
    }
    if (strict.abstraction) parts.push(`**抽象化すると**\n${strict.abstraction}`);
    if (strict.transferToOtherFields && strict.transferToOtherFields.length > 0) {
      parts.push(
        `**他分野への転用**\n${strict.transferToOtherFields.map((t) => `- ${t.field}: ${t.application}`).join("\n")}`
      );
    }
    if (strict.applyToYourself) parts.push(`**自分に使うなら**\n${strict.applyToYourself}`);
    const ex = strict.fifteenMinuteExercise;
    if (ex) {
      const steps = (ex.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n");
      parts.push(`**15分ワーク**\nゴール: ${ex.goal}\n${steps}\n成果物: ${ex.deliverable}`);
    }
    if (parts.length) sections.push(`## 本質を絞る\n\n${parts.join("\n\n")}`);
  }

  // 応用アイデア・コツ・用途
  {
    const parts: string[] = [];
    if (output.applicationIdeas && output.applicationIdeas.length > 0) {
      parts.push(
        output.applicationIdeas
          .map(
            (a) =>
              `- **${a.title}**: ${a.description}${a.actionable ? `\n  - そのまま使える形: ${a.actionable}` : ""}`
          )
          .join("\n")
      );
    }
    if (output.tips && output.tips.length > 0) {
      parts.push(`**うまく使うコツ**\n${output.tips.map((t) => `- ${t}`).join("\n")}`);
    }
    if (output.useCases && output.useCases.length > 0) {
      parts.push(`**向いている用途**\n${output.useCases.join(" / ")}`);
    }
    if (parts.length) sections.push(`## 応用アイデア\n\n${parts.join("\n\n")}`);
  }

  // 出典
  {
    const src = [meta?.author, meta?.sourceUrl].filter(Boolean).join(" ");
    if (src) sections.push(`---\n出典: ${src}`);
  }

  return sections.join("\n\n") + "\n";
}
