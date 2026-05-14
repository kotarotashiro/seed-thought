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
    throw new AiJsonError(`${label}のAI応答が空でした`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new AiJsonError(`${label}のAI応答をJSONとして解析できませんでした`);
  }

  if (!validate(parsed)) {
    throw new AiJsonError(`${label}のAI応答形式が想定と違いました`);
  }

  return parsed;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}
