import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateLearningCard } from "@/lib/learning/generate";
import { canRunAutoLearn, isQuotaLikeError, recordAutoLearnUsage, recordQuotaError } from "@/lib/ops/autoRun";
import {
  selectNextAutoLearnTask,
  type AutoLearnTaskCandidate,
} from "@/lib/ops/autoLearnSelection";
import { XaiTokenExpiredError } from "@/lib/xai/oauth";

export const maxDuration = 300;

const STALE_RUNNING_MS = 10 * 60 * 1000;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === "Bearer " + secret;
}

async function recoverStaleTasks(): Promise<number> {
  const result = await prisma.autoLearnTask.updateMany({
    where: {
      status: "running",
      updatedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) },
    },
    data: { status: "queued", lastError: "Recovered stale running task" },
  });
  return result.count;
}

async function claimNextTask(): Promise<{
  task: { id: string; postId: string; attempts: number } | null;
  skippedCount: number;
}> {
  let skippedCount = 0;

  while (true) {
    const candidates = await prisma.autoLearnTask.findMany({
      where: { status: "queued" },
      select: {
        id: true,
        postId: true,
        createdAt: true,
        post: {
          select: {
            classification: {
              select: { source: true, learningPotentialScore: true },
            },
            learningCard: { select: { id: true } },
          },
        },
      },
    });
    const candidate = selectNextAutoLearnTask(candidates as AutoLearnTaskCandidate[]);
    if (!candidate) return { task: null, skippedCount };

    const claimed = await prisma.autoLearnTask.updateMany({
      where: { id: candidate.id, status: "queued" },
      data: { status: candidate.post.learningCard ? "skipped" : "running", lastError: null },
    });
    if (claimed.count === 0) continue;
    if (candidate.post.learningCard) {
      skippedCount++;
      continue;
    }

    const task = await prisma.autoLearnTask.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        postId: true,
        attempts: true,
        post: { select: { learningCard: { select: { id: true } } } },
      },
    });
    if (!task) continue;
    if (task.post.learningCard) {
      await prisma.autoLearnTask.update({
        where: { id: task.id },
        data: { status: "skipped", lastError: null },
      });
      skippedCount++;
      continue;
    }

    return { task, skippedCount };
  }
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? "auto learn failed")).slice(0, 1000);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recoveredCount = await recoverStaleTasks();
    const decision = await canRunAutoLearn(1);
    if (!decision.allowed) {
      return NextResponse.json({
        ok: true,
        processedCount: 0,
        recoveredCount,
        autoLearnSkipped: decision.reason,
      });
    }

    const { task, skippedCount } = await claimNextTask();
    if (!task) {
      return NextResponse.json({ ok: true, processedCount: 0, skippedCount, recoveredCount });
    }

    try {
      const result = await generateLearningCard(task.postId);
      if (!result) {
        await prisma.autoLearnTask.update({
          where: { id: task.id },
          data: { status: "skipped", lastError: "Post not found" },
        });
        return NextResponse.json({
          ok: true,
          processedCount: 0,
          skippedCount: skippedCount + 1,
          recoveredCount,
        });
      }

      await prisma.autoLearnTask.update({
        where: { id: task.id },
        data: { status: "done", lastError: null },
      });
      await recordAutoLearnUsage(1);

      return NextResponse.json({
        ok: true,
        processedCount: 1,
        postId: task.postId,
        taskId: task.id,
        skippedCount,
        recoveredCount,
      });
    } catch (error) {
      const message = errorMessage(error);
      if (error instanceof XaiTokenExpiredError) {
        await prisma.autoLearnTask.update({
          where: { id: task.id },
          data: { status: "queued", lastError: message },
        });
        return NextResponse.json(
          { ok: false, error: message, code: "GROK_TOKEN_EXPIRED", taskId: task.id },
          { status: 503 },
        );
      }

      const attempts = task.attempts + 1;
      await prisma.autoLearnTask.update({
        where: { id: task.id },
        data: {
          status: attempts < 2 ? "queued" : "failed",
          attempts,
          lastError: message,
        },
      });
      await recordAutoLearnUsage(1);

      return NextResponse.json(
        { ok: false, error: message, taskId: task.id, attempts, skippedCount, recoveredCount },
        { status: 500 },
      );
    }
  } catch (error) {
    if (isQuotaLikeError(error)) {
      try {
        await recordQuotaError(error);
      } catch (recordError) {
        console.error("[cron/auto-learn] quota record failed", recordError);
      }
    }
    const message = errorMessage(error);
    console.error("[cron/auto-learn]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
