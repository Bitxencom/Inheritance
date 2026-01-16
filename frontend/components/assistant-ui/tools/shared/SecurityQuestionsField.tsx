"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { Check, Pencil } from "lucide-react";

export interface SecurityQuestionAnswer {
  question: string;
  answer: string;
}

export interface SecurityQuestionsFieldProps {
  /** Questions and answers array */
  questions: SecurityQuestionAnswer[];
  /** Answer change handler */
  onAnswerChange: (index: number, answer: string) => void;
  /** Whether answers have been verified */
  isVerified?: boolean;
  /** Loading/verifying state */
  isLoading?: boolean;
  /** Error messages per question index */
  errors?: Record<number, string>;
  /** Indexes of valid (correct) answers - shows green border */
  validIndexes?: number[];
  /** Disable inputs */
  disabled?: boolean;
  /** Optional: Handler for Enter key press */
  onEnterPress?: () => void;
}

/**
 * Reusable Security Questions input fields with verified state support.
 * Shows green border + checkmark icons when verified, and becomes readonly.
 */
export function SecurityQuestionsField({
  questions,
  onAnswerChange,
  isVerified = false,
  isLoading = false,
  errors = {},
  validIndexes = [],
  disabled = false,
  onEnterPress,
}: SecurityQuestionsFieldProps) {
  return (
    <div>
      <div
        className={cn(
          "rounded-lg border px-4 py-3 text-sm",
          isVerified
            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
            : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
        )}
      >
        <div className="flex items-center justify-between">
          <p
            className={cn(
              "font-medium",
              isVerified
                ? "text-green-700 dark:text-green-300"
                : "text-blue-700 dark:text-blue-300"
            )}
          >
            {isVerified
              ? "✓ Security Questions Verified"
              : "Answer Security Questions"}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isVerified
            ? "Your answers have been verified."
            : "Answer 3 security questions created by the inheritance owner."}
        </p>
      </div>
      <div className="mt-4 space-y-4">
        {questions.map((sq, index) => {
          const hasError = !!errors[index];
          const isValid = validIndexes.includes(index);

          return (
            <div key={index} className="space-y-2 mb-5">
              <p className="text-sm font-medium">
                Security question {index + 1}: {sq.question}
              </p>
              <div className="relative">
                <Input
                  value={sq.answer}
                  onChange={(e) => onAnswerChange(index, e.target.value)}
                  placeholder="Enter answer"
                  type="text"
                  className={cn(
                    // Error state - red border
                    hasError ? "border-destructive" : "",
                    // Valid state (correct answer) - green border
                    isValid && !hasError ? "border-green-500 pr-10 bg-green-50/50 dark:bg-green-950/30" : "",
                    // Fully verified state - readonly green
                    isVerified
                      ? "border-green-500 pr-10 bg-green-50/50 dark:bg-green-950/30 select-none pointer-events-none focus:ring-0 focus:border-green-500"
                      : ""
                  )}
                  disabled={isLoading || disabled}
                  readOnly={isVerified}
                  tabIndex={isVerified ? -1 : undefined}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !isLoading &&
                      !disabled &&
                      !isVerified &&
                      onEnterPress
                    ) {
                      onEnterPress();
                    }
                  }}
                />
                {/* Show checkmark for verified or valid (correct) answers */}
                {(isVerified || (isValid && !hasError)) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                )}
                <FieldError message={errors[index]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
