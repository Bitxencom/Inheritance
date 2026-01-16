"use client";

import { useState, ReactNode } from "react";
import { Copy, Check, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfoBoxProps {
  /** Label displayed on top-left (e.g., "VAULT ID", "BLOCKCHAIN TRANSACTION ID") */
  label: string;
  /** Custom label action to render on the right side */
  labelAction?: ReactNode;
  /** The value to copy (actual data) */
  value: string;
  /** Custom display value (if different from actual value, e.g. masked) */
  displayValue?: string;
  /** Mask the value with dots (shows "•••••" instead of actual value) */
  maskedValue?: boolean;
  /** Prefix element (e.g., numbered badge) rendered before the label */
  prefix?: ReactNode;
  /** Use monospace font for the value (default: true) */
  monospace?: boolean;
  /** Show copy button (default: false) */
  copyable?: boolean;
  /** Custom copy button label (default: "Copy") */
  copyLabel?: string;
  /** External link URL (shows link icon button) */
  externalUrl?: string;
  /** Warning message to show below the value */
  warning?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Custom actions to render on the right side */
  actions?: ReactNode;
}

/**
 * Reusable InfoBox component for displaying labeled information.
 * 
 * Can be used for:
 * - Inheritance ID (with copy)
 * - Transaction ID (with copy + external link)
 * - Inheritance Type (no actions, just display)
 * - Fraction Keys (with prefix badge, masked value, custom actions)
 * - Any other labeled info
 * 
 * Features:
 * - Uppercase label with muted color
 * - Optional prefix element (e.g., numbered badge)
 * - Optional copy button with "copied" state feedback
 * - Optional external link button
 * - Optional warning message
 * - Optional masked value display
 * - Monospace or normal font for value
 * - Consistent border and background styling
 */
export function InfoBox({
  label,
  labelAction,
  value,
  displayValue,
  maskedValue = false,
  prefix,
  monospace = true,
  copyable = false,
  copyLabel = "Copy",
  externalUrl,
  warning,
  className = "",
  actions,
}: InfoBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Determine what to display
  const getDisplayValue = () => {
    if (displayValue) return displayValue;
    if (maskedValue) return "•".repeat(Math.min(value.length, 50));
    return value;
  };

  return (
    <div className={`rounded-lg border bg-muted/10 px-3 pt-0 pb-3 ${className}`}>
      {/* Header: Prefix + Label + Actions - always same height */}
      <div className="flex items-center justify-between min-h-10">
        <div className="flex items-center gap-2">
          {prefix}
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{label}</span>
            <span>{labelAction}</span>
          </div>
        </div>
        {/* {hasActions && ( */}
        <div className="flex items-center">
          {copyable && (
            <Button
              variant="ghost"
              className={`h-8 px-2 text-xs hover:text-primary`}
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  {copyLabel}
                </>
              )}
            </Button>
          )}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" className="h-8 w-8">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
          {actions}
        </div>
        {/* )} */}
      </div>

      {/* Value */}
      <div className={`${monospace ? "font-mono" : ""} text-sm break-all leading-relaxed ${maskedValue ? "text-muted-foreground" : ""}`}>
        {getDisplayValue()}
      </div>

      {/* Warning */}
      {warning && (
        <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {warning}
        </div>
      )}
    </div>
  );
}
