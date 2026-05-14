export const fixedProfile = {
  name: "そら",
  role: "AI活用・SNS運用・LINE導線設計を発信する個人クリエイター",
  themes: ["AI活用", "Instagram", "公式LINE", "チラシ", "セミナー", "マーケティング"],
  outputChannels: ["X", "Instagram", "note"],
  tone: "やさしく、実用的で、少し本音感のある文章",
} as const;

export type FixedProfile = typeof fixedProfile;
