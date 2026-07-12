// Grok video generation via xAI API.
// Uses OAuth bearer token — X Premium+ / SuperGrok でコスト無し。
// xAI video generation is async: submit a job, poll for completion.

import { xaiFetch } from "@/lib/xai/client";

const XAI_API_BASE = "https://api.x.ai/v1";

const VIDEO_STYLE_PREFIX =
  "短い説明動画（15秒以内）。日本語のテキストオーバーレイ付き。シンプルで読みやすいデザイン。内容: ";

function getVideoModel(): string {
  return process.env.GROK_VIDEO_MODEL ?? "grok-imagine-video";
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

  const res = await xaiFetch(`${XAI_API_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

  const rawText = await res.text();
  console.log("[grokVideo] submit raw response:", rawText.slice(0, 800));

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Grok Video: JSONパース失敗 — raw: ${rawText.slice(0, 200)}`);
  }

  const jobId =
    (typeof data.id === "string" && data.id) ||
    (typeof data.job_id === "string" && data.job_id) ||
    (typeof data.task_id === "string" && data.task_id) ||
    (typeof data.request_id === "string" && data.request_id);

  if (!jobId) {
    throw new Error(
      `Grok Video: ジョブIDが見つかりません — keys: [${Object.keys(data).join(", ")}] / sample: ${rawText.slice(0, 300)}`
    );
  }

  return { jobId };
}

export async function pollVideoGeneration(jobId: string): Promise<VideoGenerationJob> {
  const res = await xaiFetch(`${XAI_API_BASE}/videos/${jobId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok Video poll ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    status?: string;
    video?: { url?: string; thumbnail_url?: string; duration?: number };
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
    videoUrl: data.video?.url ?? data.video_url ?? data.url,
    thumbnailUrl: data.video?.thumbnail_url ?? data.thumbnail_url,
    errorMessage: data.error,
  };
}
