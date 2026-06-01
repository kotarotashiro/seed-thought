import { Card } from "@/components/ui/Card";
import { BookOpenText, GraduationCap, Images, Video, Zap } from "lucide-react";
import { clsx } from "clsx";

interface OutputTypeCardProps {
  type: string;
  selected: boolean;
  onClick: () => void;
}

const outputTypes: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  x: { label: "短く伝える", description: "X投稿・280文字", icon: Zap },
  instagram: { label: "図で伝える", description: "カルーセル形式", icon: Images },
  short_video: { label: "動画で伝える", description: "ショート動画台本・30〜45秒", icon: Video },
  note: { label: "じっくり読ませる", description: "note記事・3000〜6000文字", icon: BookOpenText },
  seminar: { label: "セミナーを作る", description: "スライド構成と台本", icon: GraduationCap },
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
