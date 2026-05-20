import { clsx } from "clsx";
import { Bookmark, Heart, PenLine } from "lucide-react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "thought" | "learning" | "output" | "success" | "warning" | "like" | "bookmark" | "manual";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-border-light text-text-secondary",
  thought: "bg-purple-50 text-purple-700",
  learning: "bg-blue-50 text-blue-700",
  output: "bg-amber-50 text-amber-700",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  like: "bg-rose-50 text-rose-700",
  bookmark: "bg-sky-50 text-sky-700",
  manual: "bg-slate-100 text-slate-700",
};

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        variantStyles[variant],
        {
          "text-xs px-2 py-0.5": size === "sm",
          "text-sm px-3 py-1": size === "md",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export function PostTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "thought":
      return <Badge variant="thought">思考系</Badge>;
    case "learning":
      return <Badge variant="learning">学習系</Badge>;
    case "output_material":
      return <Badge variant="output">発信素材系</Badge>;
    default:
      return <Badge>未分類</Badge>;
  }
}

export function SavedTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "like":
      return (
        <Badge variant="like" className="gap-1">
          <Heart className="h-3 w-3 fill-current" />
          いいね
        </Badge>
      );
    case "bookmark":
      return (
        <Badge variant="bookmark" className="gap-1">
          <Bookmark className="h-3 w-3 fill-current" />
          ブックマーク
        </Badge>
      );
    case "manual":
      return (
        <Badge variant="manual" className="gap-1">
          <PenLine className="h-3 w-3" />
          手動
        </Badge>
      );
    default:
      return <Badge>{type}</Badge>;
  }
}

export function LearningStatusBadge({
  learningCard,
}: {
  learningCard?: { id: string; status: string } | null;
}) {
  if (!learningCard) {
    return <Badge variant="warning">未学習</Badge>;
  }

  if (learningCard.status === "saved") {
    return <Badge variant="success">マニュアル化済み</Badge>;
  }

  return <Badge variant="learning">学習済み</Badge>;
}
