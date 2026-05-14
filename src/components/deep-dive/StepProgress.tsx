import { clsx } from "clsx";

interface StepProgressProps {
  totalSteps: number;
  currentStep: number;
  steps: { title: string; completed: boolean }[];
}

export function StepProgress({ totalSteps, currentStep, steps }: StepProgressProps) {
  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              "h-1.5 rounded-full flex-1 transition-all duration-300",
              i < currentStep
                ? "bg-accent"
                : i === currentStep
                ? "bg-accent/50"
                : "bg-border"
            )}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          ステップ {currentStep + 1} / {totalSteps}
        </p>
        <p className="text-sm font-medium text-text">
          {steps[currentStep]?.title || ""}
        </p>
      </div>
    </div>
  );
}
