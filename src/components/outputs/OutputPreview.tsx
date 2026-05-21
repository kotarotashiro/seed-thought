"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface OutputPreviewProps {
  title: string;
  content: string;
  contentJson?: Record<string, unknown> | null;
  outputType: string;
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

export function OutputPreview({ title, content, contentJson, outputType }: OutputPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text">{title}</h3>
          <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <><Check className="w-3.5 h-3.5" />コピーしました</> : <><Copy className="w-3.5 h-3.5" />全文コピー</>}
          </Button>
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
                {s.demonstration.badExample && <div className="rounded-lg bg-red-50 px-3 py-2"><p className="text-xs text-red-600 font-medium mb-1">❌ 悪い例</p><p className="text-text-secondary whitespace-pre-wrap">{s.demonstration.badExample}</p></div>}
                {s.demonstration.goodExample && <div className="rounded-lg bg-green-50 px-3 py-2"><p className="text-xs text-success font-medium mb-1">✅ 良い例</p><p className="text-text-secondary whitespace-pre-wrap">{s.demonstration.goodExample}</p></div>}
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? (
            <><Check className="w-3.5 h-3.5" />コピーしました</>
          ) : (
            <><Copy className="w-3.5 h-3.5" />コピーする</>
          )}
        </Button>
      </div>

      <div className="bg-border-light rounded-xl p-4">
        <pre className="text-sm text-text whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>

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
