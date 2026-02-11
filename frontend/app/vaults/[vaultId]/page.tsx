"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  Eye,
  FileKey,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVaultById,
  removeVault,
  removeVaultKeys,
  getArweaveExplorerUrl,
  checkArweaveStatus,
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
import { FractionKeyDialog, InfoBox, DownloadBackupButton } from "@/components/shared/vault";
import { SiteHeader } from "@/components/shared/site-header";

export default function VaultDetailsPage({ params }: { params: Promise<{ vaultId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { vaultId } = resolvedParams;

  const [vault, setVault] = useState<PendingVault | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<number[]>([]);
  const [isKeyDeleteDialogOpen, setIsKeyDeleteDialogOpen] = useState(false);
  const [viewKeyIndex, setViewKeyIndex] = useState<number | null>(null);

  // Status tracking
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (vaultId) {
      const data = getVaultById(vaultId);
      if (data) {
        setVault(data);
        // Check status if tx exists
        if (data.arweaveTxId) {
          checkStatus(data.arweaveTxId);
        }
      } else {
        setVault(null);
      }
      setLoading(false);
    }
  }, [vaultId]);

  const checkStatus = async (txId: string) => {
    setIsCheckingStatus(true);
    try {
      const result = await checkArweaveStatus(txId);
      if (vault) {
        setVault({ ...vault, status: result.confirmed ? 'confirmed' : 'pending' });
      }
    } catch (err) {
      console.error("Failed to check status:", err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleKeyVisibility = (index: number) => {
    setVisibleKeys((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleDownload = (key: string, index: number) => {
    const element = document.createElement("a");
    const file = new Blob([key], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `vault-${vaultId}-key-${index + 1}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDelete = () => {
    if (vaultId) {
      const success = removeVault(vaultId);
      if (success) {
        router.push("/vaults");
      }
    }
  };

  const handleDeleteKeys = () => {
    if (vault) {
      try {
        removeVaultKeys(vaultId);
        setVault({ ...vault, fractionKeys: [] });
        setIsKeyDeleteDialogOpen(false);
      } catch (error) {
        console.error("Failed to delete keys:", error);
      }
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader showVaultsButton={false} />
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!vault) {
    return (
      <>
        <SiteHeader showVaultsButton={false} />
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h1 className="text-xl font-semibold">Inheritance Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            We could not find an inheritance with this ID in your browser local storage.
          </p>
          <Link href="/vaults" className="mt-6">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Vaults
            </Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader showVaultsButton={false} />
      <div className="min-h-screen bg-background p-6 md:p-12">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Header Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/vaults">
                <Button variant="ghost" size="icon" className="-ml-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Inheritance Details</h1>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove from history?</DialogTitle>
                  <DialogDescription>
                    This action will remove the inheritance data from your browser. Data onblockchain storage will remain safe.
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
          </div>

          <div className="grid gap-8 md:grid-cols-3">

            {/* Main Content */}
            <div className="space-y-6 md:col-span-2">

              {/* Inheritance Info Card */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{vault.title || "Digital Inheritance"}</h2>
                    <p className="text-sm text-muted-foreground">
                      Created on {new Date(vault.createdAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      }).replace(/am|pm/i, m => m.toUpperCase())}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${vault.status === 'confirmed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {vault.status === 'confirmed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                      <span className="capitalize">{vault.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
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

                <div className="space-y-4">
                  {/* Inheritance ID */}
                  <InfoBox
                    label="Inheritance ID"
                    value={vault.vaultId}
                    copyable
                  />



                  {/* Storage Transaction ID */}
                  {vault.arweaveTxId && (
                    <InfoBox
                      label="Storage Transaction ID"
                      value={vault.arweaveTxId}
                      copyable
                      copyLabel="Copy"
                      externalUrl={getArweaveExplorerUrl(vault.arweaveTxId)}
                    />
                  )}
                </div>
              </div>

              {/* Fraction Keys */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Fraction Keys</h3>
                  {vault.fractionKeys && vault.fractionKeys.length > 0 && (
                    <Dialog open={isKeyDeleteDialogOpen} onOpenChange={setIsKeyDeleteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive-foreground">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Fraction Keys
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Fraction Keys</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete all fraction keys from browser storage? This action cannot be undone.
                          </DialogDescription>
                          <DialogDescription>
                            <div className="rounded-md border bg-red-50 py-2 px-3 dark:bg-red-950/20 dark:border-red-900/50">
                              {/* <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">Important Security Notice</h3> */}
                              <p className="text-sm text-red-600/90 dark:text-red-400/90">
                                Important: Please ensure you have a backup of your <strong>Inheritance ID</strong> and <strong>Fraction Keys</strong>.
                              </p>
                            </div>
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
                <p className="mb-6 text-sm text-muted-foreground">
                  These keys are required to unlock (decrypt) the inheritance. You need at least 3 keys to unlock.
                  Store these keys in separate, secure locations.
                </p>

                <div className="space-y-3">
                  {vault.fractionKeys && vault.fractionKeys.length > 0 ? (
                    vault.fractionKeys.map((key, index) => (
                      <div key={index} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 h-8">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {index + 1}
                            </span>
                            <span className="text-sm text-muted-foreground">Fraction Key #{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setViewKeyIndex(index)}
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>

                          <div className="flex-1 font-mono text-sm break-all text-muted-foreground">
                            {"•".repeat(Math.min(key.length, 40))}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center self-end sm:self-auto h-8">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleCopy(key, `key-${index}`)}
                          >
                            {copiedId === `key-${index}` ? (
                              <>
                                <Check className="mr-1 h-3 w-3 text-green-500" />
                                Copy
                              </>
                            ) : (
                              <>
                                <Copy className="mr-1 h-3 w-3" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(key, index)}
                            title="Download Key"
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No fraction keys stored.
                    </div>
                  )}
                </div>
              </div>

              {/* Key View Modal */}
              {viewKeyIndex !== null && vault?.fractionKeys?.[viewKeyIndex] && (
                <FractionKeyDialog
                  share={vault.fractionKeys[viewKeyIndex]}
                  index={viewKeyIndex}
                  open={viewKeyIndex !== null}
                  onOpenChange={(open) => !open && setViewKeyIndex(null)}
                  vaultId={vaultId}
                />
              )}

            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">

              <div className="rounded-xl border bg-red-50 p-6 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">Important Security Notice</h3>
                <p className="text-sm text-red-600/90 dark:text-red-400/90">
                  Your data is stored locally in this browser. If you clear your cache or switch devices, this data will be lost.
                </p>
                <p className="mt-2 text-sm text-red-600/90 dark:text-red-400/90">
                  Please ensure you back up your <strong>Inheritance ID</strong> and <strong>Fraction Keys</strong> safely.
                </p>

                <div className="mt-4">
                  <DownloadBackupButton
                    vaultId={vault.vaultId}
                    fractionKeys={vault.fractionKeys || []}
                    variant="outline"
                    size="sm"
                    className="w-full bg-white dark:bg-transparent border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Inheritance Type</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <FileKey className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {vault.willType === 'one-time' ? 'One-Time' : 'Editable'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vault.willType === 'one-time'
                          ? 'Permanent vault, written once.'
                          : 'Inheritance can be updated anytime.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {vault.triggerType && (
                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Trigger Release</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                        <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {vault.triggerType}
                        </p>
                        {vault.triggerType === 'date' && vault.triggerDate && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(vault.triggerDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
