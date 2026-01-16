"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldErrorProps {
  /** Error message to display. If null/undefined/empty, nothing renders */
  message?: string | null;
  /** Additional className */
  className?: string;
}

/**
 * FieldError - A reusable component for displaying field validation errors
 *
 * @example
 * <FieldError message={fieldErrors.title} />
 *
 * @example
 * <FieldError message={errors?.email} className="mt-2" />
 */
export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p className={cn("absolute text-xs text-destructive -mt-1", className)}>{message}</p>
  );
}
