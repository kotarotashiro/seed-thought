import type {
  AiModelOverride,
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  DecodeOutput,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
  NoteSection,
  PostClassificationResult,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  SeminarContent,
  SeminarDesign,
  SourcePostForLearning,
  StrictLearningOutput,
  SynthesisInput,
  SynthesisOutput,
  TranslateTextInput,
  TrendInsight,
} from "./types";
import {
  buildChatPrompt,
  buildClassifyPrompt,
  buildDecodePrompt,
  buildDecodeReviewPrompt,
  buildLearningCorePrompt,
  buildLearningSupplementPrompt,
  buildNoteExpandPrompt,
  buildOutputPrompt,
  buildOutputRefinePrompt,
  buildSeminarContentFixPrompt,
  buildSeminarContentPrompt,
  buildSeminarDesignPrompt,
  buildXFixPrompt,
  MIN_NOTE_CONTENT_CHARS,
  REFINABLE_OUTPUT_TYPES,
  buildSemanticSearchPrompt,
  buildStrictLearningPrompt,
  buildSynthesisPrompt,
  buildTranslatePrompt,
  buildTrendAnalysisPrompt,
} from "./prompts";
import { parseAiJson, tryParseAiJson } from "./json";
import {
  isDecodeOutput,
  isGeneratedOutputResult,
  isLearningCoreOutput,
  isLearningSupplementOutput,
  isNoteSectionArray,
  isPostClassificationResult,
  isSemanticSearchResult,
  isSeminarContent,
  isSeminarDesign,
  isStrictLearningOutput,
  isTrendInsight,
  isTranslatedTextResult,
  validateSynthesisOutput,
  type LearningCoreOutput,
  type LearningSupplementOutput,
} from "./validation";
import { mergeClassificationFallback } from "./fallback";
import {
  getAiRuntimeSettings,
  resolveProviderModel,
  type AiProviderName,
  type AiTaskName,
} from "./settings";
import { mockProvider } from "./mockProvider";
import { getProfile, type FixedProfile } from "@/lib/profile/fixedProfile";
import { getGrokClient } from "./providers/grokProvider";
import { getClaudeClient } from "./providers/claudeProvider";
import { getOpenAIClient } from "./providers/openaiProvider";
import { getGeminiClient } from "./providers/geminiProvider";
import { getKimiClient } from "./providers/kimiProvider";
import type { LLMClient } from "./providers/types";

function buildLLMClient(
  provider: AiProviderName,
  model: string,
  apiKey: string | null
): LLMClient {
  const config = { model, apiKey: apiKey ?? "" };
  switch (provider) {
    case "claude": return getClaudeClient(config);
    case "openai": return getOpenAIClient(config);
    case "gemini": return getGeminiClient(config);
    case "kimi":   return getKimiClient(config);
    default:       return getGrokClient(config);
  }
}

async function getClient(
  task: AiTaskName,
  override?: AiModelOverride | null
): Promise<{
  client: LLMClient;
  isMock: boolean;
  provider: string;
  model: string;
}> {
  // 工程別設定を無視して、その場で指定されたモデルを使う（投稿ごとの使い分け）
  if (override?.provider) {
    const resolved = await resolveProviderModel(
      override.provider as AiProviderName,
      override.model
    );
    if (resolved.provider === "mock") {
      return {
        client: null as unknown as LLMClient,
        isMock: true,
        provider: "mock",
        model: "mock",
      };
    }
    if (!resolved.apiKey) {
      throw new Error(
        `[ai/${task}] provider=${resolved.provider} の APIキーが見つかりません。設定画面でAPIキーを登録してください。`
      );
    }
    return {
      client: buildLLMClient(resolved.provider, resolved.model, resolved.apiKey),
      isMock: false,
      provider: resolved.provider,
      model: resolved.model,
    };
  }

  const settings = await getAiRuntimeSettings();
  if (settings.tasks[task].provider === "mock") {
    return {
      client: null as unknown as LLMClient,
      isMock: true,
      provider: "mock",
      model: "mock",
    };
  }
  const { provider, model, apiKey } = settings.tasks[task];
  if (!apiKey) {
    throw new Error(
      `[ai/${task}] provider=${provider} の APIキーが見つかりません。設定画面でAPIキーを登録してください。`
    );
  }
  return {
    client: buildLLMClient(provider, model, apiKey),
    isMock: false,
    provider,
    model,
  };
}

// 並列生成した「本体」「補足」「解読」を1つの LearningOutput にまとめる。
// 補足・解読が欠けた（タイムアウト/形式不正で null）場合は安全なデフォルトで埋め、
// 本体だけでもカードが成立するようにする。
function mergeLearningOutput(
  input: SourcePostForLearning,
  core: LearningCoreOutput,
  supplement: LearningSupplementOutput | null,
  decode: DecodeOutput | null
): LearningOutput {
  return {
    ...core,
    sourcePostId: input.id,
    beginnerZone: supplement?.beginnerZone,
    diagramStructure: supplement?.diagramStructure ?? { title: core.title, sections: [] },
    imageExplanationPrompt: supplement?.imageExplanationPrompt ?? "",
    userLearningMemo: supplement?.userLearningMemo ?? core.summary ?? "",
    backgroundContext: supplement?.backgroundContext ?? null,
    decode,
    status: "draft",
  };
}

// 検証ガードは周辺フィールドの欠落を許容するため、欠落分をデフォルトで埋めて型を満たす。
function normalizeDecode(d: DecodeOutput): DecodeOutput {
  return {
    evidenceQuotes: d.evidenceQuotes ?? [],
    oneLiner: d.oneLiner,
    whySignificant: d.whySignificant,
    beforeAfter: d.beforeAfter,
    mechanism: d.mechanism ?? null,
    extractedPattern: d.extractedPattern ?? null,
    adjacentPatterns: d.adjacentPatterns ?? null,
    synthesisTags: d.synthesisTags ?? [],
    outputSeed: d.outputSeed ?? { angle: "", hook: null },
  };
}

// 解読器（SeedThought 2）: 解読の生成→検品の直列チェーン。
// Promise.all の並列枠内で走らせるため、体感時間は max(本体, 補足, 解読+検品)。
// 検品は best-effort：{"ok": true} や形式不正が返ったら初回の解読を採用する。
async function generateDecodeWithReview(
  client: LLMClient,
  input: SourcePostForLearning,
  profile: FixedProfile
): Promise<DecodeOutput | null> {
  const raw = await client.chatJson(buildDecodePrompt(input, profile));
  const decode = tryParseAiJson(raw, isDecodeOutput, "解読");
  if (!decode) return null;

  try {
    const reviewRaw = await client.chatJson(
      buildDecodeReviewPrompt(JSON.stringify(decode, null, 2), input)
    );
    // 修正版（DecodeOutput全体）が返ったときだけ差し替える。{"ok": true} 等は初回を採用。
    const reviewed = tryParseAiJson(reviewRaw, isDecodeOutput, "解読(検品)");
    if (reviewed) return normalizeDecode(reviewed);
  } catch (reviewErr) {
    console.warn(
      "[ai/generateLearningCard] 解読の検品に失敗、初回の解読を採用:",
      reviewErr instanceof Error ? reviewErr.message : reviewErr
    );
  }
  return normalizeDecode(decode);
}

// chatJson→検証つきパースを、形式不正時に1回だけ再試行するヘルパー。
// gemini-3.1-pro-preview は全体スキーマでなく内側のオブジェクトだけを返すことが確率的にあり
// （実測: 学習カード本体・セミナー設計で発生）、再試行で解消することが多い。
async function chatJsonValidated<T>(
  client: LLMClient,
  prompt: string,
  guard: (v: unknown) => v is T,
  label: string,
  retries = 1
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await client.chatJson(prompt);
      return parseAiJson(raw, guard, label);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`[ai] ${label} の応答が形式不正、再試行します（${attempt + 1}/${retries}回目）`);
      }
    }
  }
  throw lastErr;
}

async function generateSynthesisWithRetry(
  client: LLMClient,
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const prompt = buildSynthesisPrompt(input);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const raw = await client.chatJson(prompt);
      const parsed = parseAiJson(
        raw,
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null && !Array.isArray(value),
        "掛け合わせ生成"
      );
      return validateSynthesisOutput(parsed);
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        console.warn("[ai/generateSynthesis] 応答が形式不正、再試行します（1/1回目）");
      }
    }
  }
  throw lastErr;
}

// LLM 呼び出し失敗時に provider/model/task を含めた診断ログを出す
function logAiError(task: AiTaskName, provider: string, model: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ai/${task}] provider=${provider} model=${model} call failed: ${message}`);
}

// X投稿の機械チェック。プロンプト指示だけでは140〜280字やsatoriTypeUsedの記録が
// 破られることがあるため、決定論的に検証する（xSatoriSelfReview のルール6・型記録に対応）。
function validateXOutput(result: GeneratedOutputResult): string[] {
  const violations: string[] = [];
  const len = result.content.trim().length;
  if (len < 140) violations.push(`本文が${len}字で140字未満（薄い。ベネフィットか具体例を書き足す）`);
  if (len > 280) violations.push(`本文が${len}字で280字を超えている（削って収める）`);
  if (!result.satoriTypeUsed) violations.push("satoriTypeUsed（使用した型 A〜E）が記録されていない");
  return violations;
}

// セミナー②中身の機械チェック。プロンプト指示だけでは省略される
// （実測: スライド2枚・章詳細1件・テンプレが説明文）ため決定論的に検証する。
function validateSeminarContent(content: SeminarContent, design: SeminarDesign): string[] {
  const violations: string[] = [];
  if (content.slides.length < 15) {
    violations.push(`スライドが${content.slides.length}枚しかない（15〜25枚必要。章ごとに2〜4枚＋表紙・アジェンダ・まとめ）`);
  }
  if (content.chapterDetails.length < design.schedule.length) {
    violations.push(
      `章詳細が${content.chapterDetails.length}件（スケジュール${design.schedule.length}パート全てに必要）`
    );
  }
  const templates = content.templates ?? {};
  for (const key of ["basic", "snsPost"]) {
    const v = templates[key];
    if (typeof v === "string" && v.length > 0 && v.length < 40) {
      violations.push(`templates.${key} が${v.length}字と短く実物になっていない（コピーしてそのまま使える文面が必要）`);
    }
  }
  return violations;
}

// セミナーの2分割生成: ①設計（骨格）→ ②中身（台本・スライド・テンプレ実物）→ 機械チェック＋1回修正。
// 巨大スキーマの1ショットはモデルが省略するため分割する。②は①に厳密に従わせる。
// 所要時間は2〜3呼び出しの直列（grok実測 約30秒/回）で maxDuration=300 に収まる。
async function generateSeminarOutput(
  client: LLMClient,
  input: GenerateOutputInput,
  ctx: { provider: string; model: string }
): Promise<GeneratedOutputResult> {
  const design = await chatJsonValidated(
    client,
    await buildSeminarDesignPrompt(input),
    isSeminarDesign,
    "セミナー設計"
  );

  let content = await chatJsonValidated(
    client,
    buildSeminarContentPrompt(input, design),
    isSeminarContent,
    "セミナー中身"
  );

  const violations = validateSeminarContent(content, design);
  if (violations.length > 0) {
    try {
      const fixedRaw = await client.chatJson(buildSeminarContentFixPrompt(design, content, violations));
      const fixed = parseAiJson(fixedRaw, isSeminarContent, "セミナー中身修正");
      // 改悪防止: 修正後に違反が減ったときだけ差し替える
      if (validateSeminarContent(fixed, design).length < violations.length) {
        content = fixed;
      } else {
        console.warn(
          `[ai/generateOutput] セミナー修正パス後も基準未達、初回を採用 provider=${ctx.provider} model=${ctx.model}: ${violations.join(", ")}`
        );
      }
    } catch (fixErr) {
      console.warn(
        `[ai/generateOutput] セミナー修正パスに失敗、初回の中身で続行 provider=${ctx.provider} model=${ctx.model}:`,
        fixErr instanceof Error ? fixErr.message : fixErr
      );
    }
  }

  return {
    title: design.seminar.name,
    content: typeof design.finalStatement === "string" ? design.finalStatement : "",
    contentJson: { ...design, ...content } as Record<string, unknown>,
  };
}

// note セクション配列を連結して content 文字列を組み立てる。
// 各セクションは「## heading\n\nbody」形式でつなぎ、コピーや既存のpre表示に馴染む。
function assembleNoteContent(sections: NoteSection[]): string {
  return sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n");
}

// note 生成結果からセクションを取り出して content を組み立てる。
// 下限割れなら expandFn（拡張パス）を1回だけ呼ぶ。失敗時は初回を採用。
async function buildNoteResult(
  raw: GeneratedOutputResult,
  authorRef: string,
  ctx: { provider: string; model: string },
  input: GenerateOutputInput,
  expandFn: (sections: NoteSection[], currentLen: number) => Promise<NoteSection[] | null>
): Promise<GeneratedOutputResult> {
  const cj = raw.contentJson as { source?: string; sections?: unknown } | undefined;
  const sections: NoteSection[] = isNoteSectionArray(cj?.sections) ? cj.sections : [];

  // セクションが取れなかった（モデルが構造を無視した等）→ そのまま返す
  if (sections.length === 0) return raw;

  let finalSections = sections;
  let assembled = assembleNoteContent(finalSections);
  const len = assembled.replace(/[\r\n]/g, "").length;

  if (len < MIN_NOTE_CONTENT_CHARS) {
    console.warn(
      `[ai/generateOutput] note セクション合計${len}字で下限(${MIN_NOTE_CONTENT_CHARS})割れ、拡張パスを呼ぶ provider=${ctx.provider} model=${ctx.model}`
    );
    try {
      const expanded = await expandFn(sections, len);
      if (expanded && expanded.length > 0) {
        const expandedContent = assembleNoteContent(expanded);
        if (expandedContent.replace(/[\r\n]/g, "").length > len) {
          finalSections = expanded;
          assembled = expandedContent;
        }
      }
    } catch (expandErr) {
      console.warn(
        `[ai/generateOutput] note 拡張パス失敗、初回を採用 provider=${ctx.provider} model=${ctx.model}:`,
        expandErr instanceof Error ? expandErr.message : expandErr
      );
    }
  }

  return {
    title: raw.title,
    content: assembled,
    contentJson: { source: cj?.source ?? authorRef, sections: finalSections },
  };
}


export function getAiProvider(): AiProvider {
  return {
    async classifyPost(input: ClassifyPostInput): Promise<PostClassificationResult> {
      const ctx = await getClient("classifyPost");
      if (ctx.isMock) return mockProvider.classifyPost(input);
      try {
        const prompt = await buildClassifyPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        const classification = parseAiJson(result, isPostClassificationResult, "投稿分類");
        return mergeClassificationFallback(input.text, classification);
      } catch (err) {
        logAiError("classifyPost", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async translateText(input: TranslateTextInput): Promise<string> {
      const ctx = await getClient("translateText");
      if (ctx.isMock) return input.text;
      try {
        const prompt = buildTranslatePrompt(input);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isTranslatedTextResult, "日本語翻訳").translatedText;
      } catch (err) {
        logAiError("translateText", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateLearningCard(
      input: SourcePostForLearning,
      override?: AiModelOverride | null
    ): Promise<LearningOutput> {
      const ctx = await getClient("generateLearningCard", override);
      if (ctx.isMock) return mockProvider.generateLearningCard(input);
      try {
        // 1ショットだと出力JSONが巨大で Kimi k2.6 は300秒を超えて打ち切られる。
        // 「本体」「補足」「解読」を並列実行し、体感時間を max(本体, 補足, 解読+検品) に抑える。
        // 本体は必須、補足・解読は best-effort（欠けても本体だけでカードを成立させる）。
        // settings で設定したプロフィール（テーマ・知識コンテキスト）をプロンプトに渡す。
        const profile = await getProfile();
        const [core, supplementRaw, decode] = await Promise.all([
          // 本体は必須。形式不正（内側オブジェクトだけ返す等）は1回だけ再試行する。
          chatJsonValidated(
            ctx.client,
            buildLearningCorePrompt(input, profile),
            isLearningCoreOutput,
            "学習カード(本体)"
          ),
          ctx.client.chatJson(buildLearningSupplementPrompt(input, profile)).catch((err) => {
            console.warn(
              `[ai/generateLearningCard] 補足の生成に失敗（本体のみで続行） provider=${ctx.provider} model=${ctx.model}:`,
              err instanceof Error ? err.message : err
            );
            return "";
          }),
          generateDecodeWithReview(ctx.client, input, profile).catch((err) => {
            console.warn(
              `[ai/generateLearningCard] 解読の生成に失敗（解読なしで続行） provider=${ctx.provider} model=${ctx.model}:`,
              err instanceof Error ? err.message : err
            );
            return null;
          }),
        ]);
        const supplement = supplementRaw
          ? tryParseAiJson(supplementRaw, isLearningSupplementOutput, "学習カード(補足)")
          : null;
        return mergeLearningOutput(input, core, supplement, decode);
      } catch (err) {
        logAiError("generateLearningCard", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const ctx = await getClient("generateOutput");
      if (ctx.isMock) return mockProvider.generateOutput(input);
      try {
        // セミナーは2分割生成（設計→中身→機械チェック）の専用パス。
        // buildOutputPrompt のセミナー1ショット指示は通らない。
        if (input.outputType === "seminar") {
          return await generateSeminarOutput(ctx.client, input, ctx);
        }

        const prompt = await buildOutputPrompt(input);
        const raw = await ctx.client.chatJson(prompt);
        const result = parseAiJson(raw, isGeneratedOutputResult, "アウトプット生成");

        // note は「セクション分割1パス生成」方式。改稿パスを通さず構造で字数を保証する。
        // sections を連結して content を組み立て、下限割れなら拡張パスを1回だけ呼ぶ。
        if (input.outputType === "note") {
          const authorRef = input.postAuthorUsername
            ? `@${input.postAuthorUsername}${input.postAuthorName ? `（${input.postAuthorName}）` : ""}`
            : input.postAuthorName ?? "元投稿者";
          return buildNoteResult(result, authorRef, ctx, input, async (sections, currentLen) => {
            const expandPrompt = buildNoteExpandPrompt(input, sections, currentLen);
            const expandedRaw = await ctx.client.chatJson(expandPrompt);
            const expandedParsed = JSON.parse(expandedRaw) as { sections?: unknown };
            return isNoteSectionArray(expandedParsed.sections) ? expandedParsed.sections : null;
          });
        }

        // X媒体のさとり構文: 使用した型を result に付与する。
        // auto の場合はAIが satoriTypeUsed をJSONに含めて返すので、そのまま使う。
        // 型指定の場合は input.satoriType を直接セットする。
        if (input.outputType === "x" && input.satoriType && input.satoriType !== "auto") {
          result.satoriTypeUsed = input.satoriType;
        }

        // 2段生成: 散文・説得が効く媒体（x/instagram/short_video）は下書きを編集者視点で添削させてから書き直す。
        // 改稿は別呼び出しに分けるのが要点（同一生成内の自己添削は効かない）。
        // 改稿パスは temperature を上げて下書きの echo を避ける。
        // 改稿に失敗しても下書きで続行する（品質は落ちるが出力は返す）。
        let finalResult = result;
        if (input.outputType in REFINABLE_OUTPUT_TYPES) {
          try {
            const refinePrompt = buildOutputRefinePrompt(input, result);
            const refinedRaw = await ctx.client.chatJson(refinePrompt, { temperature: 0.6 });
            const refined = parseAiJson(refinedRaw, isGeneratedOutputResult, "アウトプット改稿");
            // satoriTypeUsed は改稿パスでは生成しないので1パス目の値を引き継ぐ
            if (result.satoriTypeUsed && !refined.satoriTypeUsed) {
              refined.satoriTypeUsed = result.satoriTypeUsed;
            }
            finalResult = refined;
          } catch (refineErr) {
            console.warn(
              `[ai/generateOutput] ${input.outputType} の改稿に失敗、下書きで続行 provider=${ctx.provider} model=${ctx.model}:`,
              refineErr instanceof Error ? refineErr.message : refineErr
            );
            finalResult = result;
          }
        }

        // X投稿の機械チェック＋修正パス。プロンプト指示だけでは字数・型記録が破られることがあるため、
        // 違反を検出したときだけ1回修正させる（改悪防止: 修正後も違反が減らなければ直前の結果を採用）。
        if (input.outputType === "x") {
          const violations = validateXOutput(finalResult);
          if (violations.length > 0) {
            try {
              const fixPrompt = buildXFixPrompt(input, finalResult, violations);
              const fixedRaw = await ctx.client.chatJson(fixPrompt, { temperature: 0.4 });
              const fixed = parseAiJson(fixedRaw, isGeneratedOutputResult, "X投稿修正");
              if (!fixed.satoriTypeUsed) {
                fixed.satoriTypeUsed =
                  finalResult.satoriTypeUsed ??
                  (input.satoriType && input.satoriType !== "auto" ? input.satoriType : undefined);
              }
              const remaining = validateXOutput(fixed);
              if (remaining.length < violations.length) {
                finalResult = fixed;
              } else {
                console.warn(
                  `[ai/generateOutput] X修正パス後も基準未達、直前の結果を採用 provider=${ctx.provider} model=${ctx.model}: ${remaining.join(", ")}`
                );
              }
            } catch (fixErr) {
              console.warn(
                `[ai/generateOutput] X修正パスに失敗、直前の結果で続行 provider=${ctx.provider} model=${ctx.model}:`,
                fixErr instanceof Error ? fixErr.message : fixErr
              );
            }
          }
        }

        return finalResult;
      } catch (err) {
        logAiError("generateOutput", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateSynthesis(input: SynthesisInput): Promise<SynthesisOutput> {
      const ctx = await getClient("generateSynthesis");
      if (ctx.isMock) return mockProvider.generateSynthesis(input);
      try {
        return await generateSynthesisWithRetry(ctx.client, input);
      } catch (err) {
        logAiError("generateSynthesis", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateStrictLearning(input: {
      postText: string;
      classification: { primaryCategory: string; summary: string };
      articleTitle?: string;
      articleDescription?: string;
      learningCardJson?: string;
      userMemo?: string | null;
    }): Promise<StrictLearningOutput> {
      const ctx = await getClient("generateStrictLearning");
      if (ctx.isMock) return mockProvider.generateStrictLearning(input);
      try {
        const prompt = await buildStrictLearningPrompt(input);
        const result = await ctx.client.chatJson(prompt);
        const wrapper = parseAiJson(result, isGeneratedOutputResult, "厳密学習");
        if (!isStrictLearningOutput(wrapper.contentJson)) {
          throw new Error("厳密学習の形式が不正です");
        }
        return wrapper.contentJson as unknown as StrictLearningOutput;
      } catch (err) {
        logAiError("generateStrictLearning", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async searchSemantically(
      query: string,
      posts: PostSummaryForSearch[]
    ): Promise<SemanticSearchResult> {
      const ctx = await getClient("searchSemantically");
      if (ctx.isMock) return mockProvider.searchSemantically(query, posts);
      try {
        const prompt = buildSemanticSearchPrompt(query, posts);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isSemanticSearchResult, "セマンティック検索");
      } catch (err) {
        logAiError("searchSemantically", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async analyzeLikeTrends(posts: PostSummaryForTrend[]): Promise<TrendInsight> {
      const ctx = await getClient("analyzeLikeTrends");
      if (ctx.isMock) return mockProvider.analyzeLikeTrends(posts);
      try {
        const prompt = await buildTrendAnalysisPrompt(posts);
        const result = await ctx.client.chatJson(prompt);
        return parseAiJson(result, isTrendInsight, "傾向分析");
      } catch (err) {
        logAiError("analyzeLikeTrends", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async chat(
      message: string,
      history: ChatMessage[],
      posts: PostContext[]
    ): Promise<string> {
      const ctx = await getClient("chat");
      if (ctx.isMock) return mockProvider.chat(message, history, posts);
      try {
        const prompt = await buildChatPrompt(message, history, posts);
        return await ctx.client.chatText(prompt);
      } catch (err) {
        logAiError("chat", ctx.provider, ctx.model, err);
        throw err;
      }
    },
  };
}
