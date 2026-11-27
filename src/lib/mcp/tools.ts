import { prisma } from "@/lib/db/prisma";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "get_stats",
    description:
      "SeedThoughtデータベースの統計情報（いいね・ブックマーク件数、学習カード件数、再利用可能な型の件数、主要カテゴリ）を取得します。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_recent_posts",
    description:
      "最近いいね・ブックマークして保存されたX投稿を新しい順に取得します。AIによる要約やカテゴリも含まれます。",
    inputSchema: {
      type: "object",
      properties: {
        savedType: {
          type: "string",
          enum: ["all", "like", "bookmark", "manual"],
          description: "保存種別で絞り込みます（デフォルト: all）",
        },
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "直近N日以内に保存された投稿に絞り込みます（任意）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "取得件数（1〜30、デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "search_posts",
    description:
      "キーワード、カテゴリ、投稿者名などでXのいいね・ブックマーク投稿を検索します。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "投稿本文・翻訳・AI要約・タグに含まれるキーワード",
        },
        category: {
          type: "string",
          description: "AI分類のカテゴリ名（部分一致）",
        },
        author: {
          type: "string",
          description: "投稿者の名前または@ユーザー名（部分一致）",
        },
        savedType: {
          type: "string",
          enum: ["all", "like", "bookmark", "manual"],
          description: "保存種別（デフォルト: all）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "取得件数（1〜30、デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "get_post_detail",
    description:
      "投稿IDを指定して、投稿の全文、スレッド（返信ツリー）、AI分類、紐づく学習カード（メモ含む）の詳細を取得します。",
    inputSchema: {
      type: "object",
      properties: {
        postId: {
          type: "string",
          description: "投稿のID（search_posts や get_recent_posts で取得した id）",
        },
      },
      required: ["postId"],
    },
  },
  {
    name: "list_learning_cards",
    description:
      "投稿から作成された学習カード（要約・核心インサイト・ユーザーメモ）を検索・一覧取得します。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "タイトル・要約・核心インサイト・メモに含まれるキーワード",
        },
        status: {
          type: "string",
          enum: ["all", "draft", "saved"],
          description: "カードの状態（デフォルト: all）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "取得件数（1〜30、デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "list_pattern_assets",
    description:
      "資産庫に蓄積された「再利用可能な型（プロンプト構文や発信の型）」を取得します。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "型の名前・構造・転用先・メモに含まれるキーワード",
        },
        status: {
          type: "string",
          enum: ["active", "archived", "all"],
          description: "資産の状態（デフォルト: active）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "取得件数（1〜30、デフォルト: 10）",
        },
      },
    },
  },
];

function clampLimit(value: unknown, defaultLimit = 10, maxLimit = 30): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultLimit;
  }
  return Math.max(1, Math.min(Math.trunc(value), maxLimit));
}

function safeParseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatPostSummary(post: {
  id: string;
  savedType: string;
  sourceUrl: string | null;
  authorName: string | null;
  authorUsername: string | null;
  text: string;
  translatedText: string | null;
  postedAt: Date | null;
  savedAt: Date;
  classification?: {
    primaryCategory: string;
    tagsJson: string;
    summary: string;
    postType: string;
  } | null;
  learningCard?: {
    id: string;
    title: string;
    status: string;
  } | null;
}) {
  return {
    id: post.id,
    savedType: post.savedType,
    sourceUrl: post.sourceUrl,
    authorName: post.authorName,
    authorUsername: post.authorUsername,
    text: post.text,
    translatedText: post.translatedText,
    postedAt: post.postedAt?.toISOString() ?? null,
    savedAt: post.savedAt.toISOString(),
    classification: post.classification
      ? {
          category: post.classification.primaryCategory,
          postType: post.classification.postType,
          summary: post.classification.summary,
          tags: safeParseJsonArray(post.classification.tagsJson),
        }
      : null,
    learningCard: post.learningCard ?? null,
  };
}

export async function executeMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    case "get_stats": {
      const [
        totalPosts,
        likesCount,
        bookmarksCount,
        manualCount,
        learningCardsCount,
        patternAssetsCount,
        topCategories,
      ] = await Promise.all([
        prisma.post.count(),
        prisma.post.count({ where: { savedType: "like" } }),
        prisma.post.count({ where: { savedType: "bookmark" } }),
        prisma.post.count({ where: { savedType: "manual" } }),
        prisma.learningCard.count(),
        prisma.patternAsset.count({ where: { status: "active" } }),
        prisma.postClassification.groupBy({
          by: ["primaryCategory"],
          _count: { primaryCategory: true },
          orderBy: { _count: { primaryCategory: "desc" } },
          take: 10,
        }),
      ]);

      return {
        posts: {
          total: totalPosts,
          like: likesCount,
          bookmark: bookmarksCount,
          manual: manualCount,
        },
        learningCards: learningCardsCount,
        activePatternAssets: patternAssetsCount,
        topCategories: topCategories.map((c) => ({
          category: c.primaryCategory,
          count: c._count.primaryCategory,
        })),
      };
    }

    case "get_recent_posts": {
      const savedType =
        typeof args.savedType === "string" ? args.savedType : "all";
      const limit = clampLimit(args.limit, 10, 30);
      const days =
        typeof args.days === "number" && Number.isFinite(args.days) && args.days > 0
          ? Math.min(Math.trunc(args.days), 365)
          : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (savedType !== "all") {
        where.savedType = savedType;
      }
      if (days !== null) {
        where.savedAt = {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        };
      }

      const posts = await prisma.post.findMany({
        where,
        orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { savedAt: "desc" }],
        take: limit,
        include: {
          classification: {
            select: {
              primaryCategory: true,
              tagsJson: true,
              summary: true,
              postType: true,
            },
          },
          learningCard: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      return {
        count: posts.length,
        posts: posts.map(formatPostSummary),
      };
    }

    case "search_posts": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const category =
        typeof args.category === "string" ? args.category.trim() : "";
      const author = typeof args.author === "string" ? args.author.trim() : "";
      const savedType =
        typeof args.savedType === "string" ? args.savedType : "all";
      const limit = clampLimit(args.limit, 10, 30);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const andConditions: any[] = [];
      if (savedType !== "all") {
        andConditions.push({ savedType });
      }
      if (query) {
        andConditions.push({
          OR: [
            { text: { contains: query, mode: "insensitive" } },
            { translatedText: { contains: query, mode: "insensitive" } },
            {
              classification: {
                summary: { contains: query, mode: "insensitive" },
              },
            },
            {
              classification: {
                tagsJson: { contains: query, mode: "insensitive" },
              },
            },
          ],
        });
      }
      if (category) {
        andConditions.push({
          classification: {
            primaryCategory: { contains: category, mode: "insensitive" },
          },
        });
      }
      if (author) {
        andConditions.push({
          OR: [
            { authorName: { contains: author, mode: "insensitive" } },
            { authorUsername: { contains: author, mode: "insensitive" } },
          ],
        });
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {};

      const posts = await prisma.post.findMany({
        where,
        orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { savedAt: "desc" }],
        take: limit,
        include: {
          classification: {
            select: {
              primaryCategory: true,
              tagsJson: true,
              summary: true,
              postType: true,
            },
          },
          learningCard: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      return {
        count: posts.length,
        posts: posts.map(formatPostSummary),
      };
    }

    case "get_post_detail": {
      const postId = typeof args.postId === "string" ? args.postId.trim() : "";
      if (!postId) {
        throw new Error("postId is required");
      }

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          classification: true,
          threadPosts: {
            orderBy: { threadOrder: "asc" },
            select: {
              threadOrder: true,
              authorName: true,
              authorUsername: true,
              text: true,
              translatedText: true,
              sourceUrl: true,
              postedAt: true,
            },
          },
          learningCard: {
            select: {
              id: true,
              title: true,
              summary: true,
              coreInsight: true,
              manual: true,
              userMemo: true,
              status: true,
              learningMode: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!post) {
        return { found: false, postId };
      }

      return {
        found: true,
        post: {
          ...formatPostSummary(post),
          videoTranscriptText: post.videoTranscriptText,
          recommendReason: post.classification?.recommendReason ?? null,
          threadPosts: post.threadPosts.map((tp) => ({
            ...tp,
            postedAt: tp.postedAt?.toISOString() ?? null,
          })),
          learningCard: post.learningCard
            ? {
                ...post.learningCard,
                createdAt: post.learningCard.createdAt.toISOString(),
                updatedAt: post.learningCard.updatedAt.toISOString(),
              }
            : null,
        },
      };
    }

    case "list_learning_cards": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const status = typeof args.status === "string" ? args.status : "all";
      const limit = clampLimit(args.limit, 10, 30);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const andConditions: any[] = [];
      if (status !== "all") {
        andConditions.push({ status });
      }
      if (query) {
        andConditions.push({
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
            { coreInsight: { contains: query, mode: "insensitive" } },
            { userMemo: { contains: query, mode: "insensitive" } },
          ],
        });
      }

      const cards = await prisma.learningCard.findMany({
        where: andConditions.length > 0 ? { AND: andConditions } : {},
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          sourcePostId: true,
          title: true,
          summary: true,
          coreInsight: true,
          userMemo: true,
          status: true,
          learningMode: true,
          updatedAt: true,
          sourcePost: {
            select: {
              authorUsername: true,
              sourceUrl: true,
              savedType: true,
            },
          },
        },
      });

      return {
        count: cards.length,
        cards: cards.map((card) => ({
          ...card,
          updatedAt: card.updatedAt.toISOString(),
        })),
      };
    }

    case "list_pattern_assets": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const status = typeof args.status === "string" ? args.status : "active";
      const limit = clampLimit(args.limit, 10, 30);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const andConditions: any[] = [];
      if (status !== "all") {
        andConditions.push({ status });
      }
      if (query) {
        andConditions.push({
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { structure: { contains: query, mode: "insensitive" } },
            { transferScope: { contains: query, mode: "insensitive" } },
            { usageNote: { contains: query, mode: "insensitive" } },
            { tagsJson: { contains: query, mode: "insensitive" } },
          ],
        });
      }

      const assets = await prisma.patternAsset.findMany({
        where: andConditions.length > 0 ? { AND: andConditions } : {},
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      return {
        count: assets.length,
        assets: assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          structure: asset.structure,
          variableSlots: safeParseJsonArray(asset.variableSlotsJson),
          transferScope: asset.transferScope,
          usageNote: asset.usageNote,
          tags: safeParseJsonArray(asset.tagsJson),
          status: asset.status,
          learningCardId: asset.learningCardId,
          updatedAt: asset.updatedAt.toISOString(),
        })),
      };
    }

    default:
      throw new McpUnknownToolError(name);
  }
}

export class McpUnknownToolError extends Error {
  constructor(toolName: string) {
    super(`Unknown tool: ${toolName}`);
    this.name = "McpUnknownToolError";
  }
}
