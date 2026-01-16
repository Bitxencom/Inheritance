"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { Check, RotateCcw } from "lucide-react";

export interface InheritanceIdFieldProps {
  /** Current input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Whether the ID has been verified */
  isVerified?: boolean;
  /** Loading/verifying state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Disable input */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Handler to reset/clear the value */
  onReset?: () => void;

  description?: string;
}

/**
 * Reusable Inheritance ID input field with verified state support.
 * Shows green border + checkmark icon when verified, and becomes readonly.
 */
export function InheritanceIdField({
  value,
  onChange,
  isVerified = false,
  isLoading = false,
  error,
  disabled = false,
  placeholder = "e.g. 123e4567-e89b-12d3-a456-426614174000",
  onReset,
  description,
}: InheritanceIdFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium">Inheritance ID</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            error ? "border-destructive" : "",
            isVerified
              ? "border-green-500 pr-10 bg-green-50/50 dark:bg-green-950/30 select-none pointer-events-none focus:ring-0 focus:border-green-500"
              : ""
          )}
          disabled={isLoading || disabled}
          readOnly={isVerified}
          tabIndex={isVerified ? -1 : undefined}
        />
        {isVerified && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Check className="h-5 w-5 text-green-500" />
            {onReset && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                title="Reset ID"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      <FieldError message={error} />
      <p
        className="text-xs text-green-600 dark:text-green-400"
      >
        {isVerified && "Inheritance ID verified. Click Reset to use a different ID."}
      </p>
      {
        !error && !isVerified && description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )
      }
    </div>
  );
}
