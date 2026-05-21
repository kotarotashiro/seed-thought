import { ExternalLink } from "lucide-react";
import { clsx } from "clsx";

interface OpenInXButtonProps {
  href: string;
  label?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Gray "Xで開く" pill used across post cards.
 * Style standardized — keep the same look everywhere we link to X.
 */
export function OpenInXButton({ href, label = "Xで開く", className, onClick }: OpenInXButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 flex-shrink-0 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-accent hover:border-accent/40",
        className
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
