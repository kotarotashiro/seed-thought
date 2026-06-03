import { clsx } from "clsx";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading = false, loadingLabel, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center whitespace-nowrap font-medium rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]",
          {
            "bg-accent text-white hover:bg-accent-hover":
              variant === "primary",
            "bg-white text-text border border-border hover:bg-border-light":
              variant === "secondary",
            "text-text-secondary hover:text-text hover:bg-border-light":
              variant === "ghost",
            "bg-danger text-white hover:opacity-90": variant === "danger",
          },
          {
            "text-xs px-3 py-1.5": size === "sm",
            "text-sm px-4 py-2": size === "md",
            "text-[15px] px-5 py-2.5": size === "lg",
          },
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {loading ? loadingLabel || children : children}
      </button>
    );
  }
);

Button.displayName = "Button";
