import { getNotionClient } from "./client";
import { prisma } from "@/lib/db/prisma";

export interface NotionSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

type NotionProperties = Record<string, unknown>;

export async function syncLearningCardsToNotion(
  apiKey: string,
  databaseId: string
): Promise<NotionSyncResult> {
  const notion = getNotionClient(apiKey);
  const result: NotionSyncResult = { synced: 0, skipped: 0, errors: [] };

  const cards = await prisma.learningCard.findMany({
    where: { status: "saved" },
    include: {
      sourcePost: { include: { classification: true } },
      outputs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const card of cards) {
    try {
      // Check if already synced by the SeedThought ID property.
      const existing = await notion.dataSources.query({
        data_source_id: databaseId,
        filter: {
          property: "SeedThought ID",
          rich_text: { equals: card.id },
        },
      });

      if (existing.results.length > 0) {
        result.skipped++;
        continue;
      }

      const genre = card.sourcePost.classification?.primaryCategory ?? "";
      const sourceUrl = card.sourcePost.sourceUrl ?? null;
      const outputTypes = [...new Set(card.outputs.map((o: { outputType: string }) => o.outputType))];

      const props: NotionProperties = {
        Name: { title: [{ type: "text", text: { content: card.title } }] },
        "SeedThought ID": { rich_text: [{ type: "text", text: { content: card.id } }] },
        "ソースURL": { url: sourceUrl },
        "作成日": { date: { start: card.createdAt.toISOString() } },
      };
      if (genre) {
        props["ジャンル"] = { select: { name: genre } };
      }
      if (outputTypes.length > 0) {
        props["アウトプット"] = { multi_select: outputTypes.map((t) => ({ name: t })) };
      }

      const outputBlocks = card.outputs.flatMap((output: { outputType: string; title: string; content: string }) => [
        {
          object: "block" as const,
          type: "callout" as const,
          callout: {
            rich_text: [
              {
                type: "text" as const,
                text: {
                  content: `[${output.outputType}] ${output.title}\n\n${output.content.slice(0, 1500)}`,
                },
              },
            ],
            icon: { type: "emoji" as const, emoji: "📝" as const },
            color: "default" as const,
          },
        },
      ]);

      await notion.pages.create({
        parent: { type: "database_id", database_id: databaseId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: props as any,
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: "まとめ" } }],
              color: "default",
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: card.summary } }],
              color: "default",
            },
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: "核心" } }],
              color: "default",
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: card.coreInsight } }],
              color: "default",
            },
          },
          ...(outputBlocks.length > 0
            ? [
                {
                  object: "block" as const,
                  type: "heading_2" as const,
                  heading_2: {
                    rich_text: [{ type: "text" as const, text: { content: "アウトプット" } }],
                    color: "default" as const,
                  },
                },
                ...outputBlocks,
              ]
            : []),
        ],
      });

      result.synced++;
    } catch (err) {
      result.errors.push(`${card.title}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
