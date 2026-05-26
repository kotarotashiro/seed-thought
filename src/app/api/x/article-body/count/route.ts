import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const count = await prisma.post.count({
    where: { enrichmentStatus: "x_article_pending" },
  });
  return NextResponse.json({ count });
}
