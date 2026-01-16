"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ReviewSectionProps {
  /** Section title displayed as uppercase label */
  title: string;
  /** Content of the section */
  children: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

export interface ReviewItemProps {
  /** Label for the item */
  label: string;
  /** Value to display (can be string or ReactNode for complex content) */
  value: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * ReviewSection - A container for grouping review items with a title
 *
 * @example
 * <ReviewSection title="Inheritance Details">
 *   <ReviewItem label="Type" value="Editable" />
 *   <ReviewItem label="Title" value="My Digital Will" />
 * </ReviewSection>
 */
export function ReviewSection({
  title,
  children,
  className,
}: ReviewSectionProps) {
  return (
    <div className={cn("rounded-xl border p-4", className)}>
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

/**
 * ReviewItem - A label-value pair for displaying information in a review
 *
 * @example
 * <ReviewItem label="Type" value="Editable" className="capitalize" />
 *
 * @example
 * // With complex value
 * <ReviewItem
 *   label="Security Question 1"
 *   value={
 *     <div className="flex flex-col gap-1">
 *       <div><span className="font-semibold">Question:</span> Where did we travel?</div>
 *       <div><span className="font-semibold">Answer:</span> Paris</div>
 *     </div>
 *   }
 * />
 */
export function ReviewItem({ label, value, className }: ReviewItemProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
