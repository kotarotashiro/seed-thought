import { clsx } from "clsx";
import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  selected?: boolean;
  padding?: "sm" | "md" | "lg";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable, selected, padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "bg-bg-card rounded-xl border transition-colors duration-150",
          selected
            ? "border-accent ring-1 ring-accent/15"
            : "border-border",
          hoverable && !selected && "hover:border-text-muted/40 cursor-pointer",
          {
            "p-4 sm:p-5": padding === "sm",
            "p-5 sm:p-6": padding === "md",
            "p-6 sm:p-8": padding === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
