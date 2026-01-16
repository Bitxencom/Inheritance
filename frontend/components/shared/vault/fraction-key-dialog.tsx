"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FractionKeyDialogProps {
  share: string;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopied?: () => void;
  vaultId?: string;
}

/**
 * Dialog popup for viewing a single share key
 * - Fixed header with title
 * - Scrollable content area for long share keys  
 * - Fixed footer with copy button and security warning
 */
export function FractionKeyDialog({
  share,
  index,
  open,
  onOpenChange,
  onCopied,
  vaultId,
}: FractionKeyDialogProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(share);
      setCopyState("copied");
      onCopied?.();
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy share key:", error);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([share], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fraction-key-${index + 1}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download fraction key:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            🔑 Fraction Key #{index + 1}
          </DialogTitle>
          <DialogDescription>
            Please save this key in a secure location. You will need at least 3 keys to open this inheritance.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="font-mono text-sm break-all select-all">
              {share}
            </p>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              onClick={handleCopy}
              disabled={copyState === "copied"}
            >
              {copyState === "copied" ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Key
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleDownload}
              title="Download Key"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Please keep this key confidential and do not share it with unauthorized persons.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
