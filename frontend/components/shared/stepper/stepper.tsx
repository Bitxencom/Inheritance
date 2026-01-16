"use client";

import { cn } from "@/lib/utils";

export interface StepItem {
  key: string;
  label: string;
  description?: string;
}

export interface StepperProps {
  /** Array of step items with key, label, and optional description */
  steps: readonly StepItem[];
  /** Current active step index (0-based) */
  currentStep: number;
  /** Optional additional className for the container */
  className?: string;
}

/**
 * Step Header Component
 * 
 * Shows current step with number, title, and description.
 * Simple, clean, and fully responsive.
 */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  const currentStepData = steps[currentStep];

  if (!currentStepData) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        {/* Step Counter */}
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Step Title */}
        <h4 className="text-base font-semibold text-foreground">
          {currentStepData.label}
        </h4>

        {/* Step Description */}
        {currentStepData.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {currentStepData.description}
          </p>
        )}
      </div>
    </div>
  );
}
