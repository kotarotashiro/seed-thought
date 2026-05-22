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
  structure?: Array<{ label: string; description: string }>;
  steps?: Array<{ title: string; description: string; actions?: string[] }>;
  applicationIdeas?: Array<{ title: string; description: string }>;
  tips?: string[];
  useCases?: string[];
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

  sections.push(`## 要約\n\n${card.summary}`);
  sections.push(`## 核心\n\n${card.coreInsight}`);

  if (output.structure && output.structure.length > 0) {
    const items = output.structure
      .map((s) => `- **${s.label}**: ${s.description}`)
      .join("\n");
    sections.push(`## 構造\n\n${items}`);
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

  sections.push(`## マニュアル\n\n${card.manual}`);

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
