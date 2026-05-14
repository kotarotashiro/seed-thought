"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface OutputPreviewProps {
  title: string;
  content: string;
  contentJson?: Record<string, unknown> | null;
  outputType: string;
}

export function OutputPreview({ title, content, contentJson, outputType }: OutputPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-text">{title}</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              コピーしました
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              コピーする
            </>
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
