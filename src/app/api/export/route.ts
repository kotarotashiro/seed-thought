import { prisma } from "@/lib/db/prisma";
import { renderCardMarkdown } from "@/lib/export/markdown";
import { buildZip } from "@/lib/export/zip";

interface ExportBody {
  ids?: string[];
  format?: "zip" | "bundle";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportBody;
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const format = body.format === "bundle" ? "bundle" : "zip";

    const where = ids.length > 0 ? { id: { in: ids } } : { status: "saved" };

    const cards = await prisma.learningCard.findMany({
      where,
      include: {
        sourcePost: { include: { classification: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (cards.length === 0) {
      return new Response(JSON.stringify({ error: "対象のカードがありません" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rendered: Array<{ filename: string; body: string }> = cards.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => renderCardMarkdown(c)
    );
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "bundle") {
      const body = rendered
        .map((r: { body: string }) => r.body)
        .join("\n\n---\n\n");
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="seedthought-${timestamp}.md"`,
        },
      });
    }

    // Disambiguate filenames if any collisions
    const seen = new Map<string, number>();
    const files = rendered.map((r: { filename: string; body: string }) => {
      const count = seen.get(r.filename) || 0;
      seen.set(r.filename, count + 1);
      const filename = count === 0 ? r.filename : r.filename.replace(/\.md$/, `-${count + 1}.md`);
      return { name: filename, content: r.body };
    });

    const zip = buildZip(files);
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="seedthought-${timestamp}.zip"`,
      },
    });
  } catch (error) {
    console.error("Failed to export:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "エクスポートに失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
