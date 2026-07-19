import { APIErrorCode, isNotionClientError } from "@notionhq/client";
import { getNotionClient } from "./client";
import { cacheNotionDataSourceId, getNotionSettings } from "./settings";
import { prisma } from "@/lib/db/prisma";

export interface NotionSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

type NotionProperties = Record<string, unknown>;

type SyncOptions = {
  limit?: number;
};

async function loadLearningCards(limit?: number) {
  return prisma.learningCard.findMany({
    where: { status: "saved" },
    include: {
      sourcePost: { include: { classification: true } },
      outputs: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });
}

type LearningCardForNotion = Awaited<ReturnType<typeof loadLearningCards>>[number];

async function discoverDataSourceId(
  notion: ReturnType<typeof getNotionClient>,
  databaseId: string,
): Promise<string> {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSources = "data_sources" in database ? database.data_sources : [];
  const dataSourceId = dataSources[0]?.id;
  if (!dataSourceId) {
    throw new Error("Notionデータベースにデータソースが見つかりません");
  }
  return dataSourceId;
}

function shouldRefreshCachedDataSource(error: unknown): boolean {
  if (!isNotionClientError(error)) return false;
  return (
    error.code === APIErrorCode.ValidationError ||
    error.code === APIErrorCode.ObjectNotFound ||
    error.code === APIErrorCode.InvalidRequest
  );
}

async function syncOneLearningCard(
  notion: ReturnType<typeof getNotionClient>,
  dataSourceId: string,
  card: LearningCardForNotion,
): Promise<"synced" | "skipped"> {
  const existing = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "SeedThought ID",
      rich_text: { equals: card.id },
    },
  });

  if (existing.results.length > 0) return "skipped";

  const genre = card.sourcePost.classification?.primaryCategory ?? "";
  const sourceUrl = card.sourcePost.sourceUrl ?? null;
  const outputTypes = [...new Set(card.outputs.map((output) => output.outputType))];

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
    props["アウトプット"] = {
      multi_select: outputTypes.map((outputType) => ({ name: outputType })),
    };
  }

  const outputBlocks = card.outputs.flatMap((output) => [
    {
      object: "block" as const,
      type: "callout" as const,
      callout: {
        rich_text: [
          {
            type: "text" as const,
            text: {
              content:
                "[" +
                output.outputType +
                "] " +
                output.title +
                "\n\n" +
                output.content.slice(0, 1500),
            },
          },
        ],
        icon: { type: "emoji" as const, emoji: "📝" as const },
        color: "default" as const,
      },
    },
  ]);

  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
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

  return "synced";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function syncLearningCardsToNotion(
  apiKey: string,
  databaseId: string,
  options: SyncOptions = {},
): Promise<NotionSyncResult> {
  const notion = getNotionClient(apiKey);
  const settings = await getNotionSettings();
  const cachedDataSourceId =
    settings.databaseId === databaseId ? settings.dataSourceId : "";
  let dataSourceId =
    cachedDataSourceId || (await discoverDataSourceId(notion, databaseId));
  await cacheNotionDataSourceId(databaseId, dataSourceId);

  const cards = await loadLearningCards(options.limit);
  const result: NotionSyncResult = { synced: 0, skipped: 0, errors: [] };
  let mayRefreshCachedDataSource = Boolean(cachedDataSourceId);

  for (const card of cards) {
    try {
      const outcome = await syncOneLearningCard(notion, dataSourceId, card);
      result[outcome]++;
    } catch (error) {
      if (!mayRefreshCachedDataSource || !shouldRefreshCachedDataSource(error)) {
        result.errors.push(card.title + ": " + errorMessage(error));
        continue;
      }

      mayRefreshCachedDataSource = false;
      try {
        dataSourceId = await discoverDataSourceId(notion, databaseId);
        await cacheNotionDataSourceId(databaseId, dataSourceId);
        const outcome = await syncOneLearningCard(notion, dataSourceId, card);
        result[outcome]++;
      } catch (retryError) {
        result.errors.push(card.title + ": " + errorMessage(retryError));
      }
    }
  }

  return result;
}