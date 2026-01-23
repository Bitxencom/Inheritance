import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { RefreshCw, Clock, Check, Copy, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { FractionKeyList, InfoBox, DownloadBackupButton } from "@/components/shared/vault";

import { VaultCreationWizard } from "./wizard";
import type { SubmissionResult } from "./types";
import {
  savePendingVault,
  checkArweaveStatus,
  getArweaveExplorerUrl,
  type PendingVaultStatus,
} from "@/lib/vault-storage";
import { getChainConfig, type ChainId } from "@/lib/metamaskWallet";

type HealthStatus = {
  backend: {
    available: boolean;
    error?: string;
    environment?: string;
  };
  arweave: {
    available: boolean;
    gateway?: string;
    hasJwk?: boolean;
    walletFunded?: boolean;
    walletBalance?: string | null;
    walletAddress?: string | null;
    error?: string | null;
  };
};

export const VaultCreationWizardTool: ToolCallMessagePartComponent<{
  reason?: string;
  metadata?: Record<string, unknown>;
}> = ({ args }) => {
  const [isOpen, setIsOpen] = useState(false); // Start with false, will be opened after all services are ready
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const router = useRouter();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [copyArweaveTxIdState, setCopyArweaveTxIdState] = useState<"idle" | "copied">("idle");
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [arweaveStatus, setArweaveStatus] = useState<PendingVaultStatus>("pending");
  const [isCheckingArweave, setIsCheckingArweave] = useState(false);

  // Health check saat component mount
  useEffect(() => {
    const checkHealth = async () => {
      setIsCheckingHealth(true);
      try {
        const response = await fetch("/api/health");
        const data = await response.json();

        if (data.success && data.services) {
          setHealthStatus(data.services);

          // Only open form if all services are available AND wallet is funded (if JWK exists)
          const allServicesAvailable =
            data.services.backend?.available &&
            data.services.arweave?.available;

          // If JWK exists, make sure wallet is also funded
          const walletReady = !data.services.arweave?.hasJwk ||
            (data.services.arweave?.hasJwk && data.services.arweave?.walletFunded);

          // Open form directly if all services are available and wallet is funded
          if (allServicesAvailable && walletReady) {
            setIsOpen(true);
          } else {
            // Don't open form if any service is unavailable or wallet is not funded
            setIsOpen(false);
          }
        } else {
          // Don't open form if health check failed
          setHealthStatus({
            backend: {
              available: false,
              error: data.message || "Unknown error",
            },
            arweave: {
              available: false,
              error: "Unable to check blockchain storage",
            },
          });
          setIsOpen(false);
        }
      } catch (error) {
        console.error("Health check failed:", error);
        setHealthStatus({
          backend: {
            available: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          arweave: {
            available: false,
            error: "Unable to check blockchain storage",
          },
        });
        // Don't open form if health check failed
        setIsOpen(false);
      } finally {
        setIsCheckingHealth(false);
      }
    };

    checkHealth();
  }, []);

  const handleWizardResult = useCallback(
    (
      result:
        | { status: "success"; data: SubmissionResult }
        | { status: "error"; message: string },
    ) => {
      if (result.status === "success") {
        setSubmissionResult(result.data);
        setIsOpen(false);

        // Save to localStorage is already handled in wizard.tsx before calling onResult
        // Do NOT call savePendingVault here again as it might overwrite with incomplete data

        // No auto-redirect - user can navigate via button when ready
      }
    },
    [],
  );

  const handleCopyVaultId = async () => {
    if (!submissionResult?.vaultId) return;

    try {
      await navigator.clipboard?.writeText(submissionResult.vaultId);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy Inheritance ID:", error);
    }
  };

  const handleCopyArweaveTxId = async () => {
    if (!submissionResult?.arweaveTxId) return;

    try {
      await navigator.clipboard?.writeText(submissionResult.arweaveTxId);
      setCopyArweaveTxIdState("copied");
      setTimeout(() => setCopyArweaveTxIdState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy Transaction ID:", error);
    }
  };

  const handleDownloadId = () => {
    if (!submissionResult?.vaultId) return;

    const content = `INHERITANCE ID
================================================================
${submissionResult.vaultId}
================================================================

Save this ID safely. You will need it to find and manage your inheritance later.
`;

    try {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inheritance-id-${submissionResult.vaultId.slice(0, 8)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download ID:", error);
    }
  };


  // Manual check - triggered by button click (shows loading state on button)
  const handleCheckArweaveStatus = async () => {
    if (!submissionResult?.arweaveTxId) return;

    setIsCheckingArweave(true);
    try {
      const result = await checkArweaveStatus(submissionResult.arweaveTxId);
      if (result.confirmed) {
        setArweaveStatus("confirmed");
        const confirmedAt = new Date().toISOString();
        setSubmissionResult(prev => prev ? { ...prev, confirmedAt } : prev);
      } else {
        setArweaveStatus("pending");
      }
    } catch (error) {
      console.error("Error checking blockchain storage status:", error);
    } finally {
      setIsCheckingArweave(false);
    }
  };

  // Auto-check Arweave status every 2 seconds when pending (standalone, no UI interaction)
  const isAutoCheckingRef = useRef(false);

  useEffect(() => {
    if (!submissionResult?.arweaveTxId || arweaveStatus === "confirmed") return;

    const autoCheckStatus = async () => {
      if (isAutoCheckingRef.current) return;

      const txId = submissionResult.arweaveTxId;
      if (!txId) return;

      isAutoCheckingRef.current = true;
      try {
        const result = await checkArweaveStatus(txId);
        if (result.confirmed) {
          setArweaveStatus("confirmed");
          const confirmedAt = new Date().toISOString();
          setSubmissionResult(prev => prev ? { ...prev, confirmedAt } : prev);
        }
      } catch (error) {
        console.error("Auto-check error:", error);
      } finally {
        isAutoCheckingRef.current = false;
      }
    };

    // Initial auto-check
    autoCheckStatus();

    // Set up interval for auto-check every 2 seconds
    const intervalId = setInterval(autoCheckStatus, 2000);

    // Cleanup interval on unmount or when status becomes confirmed
    return () => clearInterval(intervalId);
  }, [submissionResult?.arweaveTxId, arweaveStatus]);

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(
        (args as {
          reason?: string | number | boolean;
        }).reason ?? "",
      ).trim()
      : "";

  // Show result if form is completed (has submissionResult)
  if (submissionResult) {
    return (
      <div className="aui-vault-wizard-tool-completed mt-3 space-y-6">

        {/* 1. Status Banner - Top Priority */}
        <div className={`rounded-xl border ${arweaveStatus === "confirmed"
          ? "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/30"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30"
          }`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`relative flex items-center justify-center h-8 w-8 rounded-full ${arweaveStatus === "confirmed"
                ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                }`}>
                {arweaveStatus !== "confirmed" && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                )}
                <Clock className="h-4 w-4 relative" />
              </div>
              <div>
                <p className={`text-sm font-bold ${arweaveStatus === "confirmed"
                  ? "text-green-700 dark:text-green-300"
                  : "text-amber-700 dark:text-amber-300"
                  }`}>
                  {arweaveStatus === "confirmed"
                    ? "Inheritance Successfully Created & Confirmed"
                    : "Inheritance Created - Awaiting Confirmation"}
                </p>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    Submission successful. {arweaveStatus !== "confirmed" && "Blockchain confirmation usually takes about 20 minutes."}
                  </p>
                </div>

              </div>
            </div>
            {arweaveStatus !== "confirmed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckArweaveStatus}
                disabled={isCheckingArweave}
                className="h-8 text-xs bg-background/50 hover:bg-background"
              >
                {isCheckingArweave ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                )}
                Check
              </Button>
            )}
          </div>
        </div>

        {/* Created & Confirmed Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-muted/5 p-3">
            <p className="text-sm text-muted-foreground mb-1">Created</p>
            <p className="text-sm font-medium">
              {submissionResult.createdAt
                ? new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
                  .format(new Date(submissionResult.createdAt))
                  .replace(":", ".")
                  .replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toUpperCase()}`)
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/5 p-3">
            <p className="text-sm text-muted-foreground mb-1">Confirmed</p>
            <p className="text-sm font-medium">
              {submissionResult.confirmedAt
                ? new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
                  .format(new Date(submissionResult.confirmedAt))
                  .replace(":", ".")
                  .replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toUpperCase()}`)
                : "Pending"}
            </p>
          </div>
        </div>

        {/* 2. Inheritance ID Hero Section */}
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border bg-card ring-1 ring-border/50 transition-all">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Your Inheritance ID
          </p>
          <div className="relative group w-full max-w-md">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 group-hover:border-primary/30 transition-colors">
              <code className="text-xl sm:text-xl font-mono font-bold text-foreground tracking-tight break-all">
                {submissionResult.vaultId}
              </code>
            </div>

            <div className="mt-4 flex justify-center gap-3">
              <Button
                size="lg"
                onClick={handleCopyVaultId}
                className={`min-w-[140px] shadow-sm transition-all ${copyState === "copied"
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                  : ""
                  }`}
              >
                {copyState === "copied" ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy ID
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={handleDownloadId}
                className="w-12 px-0"
                title="Download ID"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground max-w-xs mx-auto">
            Save this ID safely. You will need it to find and manage your inheritance later.
          </p>
        </div>


        {/* 3. Fraction Keys - Critical Section */}
        {submissionResult.fractionKeys.length > 0 && (
          <div className="rounded-xl border-l-4 border-l-amber-500 border-t border-r border-b border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-amber-50/10 dark:bg-amber-950/10">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
                  Critical: Save Your Fraction Keys
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                These keys are required to decrypt and open the inheritance appropriately. <strong>If you lose them, the inheritance cannot be opened.</strong>
              </p>
            </div>

            <div className="flex justify-center p-5 pt-0">
              <DownloadBackupButton
                vaultId={submissionResult.vaultId || ""}
                fractionKeys={submissionResult.fractionKeys}
                variant="default"
                size="lg"
                className="w-full shadow-md bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
              />
            </div>

            <div className="p-5">
              <FractionKeyList
                fractionKeys={submissionResult.fractionKeys}
                showMinKeysWarning={false}
              />
            </div>
          </div>
        )}

        {/* 4. Secondary Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Inheritance Type */}
          {submissionResult.willType && (
            <div className="rounded-lg border bg-muted/5 p-3">
              <p className="text-sm text-muted-foreground mb-1">Inheritance Type</p>
              <p className="text-sm font-medium">
                {submissionResult.willType === "one-time" ? "One-Time / Immutable" : "Editable"}
              </p>
            </div>
          )}

          {/* Trigger */}
          {submissionResult.triggerType && (
            <div className="rounded-lg border bg-muted/5 p-3">
              <p className="text-sm text-muted-foreground mb-1">Release Condition</p>
              <p className="text-sm font-medium">
                {submissionResult.triggerType === "date"
                  ? `Date: ${submissionResult.triggerDate}`
                  : "By request"}
              </p>
            </div>
          )}

          {/* Transaction IDs */}

          {/* Bitxen Contract Transaction (Hybrid Mode) */}
          {submissionResult.storageType === 'bitxenArweave' && submissionResult.blockchainTxHash && (
            <div className="col-span-1 sm:col-span-2 rounded-lg border bg-muted/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Smart Chain Transaction ({submissionResult.blockchainChain?.toUpperCase() || 'CHAIN'})
                </p>
                <p className="text-sm font-bold font-mono truncate max-w-[200px] sm:max-w-xs">
                  {submissionResult.blockchainTxHash}
                </p>
              </div>
              <a
                href={submissionResult.blockchainChain ? `${getChainConfig(submissionResult.blockchainChain as ChainId).blockExplorer}/tx/${submissionResult.blockchainTxHash}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="text-sm flex items-center gap-1.5 text-primary hover:underline hover:text-primary/80 font-medium whitespace-nowrap"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Arweave Transaction */}
          {submissionResult.arweaveTxId && (
            <div className="col-span-1 sm:col-span-2 rounded-lg border bg-muted/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {submissionResult.storageType === 'bitxenArweave'
                    ? 'Storage Transaction (Arweave)'
                    : 'Blockchain Storage Transaction'}
                </p>
                <p className="text-sm font-bold font-mono truncate max-w-[200px] sm:max-w-xs">
                  {submissionResult.arweaveTxId}
                </p>
              </div>
              <a
                href={getArweaveExplorerUrl(submissionResult.arweaveTxId)}
                target="_blank"
                rel="noreferrer"
                className="text-sm flex items-center gap-1.5 text-primary hover:underline hover:text-primary/80 font-medium whitespace-nowrap"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

      </div>
    );
  }

  // Show loading during health check
  if (isCheckingHealth) {
    return (
      <div className="aui-vault-wizard-tool mt-3 w-full">
        <div className="rounded-2xl border border-border bg-background p-6 dark:border-muted-foreground/15">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Preparing...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If any service is unavailable or wallet is not funded, show error and don't show form
  const hasServiceIssues = healthStatus && (
    !healthStatus.backend.available ||
    !healthStatus.arweave.available ||
    (healthStatus.arweave.hasJwk && !healthStatus.arweave.walletFunded)
  );

  if (hasServiceIssues) {
    // Log unavailable services to console
    const unavailableServices = [];
    if (!healthStatus.backend.available) {
      unavailableServices.push({
        service: "Backend",
        error: healthStatus.backend.error || "Unable to contact backend service",
        url: "http://localhost:7002"
      });
    }
    if (!healthStatus.arweave.available) {
      unavailableServices.push({
        service: "Arweave",
        error: healthStatus.arweave.error || "Unable to contact blockchain storage",
        gateway: healthStatus.arweave.gateway
      });
    }
    if (healthStatus.arweave.hasJwk && !healthStatus.arweave.walletFunded) {
      unavailableServices.push({
        service: "Blockchain Storage Wallet",
        error: "Wallet not funded",
        balance: healthStatus.arweave.walletBalance,
        address: healthStatus.arweave.walletAddress
      });
    }

    console.log("❌ Unavailable services:", unavailableServices);

    return (
      <div className="aui-vault-wizard-tool mt-3 w-full">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300 mb-3">
            ❌ We can't open the form right now because some services are unavailable
          </p>
          <div className="space-y-2 text-xs text-red-600 dark:text-red-400">
            {!healthStatus.backend.available && (
              <div>
                <p className="font-semibold mb-1">• Backend unavailable:</p>
                <p className="ml-4">{healthStatus.backend.error || "Unable to contact backend service"}</p>
                <p className="ml-4 mt-1 text-muted-foreground">
                  Ensure backend is running
                </p>
              </div>
            )}
            {!healthStatus.arweave.available && (
              <div>
                <p className="font-semibold mb-1">•blockchain storage unavailable:</p>
                <p className="ml-4">{healthStatus.arweave.error || "Unable to contact blockchain storage"}</p>
                {healthStatus.arweave.gateway && (
                  <p className="ml-4 mt-1 text-muted-foreground">
                    Gateway: {healthStatus.arweave.gateway}
                  </p>
                )}
              </div>
            )}
            {healthStatus.arweave.hasJwk && !healthStatus.arweave.walletFunded && (
              <div>
                <p className="font-semibold mb-1">•blockchain storage Wallet not funded:</p>
                <p className="ml-4">Wallet needs to be funded to perform transactions</p>
                {healthStatus.arweave.walletAddress && (
                  <p className="ml-4 mt-1 text-muted-foreground">
                    Address: {healthStatus.arweave.walletAddress}
                  </p>
                )}
                {healthStatus.arweave.walletBalance !== null && (
                  <p className="ml-4 mt-1 text-muted-foreground">
                    Balance: {healthStatus.arweave.walletBalance} AR
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">
              Please try again once all services are operational.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If all services are available and wallet is funded, show form directly
  return (
    <div className="aui-vault-wizard-tool mt-3 w-full space-y-3">
      {/* Health Status Success */}
      {/* {healthStatus && healthStatus.backend.available && healthStatus.arweave.available && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm dark:border-green-800 dark:bg-green-950">
          <p className="font-medium text-green-700 dark:text-green-300">
            ✅ All services are available and ready to use
          </p>
          {healthStatus.arweave.gateway && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
             blockchain storage Gateway: {healthStatus.arweave.gateway}
            </p>
          )}
        </div>
      )} */}

      <VaultCreationWizard
        variant="inline"
        open={isOpen}
        onOpenChange={setIsOpen}
        onResult={handleWizardResult}
      />
    </div>
  );
};

