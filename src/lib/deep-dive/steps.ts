export const THOUGHT_LENS_STEPS = [
  { key: "surface_claim", title: "表面的な主張" },
  { key: "hidden_premise", title: "背後にある前提" },
  { key: "essence", title: "この投稿の本質" },
  { key: "counter_argument", title: "反論・成立条件" },
  { key: "apply_to_work", title: "自分の仕事に置き換える" },
  { key: "own_words", title: "自分の言葉でまとめる" },
] as const;

export const LEARNING_LESSON_STEPS = [
  { key: "what_to_learn", title: "この投稿から学べること" },
  { key: "basics", title: "基礎知識" },
  { key: "mechanism", title: "仕組み" },
  { key: "practical_steps", title: "実践手順" },
  { key: "examples", title: "具体例" },
  { key: "try_with_theme", title: "自分のテーマで試す" },
  { key: "comprehension_check", title: "理解チェック" },
] as const;

export function getStepDefinitions(mode: "thought_lens" | "learning_lesson") {
  return mode === "thought_lens" ? THOUGHT_LENS_STEPS : LEARNING_LESSON_STEPS;
}

export function getTotalSteps(mode: "thought_lens" | "learning_lesson"): number {
  return mode === "thought_lens" ? 6 : 7;
}
