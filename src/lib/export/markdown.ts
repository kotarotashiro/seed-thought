interface CardExportInput {
  id: string;
  title: string;
  summary: string;
  coreInsight: string;
  manual: string;
  userMemo: string | null;
  outputJson: string;
  createdAt: Date;
  updatedAt: Date;
  sourcePost: {
    sourceUrl: string | null;
    authorName: string | null;
    authorUsername: string | null;
    text: string;
    classification?: {
      primaryCategory: string;
      tagsJson: string;
      postType: string;
      summary: string;
    } | null;
  };
}

interface LearningOutputJson {
  capture?: {
    format?: string;
    headline?: string;
    items?: Array<{ label: string; body: string; detail?: string }>;
    verbatim?: string | null;
    usage?: string | null;
  };
  steps?: Array<{ title: string; description: string; actions?: string[] }>;
  applicationIdeas?: Array<{ title: string; description: string }>;
  tips?: string[];
  useCases?: string[];
  beginnerZone?: {
    stumblingPoints?: Array<{ point: string; explanation: string }>;
    glossary?: Array<{ term: string; explanation: string }>;
  };
  // legacy
  structure?: Array<{ label: string; description: string }>;
}

function slugify(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

function yamlFrontmatter(record: Record<string, string | string[]>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const v of value) lines.push(`  - ${escapeYaml(v)}`);
    } else {
      if (!value) continue;
      lines.push(`${key}: ${escapeYaml(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function escapeYaml(value: string): string {
  // Quote if it contains characters that would confuse YAML.
  if (/[:#\[\]{}|>&*!%@`,"]/.test(value) || /^\s|\s$/.test(value) || value.includes("\n")) {
    return JSON.stringify(value);
  }
  return value;
}

export function renderCardMarkdown(card: CardExportInput): { filename: string; body: string } {
  const classification = card.sourcePost.classification;
  const tags = classification ? (JSON.parse(classification.tagsJson || "[]") as string[]) : [];

  let output: LearningOutputJson = {};
  try {
    output = JSON.parse(card.outputJson) as LearningOutputJson;
  } catch {
    // ignore
  }

  const frontmatter = yamlFrontmatter({
    title: card.title,
    id: card.id,
    category: classification?.primaryCategory || "",
    postType: classification?.postType || "",
    tags,
    sourceUrl: card.sourcePost.sourceUrl || "",
    author: card.sourcePost.authorUsername
      ? `@${card.sourcePost.authorUsername}`
      : card.sourcePost.authorName || "",
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  });

  const sections: string[] = [];
  sections.push(`# ${card.title}`);

  sections.push(`## 一言でいうと\n\n${card.summary}`);
  if (card.coreInsight) {
    sections.push(`## 核心\n\n${card.coreInsight}`);
  }

  // ① 投稿の中身そのもの
  if (output.capture) {
    const cap = output.capture;
    const head = cap.headline ? `**${cap.headline}**\n\n` : "";
    if (cap.verbatim) {
      const usage = cap.usage ? `\n\n**使い方**\n\n${cap.usage}` : "";
      sections.push(`## 投稿の中身\n\n${head}\`\`\`\n${cap.verbatim}\n\`\`\`${usage}`);
    } else if (cap.items && cap.items.length > 0) {
      const items = cap.items
        .map((it, i) => `${i + 1}. **${it.label}** — ${it.body}${it.detail ? `\n   - ${it.detail}` : ""}`)
        .join("\n");
      sections.push(`## 投稿の中身\n\n${head}${items}`);
    }
  }

  if (output.steps && output.steps.length > 0) {
    const items = output.steps
      .map((step, i) => {
        const actions = (step.actions || []).map((a) => `   - ${a}`).join("\n");
        return `${i + 1}. **${step.title}** — ${step.description}${actions ? `\n${actions}` : ""}`;
      })
      .join("\n");
    sections.push(`## 実践手順\n\n${items}`);
  }

  // ③ 初心者ガイド
  if (output.beginnerZone) {
    const zone = output.beginnerZone;
    const parts: string[] = [];
    if (zone.stumblingPoints && zone.stumblingPoints.length > 0) {
      parts.push(
        `**つまずきポイント**\n\n${zone.stumblingPoints.map((s) => `- **${s.point}**: ${s.explanation}`).join("\n")}`
      );
    }
    if (zone.glossary && zone.glossary.length > 0) {
      parts.push(
        `**用語解説**\n\n${zone.glossary.map((g) => `- **${g.term}**: ${g.explanation}`).join("\n")}`
      );
    }
    if (parts.length > 0) {
      sections.push(`## 初心者ガイド\n\n${parts.join("\n\n")}`);
    }
  }

  if (output.applicationIdeas && output.applicationIdeas.length > 0) {
    const items = output.applicationIdeas
      .map((idea) => `- **${idea.title}**: ${idea.description}`)
      .join("\n");
    sections.push(`## 応用アイデア\n\n${items}`);
  }

  if (output.tips && output.tips.length > 0) {
    sections.push(`## コツ\n\n${output.tips.map((t) => `- ${t}`).join("\n")}`);
  }

  if (output.useCases && output.useCases.length > 0) {
    sections.push(`## 向いている用途\n\n${output.useCases.map((u) => `- ${u}`).join("\n")}`);
  }

  if (card.userMemo) {
    sections.push(`## 自分メモ\n\n${card.userMemo}`);
  }

  sections.push(
    `## 元投稿\n\n${card.sourcePost.sourceUrl ? `🔗 ${card.sourcePost.sourceUrl}\n\n` : ""}> ${card.sourcePost.text.replace(/\n/g, "\n> ")}`
  );

  const body = frontmatter + sections.join("\n\n") + "\n";
  const filename = `${slugify(card.title, card.id)}.md`;
  return { filename, body };
}
