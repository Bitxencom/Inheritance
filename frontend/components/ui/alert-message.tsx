"use client";

import * as React from "react";
import { AlertCircle, Calendar, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertMessageProps {
  /** The message to display. If null/undefined, the component won't render */
  message: string | null | undefined;
  /** Variant determines the color scheme: error (red), warning (amber), info (blue), success (green) */
  variant?: "error" | "warning" | "info" | "success";
  /** Whether to show the header (Error, Notice, Info) */
  showHeader?: boolean;
  /** Whether to show the default icon */
  showIcon?: boolean;
  /** Custom icon to use instead of the default. Can be a React node or emoji string */
  customIcon?: React.ReactNode;
  /** Custom header text to override the default */
  customHeader?: string;
  /** Additional className for the container */
  className?: string;
}

const variantStyles = {
  error: {
    container:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
    icon: "text-red-600 dark:text-red-400",
    defaultHeader: "Error",
    DefaultIcon: AlertCircle,
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    defaultHeader: "Notice",
    DefaultIcon: AlertCircle,
  },
  info: {
    container:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-400",
    defaultHeader: "Info",
    DefaultIcon: Info,
  },
  success: {
    container:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
    icon: "text-green-600 dark:text-green-400",
    defaultHeader: "Success",
    DefaultIcon: CheckCircle,
  },
};

/**
 * AlertMessage - A reusable alert/notification component
 * 
 * @example
 * // Simple error message
 * <AlertMessage message="Something went wrong" variant="error" />
 * 
 * @example
 * // Warning with header and icon
 * <AlertMessage message="Please wait..." variant="warning" showHeader showIcon />
 * 
 * @example
 * // With custom calendar icon for date-related warnings
 * <AlertMessage 
 *   message="Available on January 1, 2025" 
 *   variant="warning" 
 *   showHeader 
 *   customIcon={<Calendar className="h-5 w-5" />} 
 * />
 */
export function AlertMessage({
  message,
  variant = "error",
  showHeader = false,
  showIcon = false,
  customIcon,
  customHeader,
  className,
}: AlertMessageProps) {
  // Don't render if no message
  if (!message) return null;

  const styles = variantStyles[variant];
  const headerText = customHeader || styles.defaultHeader;
  const IconComponent = styles.DefaultIcon;

  // Handle multi-line messages
  const messageLines = message.split("\n");

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        showIcon && "flex items-start gap-3",
        styles.container,
        className
      )}
    >
      {/* Icon */}
      {(showIcon || customIcon) && (
        <div className="shrink-0">
          {customIcon ? (
            typeof customIcon === "string" ? (
              <span className="text-base">{customIcon}</span>
            ) : (
              customIcon
            )
          ) : (
            <IconComponent className={cn("h-5 w-5", styles.icon)} />
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {/* {showHeader && (
          <p className="font-semibold mb-1">{headerText}</p>
        )} */}
        {messageLines.length > 1 ? (
          <div className="whitespace-pre-wrap">
            {messageLines.map((line, idx) => (
              <p key={idx} className={idx > 0 ? "mt-1" : ""}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p>{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Shorthand component for date-related warnings with calendar icon
 */
export function DateWarningMessage({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  return (
    <AlertMessage
      message={message}
      variant="warning"
      showHeader
      showIcon
      customIcon={<Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
      className={className}
    />
  );
}
