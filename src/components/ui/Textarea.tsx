import { clsx } from "clsx";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-text">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            "w-full rounded-xl border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
            "resize-y min-h-[100px]",
            error ? "border-danger" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
