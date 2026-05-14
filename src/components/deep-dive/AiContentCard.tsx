import { Card } from "@/components/ui/Card";
import { Lightbulb } from "lucide-react";

interface AiContentCardProps {
  content: {
    explanation: string;
    keyPoints?: string[];
    examples?: string[];
    promptForUser?: string;
  };
}

export function AiContentCard({ content }: AiContentCardProps) {
  return (
    <Card className="bg-accent-subtle border-accent/10">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 space-y-3">
          <p className="text-sm text-text leading-relaxed">
            {content.explanation}
          </p>

          {content.keyPoints && content.keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-accent mb-1.5">ポイント</p>
              <ul className="space-y-1">
                {content.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-accent mt-1">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.examples && content.examples.length > 0 && (
            <div>
              <p className="text-xs font-medium text-accent mb-1.5">具体例</p>
              <div className="space-y-1">
                {content.examples.map((example, i) => (
                  <p key={i} className="text-sm text-text-secondary bg-white/50 rounded-lg px-3 py-2">
                    {example}
                  </p>
                ))}
              </div>
            </div>
          )}

          {content.promptForUser && (
            <div className="bg-white rounded-lg px-3 py-2 border border-accent/10">
              <p className="text-xs text-accent font-medium">💭 考えてみましょう</p>
              <p className="text-sm text-text mt-1">{content.promptForUser}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
