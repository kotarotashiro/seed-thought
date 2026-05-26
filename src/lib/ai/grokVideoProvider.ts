// Grok video generation via xAI API.
// Uses OAuth bearer token — X Premium+ / SuperGrok でコスト無し。
// xAI video generation is async: submit a job, poll for completion.

import { getAuthHeader } from "@/lib/xai/client";

const XAI_API_BASE = "https://api.x.ai/v1";

const VIDEO_STYLE_PREFIX =
  "短い説明動画（15秒以内）。日本語のテキストオーバーレイ付き。シンプルで読みやすいデザイン。内容: ";

function getVideoModel(): string {
  return process.env.GROK_VIDEO_MODEL ?? "grok-video";
}

export interface VideoGenerationJob {
  jobId: string;
  status: "pending" | "processing" | "done" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
}

export async function submitVideoGeneration(prompt: string): Promise<{ jobId: string }> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("プロンプトが空です");

  const styledPrompt = VIDEO_STYLE_PREFIX + trimmed;
  const authHeader = await getAuthHeader();

  const res = await fetch(`${XAI_API_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      model: getVideoModel(),
      prompt: styledPrompt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok Video API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id?: string; job_id?: string };
  const jobId = data.id ?? data.job_id;
  if (!jobId) throw new Error("Grok Video: ジョブ ID が返されませんでした");

  return { jobId };
}

export async function pollVideoGeneration(jobId: string): Promise<VideoGenerationJob> {
  const authHeader = await getAuthHeader();

  const res = await fetch(`${XAI_API_BASE}/videos/generations/${jobId}`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok Video poll ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    video_url?: string;
    url?: string;
    thumbnail_url?: string;
    error?: string;
  };

  const rawStatus = data.status ?? "pending";
  let status: VideoGenerationJob["status"] = "pending";
  if (rawStatus === "succeeded" || rawStatus === "done" || rawStatus === "completed") {
    status = "done";
  } else if (rawStatus === "failed" || rawStatus === "error") {
    status = "failed";
  } else if (rawStatus === "processing" || rawStatus === "running" || rawStatus === "in_progress") {
    status = "processing";
  }

  return {
    jobId,
    status,
    videoUrl: data.video_url ?? data.url,
    thumbnailUrl: data.thumbnail_url,
    errorMessage: data.error,
  };
}
