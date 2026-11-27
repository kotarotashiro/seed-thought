import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMcpAuthorized } from "./auth";
import { handleMcpRequest } from "./server";
import { MCP_TOOLS } from "./tools";

const mockPrisma = vi.hoisted(() => ({
  post: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  learningCard: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  patternAsset: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  postClassification: {
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

describe("isMcpAuthorized", () => {
  const originalKey = process.env.MCP_API_KEY;

  beforeEach(() => {
    process.env.MCP_API_KEY = "test-secret-key-123";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MCP_API_KEY;
    } else {
      process.env.MCP_API_KEY = originalKey;
    }
  });

  it("rejects all requests when MCP_API_KEY is unset", () => {
    delete process.env.MCP_API_KEY;
    const req = new Request("https://example.com/api/mcp", {
      headers: { Authorization: "Bearer test-secret-key-123" },
    });
    expect(isMcpAuthorized(req)).toBe(false);
  });

  it("accepts Bearer token, x-api-key header, and ?token= query", () => {
    expect(
      isMcpAuthorized(
        new Request("https://example.com/api/mcp", {
          headers: { Authorization: "Bearer test-secret-key-123" },
        }),
      ),
    ).toBe(true);

    expect(
      isMcpAuthorized(
        new Request("https://example.com/api/mcp", {
          headers: { "x-api-key": "test-secret-key-123" },
        }),
      ),
    ).toBe(true);

    expect(
      isMcpAuthorized(
        new Request("https://example.com/api/mcp?token=test-secret-key-123"),
      ),
    ).toBe(true);
  });

  it("rejects invalid or missing tokens", () => {
    expect(
      isMcpAuthorized(new Request("https://example.com/api/mcp")),
    ).toBe(false);
    expect(
      isMcpAuthorized(
        new Request("https://example.com/api/mcp", {
          headers: { Authorization: "Bearer wrong-key" },
        }),
      ),
    ).toBe(false);
  });
});

describe("handleMcpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles initialize and tools/list", async () => {
    const initRes = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });
    expect(initRes).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "seed-thought-mcp" },
      },
    });

    const listRes = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    expect(listRes?.result).toEqual({ tools: MCP_TOOLS });
  });

  it("returns null for notifications", async () => {
    const res = await handleMcpRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res).toBeNull();
  });

  it("executes get_stats tool", async () => {
    mockPrisma.post.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5);
    mockPrisma.learningCard.count.mockResolvedValueOnce(20);
    mockPrisma.patternAsset.count.mockResolvedValueOnce(12);
    mockPrisma.postClassification.groupBy.mockResolvedValueOnce([
      { primaryCategory: "AI活用", _count: { primaryCategory: 45 } },
    ]);

    const res = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_stats", arguments: {} },
    });

    const text = (res?.result as { content: Array<{ text: string }> }).content[0]
      .text;
    const parsed = JSON.parse(text);
    expect(parsed.posts).toEqual({
      total: 100,
      like: 80,
      bookmark: 15,
      manual: 5,
    });
    expect(parsed.topCategories).toEqual([{ category: "AI活用", count: 45 }]);
  });

  it("executes search_posts tool and caps limit", async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post_1",
        savedType: "like",
        sourceUrl: "https://x.com/user/status/1",
        authorName: "Alice",
        authorUsername: "alice",
        text: "Next.js tips",
        translatedText: null,
        postedAt: new Date("2026-10-01T00:00:00Z"),
        savedAt: new Date("2026-10-02T00:00:00Z"),
        classification: {
          primaryCategory: "開発",
          tagsJson: '["nextjs","react"]',
          summary: "Next.jsのTips",
          postType: "learning",
        },
        learningCard: null,
      },
    ]);

    const res = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "search_posts",
        arguments: { query: "Next.js", savedType: "like", limit: 999 },
      },
    });

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30 }),
    );
    const text = (res?.result as { content: Array<{ text: string }> }).content[0]
      .text;
    const parsed = JSON.parse(text);
    expect(parsed.count).toBe(1);
    expect(parsed.posts[0].classification.tags).toEqual(["nextjs", "react"]);
  });

  it("returns error for unknown tools", async () => {
    const res = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "delete_all_posts", arguments: {} },
    });
    expect(res?.error).toMatchObject({
      code: -32602,
    });
  });
});
