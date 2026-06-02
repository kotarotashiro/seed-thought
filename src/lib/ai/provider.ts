import type {
  AiModelOverride,
  AiProvider,
  ChatMessage,
  ClassifyPostInput,
  GenerateOutputInput,
  GeneratedOutputResult,
  LearningOutput,
  NoteSection,
  PostClassificationResult,
  PostContext,
  PostSummaryForSearch,
  PostSummaryForTrend,
  SemanticSearchResult,
  SourcePostForLearning,
  StrictLearningOutput,
  TranslateTextInput,
  TrendInsight,
} from "./types";
import {
  buildChatPrompt,
  buildClassifyPrompt,
  buildLearningCorePrompt,
  buildLearningSupplementPrompt,
  buildNoteExpandPrompt,
  buildOutputPrompt,
  buildOutputRefinePrompt,
  MIN_NOTE_CONTENT_CHARS,
  REFINABLE_OUTPUT_TYPES,
  buildSemanticSearchPrompt,
  buildStrictLearningPrompt,
  buildTranslatePrompt,
  buildTrendAnalysisPrompt,
} from "./prompts";
import { parseAiJson, tryParseAiJson } from "./json";
import {
  isGeneratedOutputResult,
  isLearningCoreOutput,
  isLearningSupplementOutput,
  isNoteSectionArray,
  isPostClassificationResult,
  isSemanticSearchResult,
  isStrictLearningOutput,
  isTrendInsight,
  isTranslatedTextResult,
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

// 並列生成した「本体」と「補足」を1つの LearningOutput にまとめる。
// 補足が欠けた（タイムアウト/形式不正で null）場合は安全なデフォルトで埋め、
// 本体だけでもカードが成立するようにする。
function mergeLearningOutput(
  input: SourcePostForLearning,
  core: LearningCoreOutput,
  supplement: LearningSupplementOutput | null
): LearningOutput {
  return {
    ...core,
    sourcePostId: input.id,
    beginnerZone: supplement?.beginnerZone,
    diagramStructure: supplement?.diagramStructure ?? { title: core.title, sections: [] },
    imageExplanationPrompt: supplement?.imageExplanationPrompt ?? "",
    userLearningMemo: supplement?.userLearningMemo ?? core.summary ?? "",
    backgroundContext: supplement?.backgroundContext ?? null,
    status: "draft",
  };
}

// LLM 呼び出し失敗時に provider/model/task を含めた診断ログを出す
function logAiError(task: AiTaskName, provider: string, model: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ai/${task}] provider=${provider} model=${model} call failed: ${message}`);
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
        // 「本体」と「補足」を並列実行し、体感時間を max(本体, 補足) に抑える。
        // 本体は必須、補足は best-effort（欠けても本体だけでカードを成立させる）。
        const [coreRaw, supplementRaw] = await Promise.all([
          ctx.client.chatJson(buildLearningCorePrompt(input)),
          ctx.client.chatJson(buildLearningSupplementPrompt(input)).catch((err) => {
            console.warn(
              `[ai/generateLearningCard] 補足の生成に失敗（本体のみで続行） provider=${ctx.provider} model=${ctx.model}:`,
              err instanceof Error ? err.message : err
            );
            return "";
          }),
        ]);
        const core = parseAiJson(coreRaw, isLearningCoreOutput, "学習カード(本体)");
        const supplement = supplementRaw
          ? tryParseAiJson(supplementRaw, isLearningSupplementOutput, "学習カード(補足)")
          : null;
        return mergeLearningOutput(input, core, supplement);
      } catch (err) {
        logAiError("generateLearningCard", ctx.provider, ctx.model, err);
        throw err;
      }
    },

    async generateOutput(input: GenerateOutputInput): Promise<GeneratedOutputResult> {
      const ctx = await getClient("generateOutput");
      if (ctx.isMock) return mockProvider.generateOutput(input);
      try {
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
            const expandPrompt = buildNoteExpandPrompt(authorRef, sections, currentLen);
            const expandedRaw = await ctx.client.chatJson(expandPrompt);
            const expandedParsed = JSON.parse(expandedRaw) as { sections?: unknown };
            return isNoteSectionArray(expandedParsed.sections) ? expandedParsed.sections : null;
          });
        }

        // 2段生成: 散文・説得が効く媒体（x/instagram/short_video）は下書きを編集者視点で添削させてから書き直す。
        // 改稿は別呼び出しに分けるのが要点（同一生成内の自己添削は効かない）。
        // 改稿パスは temperature を上げて下書きの echo を避ける。
        // 改稿に失敗しても下書きで続行する（品質は落ちるが出力は返す）。
        if (input.outputType in REFINABLE_OUTPUT_TYPES) {
          try {
            const refinePrompt = buildOutputRefinePrompt(input, result);
            const refinedRaw = await ctx.client.chatJson(refinePrompt, { temperature: 0.6 });
            return parseAiJson(refinedRaw, isGeneratedOutputResult, "アウトプット改稿");
          } catch (refineErr) {
            console.warn(
              `[ai/generateOutput] ${input.outputType} の改稿に失敗、下書きで続行 provider=${ctx.provider} model=${ctx.model}:`,
              refineErr instanceof Error ? refineErr.message : refineErr
            );
            return result;
          }
        }
        return result;
      } catch (err) {
        logAiError("generateOutput", ctx.provider, ctx.model, err);
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
