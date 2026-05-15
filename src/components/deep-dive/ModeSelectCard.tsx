import { Card } from "@/components/ui/Card";
import { Brain, BookOpen, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface ModeSelectCardProps {
  mode: "thought_lens" | "learning_lesson";
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
}

export function ModeSelectCard({ mode, selected, onClick, recommended }: ModeSelectCardProps) {
  const isThought = mode === "thought_lens";

  return (
    <Card
      hoverable
      selected={selected}
      onClick={onClick}
      className={clsx("relative", recommended && "ring-2 ring-accent/30")}
      padding="lg"
    >
      {recommended && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            AIのおすすめ
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={clsx(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            isThought ? "bg-purple-50" : "bg-blue-50"
          )}
        >
          {isThought ? (
            <Brain className="w-6 h-6 text-purple-600" />
          ) : (
            <BookOpen className="w-6 h-6 text-blue-600" />
          )}
        </div>
        <div>
          <h3 className="text-base font-bold text-text mb-1">
            {isThought ? "考える：思考レンズ" : "学ぶ：厳密学習"}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isThought
              ? "本質・構造・価値観・反論を考える。抽象的な投稿、視点系の投稿におすすめ。"
              : "AIが先生役になり、投稿を教材として基礎・仕組み・具体例・実務での使い方を教えます。"}
          </p>
        </div>
      </div>
    </Card>
  );
}
