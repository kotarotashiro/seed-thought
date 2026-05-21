import { Card } from "@/components/ui/Card";
import { Brain, FileCode, FileText, GraduationCap, Images, MessageCircle } from "lucide-react";
import { clsx } from "clsx";

interface OutputTypeCardProps {
  type: string;
  selected: boolean;
  onClick: () => void;
}

const outputTypes: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  x: { label: "X投稿", description: "280文字以内の投稿", icon: MessageCircle },
  instagram: { label: "Instagramカルーセル", description: "スライド構成で保存されやすく", icon: Images },
  note: { label: "note記事", description: "1000-2000文字の記事", icon: FileText },
  markdown_log: { label: "Markdown学習ログ", description: "構造化された学習記録", icon: FileCode },
  seminar: { label: "セミナーを作る", description: "スライド構成と台本", icon: GraduationCap },
  strict_learning: { label: "厳密学習", description: "正例/反例/本質/15分ワーク", icon: Brain },
};

export function OutputTypeCard({ type, selected, onClick }: OutputTypeCardProps) {
  const config = outputTypes[type];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Card
      hoverable
      selected={selected}
      onClick={onClick}
      padding="sm"
      className="text-center"
    >
      <div
        className={clsx(
          "w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center",
          selected ? "bg-accent text-white" : "bg-border-light text-text-secondary"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-text">{config.label}</p>
      <p className="text-xs text-text-muted mt-1">{config.description}</p>
    </Card>
  );
}
