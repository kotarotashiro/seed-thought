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
  const embeddedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedFence?.[1]) return embeddedFence[1].trim();
  const embeddedJson = findEmbeddedJson(trimmed);
  if (embeddedJson) return embeddedJson;
  return trimmed;
}

function findEmbeddedJson(text: string): string | null {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;

    const candidate = readBalancedJson(text, i);
    if (!candidate) continue;

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning. The first bracket-like block can be prose, not JSON.
    }
  }
  return null;
}

function readBalancedJson(text: string, start: number): string | null {
  const closeFor = (open: string) => (open === "{" ? "}" : "]");
  const stack = [closeFor(text[start])];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(closeFor(ch));
      continue;
    }

    const expected = stack[stack.length - 1];
    if (ch === expected) {
      stack.pop();
      if (stack.length === 0) return text.slice(start, i + 1).trim();
      continue;
    }

    if (ch === "}" || ch === "]") return null;
  }

  return null;
}
