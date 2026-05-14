import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "thought" | "learning" | "output" | "success" | "warning";
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
      return <Badge variant="default">❤️ いいね</Badge>;
    case "bookmark":
      return <Badge variant="default">🔖 ブックマーク</Badge>;
    case "manual":
      return <Badge variant="default">✍️ 手動</Badge>;
    default:
      return <Badge>{type}</Badge>;
  }
}
