import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileKey,
  Trash2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FractionKeyList, InfoBox } from "@/components/shared/vault";
import {
  getVaultById,
  removeVault,
  getArweaveExplorerUrl,
  checkArweaveStatus,
  updateVaultStatus,
  type PendingVault,
} from "@/lib/vault-storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export const VaultDetailTool: ToolCallMessagePartComponent<{
  reason?: string;
  vaultId?: string;
}> = ({ args }) => {
  const router = useRouter();
  const [vault, setVault] = useState<PendingVault | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [stableVaultId, setStableVaultId] = useState<string>("");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const vaultId =
    args && typeof args === "object" && "vaultId" in args
      ? String(args.vaultId ?? "").trim()
      : "";

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(args.reason ?? "").trim()
      : "";

  // Function to check inheritance status on blockchain storage
  const checkVaultStatus = useCallback(async (currentVault: PendingVault) => {
    if (currentVault.status !== "pending") {
      return;
    }

    setIsCheckingStatus(true);
    try {
      const result = await checkArweaveStatus(currentVault.arweaveTxId, currentVault.vaultId);
      if (result.confirmed) {
        const updated = updateVaultStatus(currentVault.vaultId, "confirmed");
        if (updated) {
          setVault(updated);
          console.log(`✅ Inheritance ${currentVault.vaultId} confirmed on blockchain storage`);
        }
      }
    } catch (error) {
      console.error("Error checking inheritance status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  // Debounce vaultId to wait for args to stabilize (streaming args issue)
  useEffect(() => {
    if (!vaultId) return;

    // Reset loading when vaultId changes
    setLoading(true);

    // Wait 500ms for args to stabilize before fetching
    const timer = setTimeout(() => {
      setStableVaultId(vaultId);
    }, 500);

    return () => clearTimeout(timer);
  }, [vaultId]);

  // Fetch inheritance data when stableVaultId is set
  useEffect(() => {
    if (stableVaultId) {
      const data = getVaultById(stableVaultId);
      setVault(data);
      setLoading(false);
      // Check status if inheritance is pending
      if (data) {
        checkVaultStatus(data);
      }
    }
  }, [stableVaultId, checkVaultStatus]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };


  const handleDelete = () => {
    if (vaultId) {
      const success = removeVault(vaultId);
      if (success) {
        setDeleted(true);
      }
    }
  };

  // Loading state - check FIRST to prevent flash of error message
  if (loading) {
    return (
      <div className="aui-vault-detail-tool mt-3 w-full">
        <div className="rounded-2xl border border-border bg-background p-6 dark:border-muted-foreground/15">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">We&apos;re retrieving the inheritance details...</p>
          </div>
        </div>
      </div>
    );
  }

  // No inheritance ID provided (only check after loading is complete)
  if (!vaultId) {
    return (
      <div className="aui-vault-detail-tool mt-3 w-full">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-950/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-300">
                No Inheritance ID provided
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                {reason || "Please specify which Inheritance ID you'd like to view."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Deleted state
  if (deleted) {
    return (
      <div className="aui-vault-detail-tool mt-3 w-full">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                The inheritance has been removed from your history.
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Rest assured, your data remains safely stored on blockchain storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inheritance not found
  if (!vault) {
    return (
      <div className="aui-vault-detail-tool mt-3 w-full">
        <div className="rounded-2xl border border-border bg-background p-6 dark:border-muted-foreground/15">
          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-medium">We couldn&apos;t find that vault</p>
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t find a inheritance with ID <strong className="rounded bg-muted px-1 text-xs">{vaultId}</strong> in your local storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inheritance found - show details
  return (
    <div className="aui-vault-detail-tool mt-3 w-full space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-background p-4 dark:border-muted-foreground/15">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <FileKey className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{vault.title || "Inheritance"}</h3>
              <p className="text-xs text-muted-foreground">
                Created on {new Date(vault.createdAt).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true
                }).replace(/am|pm/i, m => m.toUpperCase())}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${vault.status === 'confirmed'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
              {vault.status === 'confirmed' ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>{vault.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
            </div>
            {vault.status === 'confirmed' && vault.confirmedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(vault.confirmedAt).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true
                }).replace(/am|pm/i, m => m.toUpperCase())}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Inheritance Info */}
      <div className="rounded-2xl border border-border bg-background p-4 dark:border-muted-foreground/15 space-y-4">
        {/* Inheritance ID */}
        <InfoBox
          label="Inheritance ID"
          value={vault.vaultId}
          copyable
          className="rounded-lg border bg-muted/30 p-3"
        />

        {/* Inheritance Type */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Type:</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vault.willType === 'one-time'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
            {vault.willType === 'one-time' ? 'One-Time' : 'Editable'}
          </span>
        </div>

        {/*blockchain storage TX */}
        {vault.arweaveTxId && (
          <InfoBox
            label="Blockchain Storage TX ID"
            value={vault.arweaveTxId}
            copyable
            copyLabel="Copy"
            externalUrl={getArweaveExplorerUrl(vault.arweaveTxId)}
            className="rounded-lg border bg-muted/30 p-3"
          />
        )}
      </div>

      {/* Fraction Keys */}
      {vault.fractionKeys && vault.fractionKeys.length > 0 && (
        <div className="rounded-2xl border border-border bg-background p-4 dark:border-muted-foreground/15">
          <FractionKeyList
            fractionKeys={vault.fractionKeys}
            description="You'll need at least 3 keys to open this inheritance. Please keep them safe."
            vaultId={vault.vaultId}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">
              <Trash2 className="mr-1 h-3 w-3" />
              Remove from history
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this inheritance from history?</DialogTitle>
              <DialogDescription>
                This will remove the inheritance information from this browser.
                Please ensure you&apos;ve saved your Inheritance ID and Fraction Keys elsewhere.
                The actual inheritance data onblockchain storage will not be deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button variant="outline" className="mr-2">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => window.open(`/vaults/${vault.vaultId}`, '_blank')}
        >
          View Full Details →
        </Button>
      </div>
    </div>
  );
};
