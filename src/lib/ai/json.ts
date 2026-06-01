export class AiJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiJsonError";
  }
}

export function parseAiJson<T>(
  raw: string,
  validate: (value: unknown) => value is T,
  label: string
): T {
  if (!raw.trim()) {
    console.error(`[parseAiJson] ${label}: empty response`);
    throw new AiJsonError(`${label}のAI応答が空でした`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (parseErr) {
    console.error(
      `[parseAiJson] ${label}: JSON parse failed. ParseErr:`,
      (parseErr as Error)?.message,
      `\nRaw response (first 2000 chars):\n${raw.slice(0, 2000)}`
    );
    throw new AiJsonError(`${label}のAI応答をJSONとして解析できませんでした`);
  }

  if (!validate(parsed)) {
    console.error(
      `[parseAiJson] ${label}: validation failed.\nParsed object (first 2000 chars):\n${JSON.stringify(parsed).slice(0, 2000)}`
    );
    throw new AiJsonError(`${label}のAI応答形式が想定と違いました`);
  }

  return parsed;
}

/**
 * best-effort 版。形式不正でも throw せず null を返す。
 * 学習カードの「補足」のように、欠けても本体だけで成立させたい工程で使う。
 */
export function tryParseAiJson<T>(
  raw: string,
  validate: (value: unknown) => value is T,
  label: string
): T | null {
  try {
    return parseAiJson(raw, validate, label);
  } catch {
    return null;
  }
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}
