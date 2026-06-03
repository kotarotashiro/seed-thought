"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Copy, Check, ChevronDown, ChevronUp, ExternalLink, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";

interface OutputPreviewProps {
  title: string;
  content: string;
  contentJson?: Record<string, unknown> | null;
  outputType: string;
  /** 渡されたときだけ削除ボタンを表示する（生成履歴で使用）。 */
  onDelete?: () => Promise<void> | void;
}

function SeminarSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-border-light transition-colors"
      >
        <span className="text-sm font-semibold text-text">{label}</span>
        {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

export function OutputPreview({ title, content, contentJson, outputType, onDelete }: OutputPreviewProps) {
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedUrl, setPostedUrl] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: "生成履歴を削除",
      message: "この生成結果を削除します。元に戻せません。",
      confirmLabel: "削除する",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const deleteButton = onDelete ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      loading={deleting}
      loadingLabel="削除中..."
      className="gap-1.5 text-danger hover:bg-danger/10"
    >
      <Trash2 className="h-3.5 w-3.5" />
      削除
    </Button>
  ) : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePostToX = async () => {
    const ok = await confirm({
      title: "Xに投稿",
      message: "Xに投稿します。続行しますか？\n（280字を超える場合は自動でスレッド分割されます）",
      confirmLabel: "投稿する",
    });
    if (!ok) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "投稿に失敗しました");
      setPostedUrl(data.firstUrl || null);
    } catch (e) {
      setPostError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const showXPostButton = outputType === "x";

  // ---------- Strict Learning display ----------
  if (outputType === "strict_learning" && contentJson) {
    type StrictJson = {
      oneLiner?: string;
      whyItMatters?: string;
      prerequisites?: string;
      claimBreakdown?: {
        claim?: string;
        background?: string;
        assumption?: string;
        evidence?: string;
        counterExample?: string;
        limit?: string;
      };
      strictLearningView?: {
        positiveExamples?: string[];
        negativeExamples?: string[];
        boundaryExamples?: string[];
        necessaryConditions?: string[];
        typicalFeatures?: string[];
        essence?: string;
      };
      abstraction?: string;
      transferToOtherFields?: Array<{ field: string; application: string }>;
      applyToYourself?: string;
      fifteenMinuteExercise?: {
        goal?: string;
        steps?: string[];
        deliverable?: string;
      };
    };
    const j = contentJson as StrictJson;
    const fullText = [
      `# ${title}`,
      "",
      `## 一言でいうと`,
      j.oneLiner ?? "",
      "",
      `## 何が重要なのか`,
      j.whyItMatters ?? "",
      "",
      `## 前提知識`,
      j.prerequisites ?? "",
      "",
      `## 主張の分解`,
      `- 主張: ${j.claimBreakdown?.claim ?? ""}`,
      `- 背景: ${j.claimBreakdown?.background ?? ""}`,
      `- 前提: ${j.claimBreakdown?.assumption ?? ""}`,
      `- 根拠: ${j.claimBreakdown?.evidence ?? ""}`,
      `- 反例: ${j.claimBreakdown?.counterExample ?? ""}`,
      `- 限界: ${j.claimBreakdown?.limit ?? ""}`,
      "",
      `## 厳密学習で見る`,
      `- 正例: ${(j.strictLearningView?.positiveExamples ?? []).join(" / ")}`,
      `- 反例: ${(j.strictLearningView?.negativeExamples ?? []).join(" / ")}`,
      `- 境界事例: ${(j.strictLearningView?.boundaryExamples ?? []).join(" / ")}`,
      `- 必要条件: ${(j.strictLearningView?.necessaryConditions ?? []).join(" / ")}`,
      `- 典型特徴: ${(j.strictLearningView?.typicalFeatures ?? []).join(" / ")}`,
      `- 本質: ${j.strictLearningView?.essence ?? ""}`,
      "",
      `## 抽象化すると`,
      j.abstraction ?? "",
      "",
      `## 別分野に転用すると`,
      ...((j.transferToOtherFields ?? []).map((t) => `- ${t.field}: ${t.application}`)),
      "",
      `## 自分に使うなら`,
      j.applyToYourself ?? "",
      "",
      `## 15分ワーク`,
      `ゴール: ${j.fifteenMinuteExercise?.goal ?? ""}`,
      ...((j.fifteenMinuteExercise?.steps ?? []).map((s, i) => `${i + 1}. ${s}`)),
      `成果物: ${j.fifteenMinuteExercise?.deliverable ?? ""}`,
    ].join("\n");

    const handleCopyFull = async () => {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const renderList = (items?: string[]) =>
      (items ?? []).length > 0 ? (
        <ul className="space-y-1">
          {(items ?? []).map((s, i) => (
            <li key={i} className="text-sm text-text-secondary">・{s}</li>
          ))}
        </ul>
      ) : null;

    return (
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-text">{title}</h3>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyFull} className="gap-1.5">
              {copied ? (
                <><Check className="h-3.5 w-3.5" />コピーしました</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />全文コピー</>
              )}
            </Button>
            {deleteButton}
          </div>
        </div>

        {j.oneLiner && (
          <div className="mb-4 rounded-xl bg-accent-subtle px-4 py-3">
            <p className="mb-1 text-xs font-medium text-accent">一言でいうと</p>
            <p className="text-base font-semibold text-text">{j.oneLiner}</p>
          </div>
        )}

        <div className="space-y-3">
          {j.whyItMatters && (
            <SeminarSection label="何が重要なのか">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{j.whyItMatters}</p>
            </SeminarSection>
          )}
          {j.prerequisites && (
            <SeminarSection label="前提知識">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{j.prerequisites}</p>
            </SeminarSection>
          )}
          {j.claimBreakdown && (
            <SeminarSection label="主張の分解">
              <div className="space-y-2 text-sm">
                {j.claimBreakdown.claim && <p><span className="font-medium text-text">主張: </span><span className="text-text-secondary">{j.claimBreakdown.claim}</span></p>}
                {j.claimBreakdown.background && <p><span className="font-medium text-text">背景: </span><span className="text-text-secondary">{j.claimBreakdown.background}</span></p>}
                {j.claimBreakdown.assumption && <p><span className="font-medium text-text">前提: </span><span className="text-text-secondary">{j.claimBreakdown.assumption}</span></p>}
                {j.claimBreakdown.evidence && <p><span className="font-medium text-text">根拠: </span><span className="text-text-secondary">{j.claimBreakdown.evidence}</span></p>}
                {j.claimBreakdown.counterExample && <p><span className="font-medium text-text">反例: </span><span className="text-text-secondary">{j.claimBreakdown.counterExample}</span></p>}
                {j.claimBreakdown.limit && <p><span className="font-medium text-text">限界: </span><span className="text-text-secondary">{j.claimBreakdown.limit}</span></p>}
              </div>
            </SeminarSection>
          )}
          {j.strictLearningView && (
            <SeminarSection label="厳密学習で見る">
              <div className="space-y-3 text-sm">
                {(j.strictLearningView.positiveExamples?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-success">✅ 正例（当てはまる例）</p>
                    {renderList(j.strictLearningView.positiveExamples)}
                  </div>
                )}
                {(j.strictLearningView.negativeExamples?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-danger">❌ 反例（似ているが違う例）</p>
                    {renderList(j.strictLearningView.negativeExamples)}
                  </div>
                )}
                {(j.strictLearningView.boundaryExamples?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-text-muted">⚖️ 境界事例</p>
                    {renderList(j.strictLearningView.boundaryExamples)}
                  </div>
                )}
                {(j.strictLearningView.necessaryConditions?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-accent">必要条件</p>
                    {renderList(j.strictLearningView.necessaryConditions)}
                  </div>
                )}
                {(j.strictLearningView.typicalFeatures?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-text-muted">典型特徴（本質ではない）</p>
                    {renderList(j.strictLearningView.typicalFeatures)}
                  </div>
                )}
                {j.strictLearningView.essence && (
                  <div className="rounded-lg bg-accent-subtle px-3 py-2">
                    <p className="mb-1 text-xs font-medium text-accent">本質</p>
                    <p className="text-text">{j.strictLearningView.essence}</p>
                  </div>
                )}
              </div>
            </SeminarSection>
          )}
          {j.abstraction && (
            <SeminarSection label="抽象化すると">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{j.abstraction}</p>
            </SeminarSection>
          )}
          {(j.transferToOtherFields?.length ?? 0) > 0 && (
            <SeminarSection label="別分野に転用すると">
              <div className="space-y-2">
                {j.transferToOtherFields!.map((t, i) => (
                  <div key={i} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-semibold text-text">{t.field}</p>
                    <p className="mt-0.5 text-text-secondary">{t.application}</p>
                  </div>
                ))}
              </div>
            </SeminarSection>
          )}
          {j.applyToYourself && (
            <SeminarSection label="自分に使うなら">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{j.applyToYourself}</p>
            </SeminarSection>
          )}
          {j.fifteenMinuteExercise && (
            <SeminarSection label="15分ワーク">
              <div className="space-y-2 text-sm">
                {j.fifteenMinuteExercise.goal && (
                  <p><span className="font-medium text-text">ゴール: </span><span className="text-text-secondary">{j.fifteenMinuteExercise.goal}</span></p>
                )}
                {(j.fifteenMinuteExercise.steps?.length ?? 0) > 0 && (
                  <ol className="list-inside list-decimal space-y-1">
                    {j.fifteenMinuteExercise.steps!.map((s, i) => (
                      <li key={i} className="text-text-secondary">{s}</li>
                    ))}
                  </ol>
                )}
                {j.fifteenMinuteExercise.deliverable && (
                  <p className="rounded-lg bg-border-light px-3 py-2"><span className="font-medium text-text">成果物: </span><span className="text-text-secondary">{j.fifteenMinuteExercise.deliverable}</span></p>
                )}
              </div>
            </SeminarSection>
          )}
        </div>
      </Card>
    );
  }

  // ---------- Seminar rich display ----------
  if (outputType === "seminar" && contentJson) {
    type SeminarJson = {
      coreInterpretation?: { surface?: string; essence?: string; applicability?: string; participantPain?: string };
      titleOptions?: Array<{ title: string; subtitle: string; targetAudience: string; oneLiner: string }>;
      seminar?: { name?: string; subtitle?: string; targetAudience?: string; outcomes?: string[]; value?: string; whyNow?: string };
      schedule?: Array<{ time: string; part: string; content: string; purpose: string }>;
      chapterDetails?: Array<{ part: string; teachingPoint: string; script: string; slideContent: string; demonstration: string; question: string }>;
      demonstration?: { theme?: string; badExample?: string; goodExample?: string; prompt?: string; expectedOutput?: string; showPoints?: string[] };
      workshop?: { name?: string; purpose?: string; steps?: string[]; fillItems?: string[]; completionImage?: string; facilitatorTips?: string[] };
      templates?: { basic?: string; advanced?: string; fixFailed?: string; snsPost?: string; seminarMaterial?: string; blogNote?: string };
      slides?: Array<{ slideNumber: number; title: string; content: string; visualIdea?: string }>;
      promotion?: { xPost?: string; instagram?: string; line?: string; noteIntro?: string; lpCopy?: string };
      salesFunnel?: { nextProduct?: string; consultationBridge?: string; templateSales?: string; continuationCourse?: string };
      finalStatement?: string;
    };
    const s = contentJson as SeminarJson;

    return (
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-text">{title}</h3>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <><Check className="w-3.5 h-3.5" />コピーしました</> : <><Copy className="w-3.5 h-3.5" />全文コピー</>}
            </Button>
            {deleteButton}
          </div>
        </div>

        {s.seminar && (
          <div className="mb-4 rounded-xl bg-accent-subtle px-4 py-3">
            <p className="text-base font-bold text-text mb-0.5">{s.seminar.name}</p>
            {s.seminar.subtitle && <p className="text-sm text-accent">{s.seminar.subtitle}</p>}
            {s.seminar.targetAudience && <p className="text-xs text-text-secondary mt-2">対象: {s.seminar.targetAudience}</p>}
            {s.seminar.outcomes && s.seminar.outcomes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {s.seminar.outcomes.map((o, i) => <li key={i} className="text-xs text-text">✓ {o}</li>)}
              </ul>
            )}
          </div>
        )}

        {s.finalStatement && (
          <p className="mb-4 text-sm italic text-text-secondary border-l-2 border-accent pl-3">{s.finalStatement}</p>
        )}

        <div className="space-y-2">
          {s.coreInterpretation && (
            <SeminarSection label="1. セミナーの核となる解釈">
              <div className="space-y-3 text-sm">
                {s.coreInterpretation.surface && <div><p className="font-medium text-text mb-1">表面的な内容</p><p className="text-text-secondary">{s.coreInterpretation.surface}</p></div>}
                {s.coreInterpretation.essence && <div><p className="font-medium text-text mb-1">本質</p><p className="text-text-secondary">{s.coreInterpretation.essence}</p></div>}
                {s.coreInterpretation.applicability && <div><p className="font-medium text-text mb-1">応用可能性</p><p className="text-text-secondary">{s.coreInterpretation.applicability}</p></div>}
                {s.coreInterpretation.participantPain && <div><p className="font-medium text-text mb-1">受講者の課題</p><p className="text-text-secondary">{s.coreInterpretation.participantPain}</p></div>}
              </div>
            </SeminarSection>
          )}

          {s.titleOptions && s.titleOptions.length > 0 && (
            <SeminarSection label="2. セミナータイトル案">
              <div className="space-y-3">
                {s.titleOptions.map((t, i) => (
                  <div key={i} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-semibold text-text">{t.title}</p>
                    {t.subtitle && <p className="text-text-secondary text-xs mt-0.5">{t.subtitle}</p>}
                    {t.targetAudience && <p className="text-text-muted text-xs mt-1">→ {t.targetAudience}</p>}
                  </div>
                ))}
              </div>
            </SeminarSection>
          )}

          {s.schedule && s.schedule.length > 0 && (
            <SeminarSection label="4. 90分セミナー構成">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border"><th className="text-left py-1 pr-3 text-text-muted font-medium">時間</th><th className="text-left py-1 pr-3 text-text-muted font-medium">パート</th><th className="text-left py-1 text-text-muted font-medium">内容</th></tr></thead>
                  <tbody>
                    {s.schedule.map((row, i) => (
                      <tr key={i} className="border-b border-border-light">
                        <td className="py-1.5 pr-3 text-text-muted whitespace-nowrap">{row.time}</td>
                        <td className="py-1.5 pr-3 font-medium text-text whitespace-nowrap">{row.part}</td>
                        <td className="py-1.5 text-text-secondary">{row.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SeminarSection>
          )}

          {s.demonstration && (
            <SeminarSection label="6. 実演パート">
              <div className="space-y-3 text-sm">
                {s.demonstration.theme && <p className="font-medium text-text">{s.demonstration.theme}</p>}
                {s.demonstration.badExample && <div className="rounded-lg bg-danger-light px-3 py-2"><p className="text-xs text-danger font-medium mb-1">❌ 悪い例</p><p className="text-text-secondary whitespace-pre-wrap">{s.demonstration.badExample}</p></div>}
                {s.demonstration.goodExample && <div className="rounded-lg bg-success-light px-3 py-2"><p className="text-xs text-success font-medium mb-1">✅ 良い例</p><p className="text-text-secondary whitespace-pre-wrap">{s.demonstration.goodExample}</p></div>}
                {s.demonstration.prompt && <div className="rounded-lg bg-border-light px-3 py-2"><p className="text-xs text-text-muted font-medium mb-1">プロンプト</p><p className="text-text whitespace-pre-wrap font-mono text-xs">{s.demonstration.prompt}</p></div>}
              </div>
            </SeminarSection>
          )}

          {s.workshop && (
            <SeminarSection label="7. ワークパート">
              <div className="space-y-3 text-sm">
                {s.workshop.name && <p className="font-semibold text-text">{s.workshop.name}</p>}
                {s.workshop.purpose && <p className="text-text-secondary">{s.workshop.purpose}</p>}
                {s.workshop.steps && s.workshop.steps.length > 0 && (
                  <ol className="space-y-1 list-decimal list-inside">{s.workshop.steps.map((step, i) => <li key={i} className="text-text-secondary">{step}</li>)}</ol>
                )}
              </div>
            </SeminarSection>
          )}

          {s.templates && (
            <SeminarSection label="8. 配布テンプレート">
              <div className="space-y-3 text-sm">
                {Object.entries(s.templates).filter(([, v]) => v).map(([key, val]) => {
                  const labels: Record<string, string> = { basic: "基本テンプレート", advanced: "応用テンプレート", fixFailed: "修正テンプレート", snsPost: "SNS投稿用", seminarMaterial: "セミナー資料用", blogNote: "ブログ・note用" };
                  return (
                    <div key={key}>
                      <p className="font-medium text-text mb-1">{labels[key] ?? key}</p>
                      <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-border-light rounded-lg px-3 py-2 font-sans">{val as string}</pre>
                    </div>
                  );
                })}
              </div>
            </SeminarSection>
          )}

          {s.slides && s.slides.length > 0 && (
            <SeminarSection label="9. スライド構成案">
              <div className="space-y-2">
                {s.slides.map((slide) => (
                  <div key={slide.slideNumber} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="text-xs text-text-muted mb-0.5">スライド {slide.slideNumber}</p>
                    <p className="font-medium text-text">{slide.title}</p>
                    <p className="text-text-secondary text-xs mt-0.5">{slide.content}</p>
                    {slide.visualIdea && <p className="text-xs text-accent mt-1 italic">💡 {slide.visualIdea}</p>}
                  </div>
                ))}
              </div>
            </SeminarSection>
          )}

          {s.promotion && (
            <SeminarSection label="10. 告知文">
              <div className="space-y-3 text-sm">
                {s.promotion.xPost && <div><p className="font-medium text-text mb-1">X投稿用</p><pre className="whitespace-pre-wrap text-xs text-text-secondary bg-border-light rounded-lg px-3 py-2 font-sans">{s.promotion.xPost}</pre></div>}
                {s.promotion.instagram && <div><p className="font-medium text-text mb-1">Instagram用</p><pre className="whitespace-pre-wrap text-xs text-text-secondary bg-border-light rounded-lg px-3 py-2 font-sans">{s.promotion.instagram}</pre></div>}
                {s.promotion.line && <div><p className="font-medium text-text mb-1">LINE配信用</p><pre className="whitespace-pre-wrap text-xs text-text-secondary bg-border-light rounded-lg px-3 py-2 font-sans">{s.promotion.line}</pre></div>}
                {s.promotion.lpCopy && <div><p className="font-medium text-text mb-1">LPファーストビュー</p><pre className="whitespace-pre-wrap text-xs text-text-secondary bg-border-light rounded-lg px-3 py-2 font-sans">{s.promotion.lpCopy}</pre></div>}
              </div>
            </SeminarSection>
          )}

          {s.salesFunnel && (
            <SeminarSection label="11. 販売導線">
              <div className="space-y-2 text-sm">
                {s.salesFunnel.nextProduct && <div><p className="font-medium text-text">次の商品</p><p className="text-text-secondary">{s.salesFunnel.nextProduct}</p></div>}
                {s.salesFunnel.consultationBridge && <div><p className="font-medium text-text">個別相談へのつなぎ方</p><p className="text-text-secondary">{s.salesFunnel.consultationBridge}</p></div>}
                {s.salesFunnel.continuationCourse && <div><p className="font-medium text-text">継続講座の発展案</p><p className="text-text-secondary">{s.salesFunnel.continuationCourse}</p></div>}
              </div>
            </SeminarSection>
          )}
        </div>
      </Card>
    );
  }

  // ---------- Default display ----------
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? (
              <><Check className="w-3.5 h-3.5" />コピーしました</>
            ) : (
              <><Copy className="w-3.5 h-3.5" />コピーする</>
            )}
          </Button>
          {showXPostButton && (
            <Button
              size="sm"
              onClick={handlePostToX}
              loading={posting}
              loadingLabel="投稿中..."
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Xに投稿
            </Button>
          )}
          {deleteButton}
        </div>
      </div>

      <div className="bg-border-light rounded-xl p-4">
        <pre className="text-sm text-text whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>

      {postError && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {postError}
        </div>
      )}
      {postedUrl && (
        <div className="mt-3 rounded-lg border border-accent/30 bg-accent-light/30 px-3 py-2 text-xs">
          <a
            href={postedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            投稿しました
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Short video segments preview */}
      {outputType === "short_video" && contentJson && "segments" in contentJson && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-text">台本（テロップ付き）:</p>
          {(contentJson.segments as Array<{ time: string; role: string; narration: string; telop?: string }>).map((seg, i) => (
            <div key={i} className="bg-border-light rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1">{seg.time}{seg.role ? ` ・ ${seg.role}` : ""}</p>
              <p className="text-sm text-text">{seg.narration}</p>
              {seg.telop && (
                <p className="mt-1 inline-block rounded bg-text/80 px-2 py-0.5 text-xs font-bold text-white">{seg.telop}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Instagram carousel slides preview */}
      {outputType === "instagram" && contentJson && "slides" in contentJson && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-text">スライド構成:</p>
          {(contentJson.slides as Array<{ slideNumber: number; heading: string; body: string; note: string }>).map((slide) => (
            <div key={slide.slideNumber} className="bg-border-light rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1">スライド {slide.slideNumber}</p>
              <p className="text-sm font-medium text-text">{slide.heading}</p>
              <p className="text-sm text-text-secondary mt-1">{slide.body}</p>
              {slide.note && (
                <p className="text-xs text-text-muted mt-1 italic">💡 {slide.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
