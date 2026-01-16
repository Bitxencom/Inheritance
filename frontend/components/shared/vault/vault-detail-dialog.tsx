"use client";

import { useState } from "react";
import {
  ExternalLink,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  FileKey,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  getArweaveExplorerUrl,
  removeVaultKeys,
  type PendingVault,
} from "@/lib/vault-storage";
import { FractionKeyDialog } from "./fraction-key-dialog";
import { InfoBox } from "./info-box";

import { DownloadBackupButton } from "./download-backup-button";

interface VaultDetailDialogProps {
  vault: PendingVault;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVaultUpdate?: (vault: PendingVault) => void;
}

/**
 * Dialog popup for viewing full inheritance details
 * - Shows inheritance info (title, date, status)
 * - Inheritance ID andblockchain storage TX ID with copy buttons
 * - Fraction Keys list with view popup
 * - Inheritance type info and important warning
 */
export function VaultDetailDialog({
  vault,
  open,
  onOpenChange,
  onVaultUpdate,
}: VaultDetailDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewKeyIndex, setViewKeyIndex] = useState<number | null>(null);
  const [isKeyDeleteDialogOpen, setIsKeyDeleteDialogOpen] = useState(false);
  const [localVault, setLocalVault] = useState(vault);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDeleteKeys = () => {
    try {
      removeVaultKeys(localVault.vaultId);
      const updatedVault = { ...localVault, fractionKeys: [] };
      setLocalVault(updatedVault);
      onVaultUpdate?.(updatedVault);
      setIsKeyDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete fraction keys:", error);
    }
  };

  const handleDownload = (key: string, index: number) => {
    try {
      const blob = new Blob([key], { type: "text/plain" });
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileKey className="h-5 w-5" />
              Inheritance Details
            </DialogTitle>
            <DialogDescription>
              View your full inheritance information securely.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-4 py-2">

            {/* Inheritance Info Card */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{localVault.title || "Digital Inheritance"}</h3>
                  <p className="text-xs text-muted-foreground">
                    Created on {new Date(localVault.createdAt).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: true
                    }).replace(/am|pm/i, m => m.toUpperCase())}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${localVault.status === 'confirmed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                    {localVault.status === 'confirmed' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    <span>{localVault.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
                  </div>
                  {localVault.status === 'confirmed' && localVault.confirmedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(localVault.confirmedAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      }).replace(/am|pm/i, m => m.toUpperCase())}
                    </span>
                  )}
                </div>
              </div>

              {/* Inheritance Type */}
              {/* Inheritance Type & Trigger Release */}
              <div className="flex flex-wrap items-center gap-4 text-xs mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${localVault.willType === 'one-time'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                    {localVault.willType === 'one-time' ? 'One-Time' : 'Editable'}
                  </span>
                </div>

                {localVault.triggerType && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Release:</span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {localVault.triggerType === "date"
                        ? `Date: ${new Date(localVault.triggerDate || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : "By request"}
                    </span>
                  </div>
                )}
              </div>

              {/* Inheritance ID */}
              <div className="space-y-2">
                <InfoBox
                  label="Inheritance ID"
                  value={localVault.vaultId}
                  copyable
                  className="rounded border bg-white p-3"
                />

                {/* Blockchain TX */}
                {localVault.arweaveTxId && (
                  <InfoBox
                    label="Blockchain TX ID"
                    value={localVault.arweaveTxId}
                    copyable
                    copyLabel="Copy"
                    externalUrl={getArweaveExplorerUrl(localVault.arweaveTxId)}
                    className="rounded border bg-white p-3"
                  />
                )}
              </div>
            </div>

            {/* Fraction Keys Section */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Fraction Keys</h4>
                {localVault.fractionKeys && localVault.fractionKeys.length > 0 && (
                  <Dialog open={isKeyDeleteDialogOpen} onOpenChange={setIsKeyDeleteDialogOpen}>
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() => setIsKeyDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button> */}
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Remove Fraction Keys</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to remove these fraction keys from your browser storage? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <DialogClose asChild>
                          <Button variant="outline" className="mr-2">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteKeys}>
                          Yes, Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                These keys are required to unlock the inheritance. You need at least 3 keys.
              </p>

              <div className="space-y-2">
                {localVault.fractionKeys && localVault.fractionKeys.length > 0 ? (
                  localVault.fractionKeys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between rounded border bg-background p-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                        <span className="w-10">Key #{index + 1}</span>
                        <code className=" font-mono">
                          {"•".repeat(25)}
                        </code>
                      </div>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewKeyIndex(index)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 px-2 text-xs"
                          onClick={() => handleCopy(key, `key-${index}`)}
                        >
                          {copiedId === `key-${index}` ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownload(key, index)}
                          title="Download Key"
                        >
                          <Download className="h-3 w-3" />
                        </Button>

                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No fraction keys found in local storage.
                  </div>
                )}
              </div>
            </div>

            {/* Important Warning */}
            <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-950/20 dark:border-red-900/50">
              <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Important Security Notice</h4>
              <p className="text-xs text-red-600/90 dark:text-red-400/90">
                Your data is stored locally in this browser. Please ensure you back up your <strong>Inheritance ID</strong> and <strong>Fraction Keys</strong> safely.
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 pt-2 flex-col sm:flex-row gap-2">
            <DownloadBackupButton
              vaultId={localVault.vaultId}
              fractionKeys={localVault.fractionKeys || []}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto mr-auto"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/vaults/${localVault.vaultId}`, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Full Page
            </Button>
            <DialogClose asChild>
              <Button size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fraction Key View Modal */}
      {viewKeyIndex !== null && localVault?.fractionKeys?.[viewKeyIndex] && (
        <FractionKeyDialog
          share={localVault.fractionKeys[viewKeyIndex]}
          index={viewKeyIndex}
          open={viewKeyIndex !== null}
          onOpenChange={(open) => !open && setViewKeyIndex(null)}
          vaultId={localVault.vaultId}
        />
      )}
    </>
  );
}
