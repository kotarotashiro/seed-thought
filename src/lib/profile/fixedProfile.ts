import { prisma } from "@/lib/db/prisma";

export const fixedProfile = {
  name: "そら",
  role: "AI活用・SNS運用・LINE導線設計を発信する個人クリエイター",
  themes: ["AI活用", "Instagram", "公式LINE", "チラシ", "セミナー", "マーケティング"],
  outputChannels: ["X", "Instagram", "note"],
  tone: "やさしく、実用的で、少し本音感のある文章",
} as const;

export type FixedProfile = {
  name: string;
  role: string;
  themes: string[];
  outputChannels: string[];
  tone: string;
};

const PROFILE_SETTING_KEY = "profile";

function normalizeList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const list = value
    .map((item) => String(item).trim())
    .filter(Boolean);
  return list.length > 0 ? list : [...fallback];
}

type ProfileInput = Partial<Omit<FixedProfile, "themes" | "outputChannels">> & {
  themes?: readonly string[];
  outputChannels?: readonly string[];
};

export function normalizeProfile(value: ProfileInput): FixedProfile {
  return {
    name: String(value.name || fixedProfile.name).trim() || fixedProfile.name,
    role: String(value.role || fixedProfile.role).trim() || fixedProfile.role,
    themes: normalizeList(value.themes, fixedProfile.themes),
    outputChannels: normalizeList(value.outputChannels, fixedProfile.outputChannels),
    tone: String(value.tone || fixedProfile.tone).trim() || fixedProfile.tone,
  };
}

export async function getProfile(): Promise<FixedProfile> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PROFILE_SETTING_KEY },
  });

  if (!setting) return normalizeProfile(fixedProfile);

  try {
    return normalizeProfile(JSON.parse(setting.valueJson));
  } catch {
    return normalizeProfile(fixedProfile);
  }
}

export async function saveProfile(profile: FixedProfile): Promise<FixedProfile> {
  const normalized = normalizeProfile(profile);

  await prisma.appSetting.upsert({
    where: { key: PROFILE_SETTING_KEY },
    create: {
      key: PROFILE_SETTING_KEY,
      valueJson: JSON.stringify(normalized),
    },
    update: {
      valueJson: JSON.stringify(normalized),
    },
  });

  return normalized;
}
