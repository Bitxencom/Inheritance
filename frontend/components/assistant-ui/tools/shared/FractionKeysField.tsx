"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { Check, Pencil, Upload } from "lucide-react";

export interface FractionKeysValue {
  key1: string;
  key2: string;
  key3: string;
}

export interface FractionKeysFieldProps {
  /** Current key values */
  keys: FractionKeysValue;
  /** Change handler */
  onKeyChange: (keyName: keyof FractionKeysValue, value: string) => void;
  /** Whether keys have been verified */
  isVerified?: boolean;
  /** Loading/verifying state */
  isLoading?: boolean;
  /** Error messages per key */
  errors?: Record<string, string>;
  /** Disable inputs */
  disabled?: boolean;
  /** Optional: Handler for Enter key press */
  onEnterPress?: () => void;
}

/**
 * Reusable Fraction Keys input fields with verified state support.
 * Shows green border + checkmark icons when verified, and becomes readonly.
 */
export function FractionKeysField({
  keys,
  onKeyChange,
  isVerified = false,
  isLoading = false,
  errors = {},
  disabled = false,
  onEnterPress,
}: FractionKeysFieldProps) {
  const keyNames: (keyof FractionKeysValue)[] = ["key1", "key2", "key3"];

  const handleFileUpload = (
    keyName: keyof FractionKeysValue,
    file: File | undefined
  ) => {
    if (!file) return;

    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (typeof content === "string") {
        onKeyChange(keyName, content.trim());
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
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
            {isVerified ? "✓ Fraction Keys Verified" : "Confirm Fraction Keys"}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isVerified
            ? "Your fraction keys have been verified. Click Previous to change your keys."
            : "Enter the 3 fraction keys you have or upload them as text files"}
        </p>
      </div>

      <div className="space-y-4">
        {keyNames.map((keyName, index) => {
          const errorKey = `fractionKeys.${keyName}`;
          const hasError = !!errors[errorKey];

          return (
            <div key={keyName} className="space-y-2 mb-4">
              <label className="text-sm font-medium">
                Fraction Key #{index + 1}
              </label>
              <div className="relative">
                <Input
                  value={keys[keyName]}
                  onChange={(e) => onKeyChange(keyName, e.target.value)}
                  placeholder={`Enter Fraction Key #${index + 1}`}
                  className={cn(
                    "font-mono text-sm pr-10",
                    hasError
                      ? "border-destructive"
                      : isVerified
                        ? "border-green-500 bg-green-50/50 dark:bg-green-950/30 select-none pointer-events-none focus:ring-0 focus:border-green-500"
                        : ""
                  )}
                  type="text"
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

                {!isVerified && !isLoading && !disabled && (
                  <>
                    <input
                      type="file"
                      id={`file-upload-${keyName}`}
                      className="hidden"
                      accept=".txt"
                      onChange={(e) => {
                        handleFileUpload(keyName, e.target.files?.[0]);
                        // Reset input value so same file can be selected again if needed
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`file-upload-${keyName}`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Upload Key File (.txt)"
                    >
                      <Upload className="h-4 w-4" />
                    </label>
                  </>
                )}

                {isVerified && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                )}
              </div>
              <FieldError message={errors[errorKey]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
