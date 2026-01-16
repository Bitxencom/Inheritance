"use client";

import { useState } from "react";
import { Eye, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FractionKeyDialog } from "./fraction-key-dialog";
import { InfoBox } from "./info-box";


interface FractionKeyListProps {
  fractionKeys: string[];
  title?: string;
  description?: string;
  /** Show description about minimum keys needed */
  showMinKeysWarning?: boolean;
  /** Encrypted Inheritance ID for sharing context */
  vaultId?: string;
}

/**
 * Reusable list component for displaying multiple fraction keys
 * - List of key items with masked content (•••...)
 * - Eye button to open dialog popup
 * - Copy button to copy key directly
 */
export function FractionKeyList({
  fractionKeys,
  title = "Fraction Keys",
  description,
  showMinKeysWarning = true,
  vaultId,
}: FractionKeyListProps) {
  const [selectedKey, setSelectedKey] = useState<{ index: number; key: string } | null>(null);
  const [copiedIndexes, setCopiedIndexes] = useState<number[]>([]);

  const openKeyDialog = (key: string, index: number) => {
    setSelectedKey({ index, key });
  };

  const handleCopy = async (key: string, index: number) => {
    if (copiedIndexes.includes(index)) return;
    try {
      await navigator.clipboard?.writeText(key);
      setCopiedIndexes((prev) => [...prev, index]);
    } catch (error) {
      console.error("Failed to copy fraction key:", error);
    }
  };

  const handleDownload = (key: string, index: number) => {
    try {
      // Create blob with the key content
      const blob = new Blob([key], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      // Create temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `fraction-key-${index + 1}.txt`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download fraction key:", error);
    }
  };

  const handleDialogCopied = () => {
    if (selectedKey && !copiedIndexes.includes(selectedKey.index)) {
      setCopiedIndexes((prev) => [...prev, selectedKey.index]);
    }
  };

  if (!fractionKeys || fractionKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        There are no fraction keys stored here.
      </div>
    );
  }

  // Numbered badge component
  const NumberBadge = ({ num }: { num: number }) => (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
      {num}
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      {(title || description || showMinKeysWarning) && (
        <div className="space-y-1">
          {title && (
            <p className="text-xs uppercase text-muted-foreground font-medium">
              {title} ({fractionKeys.length} parts)
            </p>
          )}
          {(description || showMinKeysWarning) && (
            <p className="text-xs text-muted-foreground">
              {description || "Please store each fraction key in a separate, secure location. You will need at least 3 keys to access the inheritance."}
            </p>
          )}
        </div>
      )}

      {/* Fraction Key List */}
      <div className="space-y-2">
        {fractionKeys.map((key, index) => (
          <InfoBox
            key={`key-${index}`}
            label={`Fraction Key #${index + 1}`}
            value={key}
            maskedValue
            prefix={<NumberBadge num={index + 1} />}
            className="rounded-md border border-border/70 px-3 py-2"
            copyable
            labelAction={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openKeyDialog(key, index)}
                title="View Fraction Key"
              >
                <Eye className="h-3 w-3" />
              </Button>
            }
            actions={
              <>
                {/* Download button */}
                <Button
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleDownload(key, index)}
                  title="Download Fraction Key"
                >
                  <Download className="h-3 w-3" />
                </Button>

              </>
            }
          />
        ))}
      </div>

      {/* Fraction Key Dialog */}
      {selectedKey && (
        <FractionKeyDialog
          share={selectedKey.key}
          index={selectedKey.index}
          open={selectedKey !== null}
          onOpenChange={(open) => !open && setSelectedKey(null)}
          onCopied={handleDialogCopied}
          vaultId={vaultId}
        />
      )}
    </div>
  );
}
