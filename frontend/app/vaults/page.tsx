"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileKey,
  RefreshCw
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getPendingVaults,
  getArweaveExplorerUrl,
  getSmartChainExplorerUrl,
  checkArweaveStatus,
  updateVaultStatus,
  type PendingVault,
} from "@/lib/vault-storage";
import { SiteHeader } from "@/components/shared/site-header";

// Separate component for Success Banner that uses useSearchParams
function SuccessBanner() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";

  if (!isNew) return null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/50">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
            Success! Your inheritance has been created.
          </h3>
          <p className="text-green-600/90 dark:text-green-400/90">
            Your inheritance has been securely stored on blockchain storage.
          </p>
        </div>
      </div>
    </div>
  );
}

function VaultsPageContent() {
  const [vaults, setVaults] = useState<PendingVault[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Function to check and update status of pending vaults
  const checkPendingVaultStatuses = useCallback(async () => {
    // Only run on client
    if (typeof window === 'undefined') return;

    const currentVaults = getPendingVaults();
    const pendingVaults = currentVaults.filter(
      (v) => v.status === "pending"
    );

    if (pendingVaults.length === 0) return;

    setIsCheckingStatus(true);
    let hasUpdates = false;

    for (const inheritance of pendingVaults) {
      try {
        const result = await checkArweaveStatus(inheritance.arweaveTxId);
        if (result.confirmed) {
          updateVaultStatus(inheritance.vaultId, "confirmed");
          hasUpdates = true;
          console.log(`✅ Inheritance ${inheritance.vaultId} confirmed on blockchain storage`);
        }
      } catch (error) {
        console.error(`Error checking status for inheritance ${inheritance.vaultId}:`, error);
      }
    }

    // Reload vaults if there were updates
    if (hasUpdates) {
      setVaults(getPendingVaults());
    }

    setIsCheckingStatus(false);
  }, []);

  useEffect(() => {
    // Load vaults from local storage
    if (typeof window !== 'undefined') {
      const loadedVaults = getPendingVaults();
      setVaults(loadedVaults);

      // Check pending inheritance statuses immediately
      checkPendingVaultStatuses();

      // Set up interval to check every 30 seconds
      const intervalId = setInterval(checkPendingVaultStatuses, 30000);

      return () => clearInterval(intervalId);
    }
  }, [checkPendingVaultStatuses]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      <SiteHeader showVaultsButton={false} />
      <div className="min-h-screen bg-background p-6 md:p-12">
        <div className="mx-auto max-w-[44rem] space-y-8">

          {/* Header Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="-ml-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Your Inheritances</h1>
            </div>
            <div className="flex items-center gap-4">
              {isCheckingStatus && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Checking status...</span>
                </div>
              )}
            </div>
          </div>

          {/* Success Banner - wrapped in Suspense because it uses useSearchParams */}
          <Suspense fallback={null}>
            <SuccessBanner />
          </Suspense>

          {/* Inheritance List */}
          <div className="space-y-6">
            {vaults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
                <Shield className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-lg font-medium">You don&apos;t have any inheritances yet</p>
                <p className="text-sm">You can create your first inheritance by asking me.</p>
                <Link href="/" className="mt-6">
                  <Button>Create New Inheritance</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {vaults.map((vault) => (
                  <div
                    key={vault.vaultId}
                    className="group relative overflow-hidden rounded-xl border bg-card p-6 transition-all hover:shadow-md"
                  >
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

                      {/* Main Info */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <FileKey className="h-6 w-6 text-muted-foreground" />
                          {vault.storageType && (
                            <div className="shrink-0 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {vault.storageType === 'bitxenArweave' ? 'Bitxen Smart Contract + Arweave' : 'Arweave'}
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Created on {new Date(vault.createdAt).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            }).replace(/am|pm/i, m => m.toUpperCase())}
                          </p>
                        </div>

                        {/* IDs */}
                        <div className="space-y-2">

                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">Inheritance ID</span>
                            <div className="flex items-center gap-2">
                              <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                                {vault.vaultId}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(vault.vaultId, vault.vaultId)}
                              >
                                {copiedId === vault.vaultId ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">Type</span>
                            <div className="flex items-center gap-2">
                              <code className="rounded bg-muted px-2 py-1 font-mono text-sm capitalize">
                                {vault.willType === 'one-time' ? 'One-Time' : 'Editable'}
                              </code>
                            </div>
                          </div>

                          {vault.triggerType && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase">Release</span>
                              <div className="flex items-center gap-2">
                                <code className="rounded bg-muted px-2 py-1 font-mono text-sm capitalize">
                                  {vault.triggerType === 'date' && vault.triggerDate
                                    ? new Date(vault.triggerDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : 'By request'}
                                </code>
                              </div>
                            </div>
                          )}

                          {vault.blockchainTxHash && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase">Registry</span>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={getSmartChainExplorerUrl(vault.blockchainTxHash, vault.blockchainChain)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline hover:text-primary/80 transition-colors"
                                >
                                  Contract Transaction
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                          )}

                          {vault.arweaveTxId && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase">Storage</span>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={getArweaveExplorerUrl(vault.arweaveTxId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline hover:text-primary/80 transition-colors"
                                >
                                  Arweave Transaction
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${vault.status === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                          {vault.status === 'confirmed' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                          <span className="capitalize">
                            {vault.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                          </span>
                        </div>
                        {vault.status === 'confirmed' && vault.confirmedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(vault.confirmedAt).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            }).replace(/am|pm/i, m => m.toUpperCase())}
                          </span>
                        )}

                        <Link href={`/vaults/${vault.vaultId}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function VaultsPage() {
  return (
    <Suspense fallback={null}>
      <VaultsPageContent />
    </Suspense>
  );
}
