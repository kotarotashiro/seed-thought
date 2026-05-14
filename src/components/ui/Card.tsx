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
          "bg-bg-card rounded-2xl border transition-all duration-200",
          selected
            ? "border-accent shadow-md ring-1 ring-accent/20"
            : "border-border",
          hoverable && !selected && "hover:border-accent/30 hover:shadow-sm cursor-pointer",
          {
            "p-4": padding === "sm",
            "p-6": padding === "md",
            "p-8": padding === "lg",
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
