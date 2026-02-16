"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, Check, Globe, Link2, Coins, Zap, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  connectMetaMask,
  isMetaMaskInstalled,
  formatWalletAddress,
  getConnectedAddress as getMetaMaskAddress,
  getAvailableChains,
  getRegistrationFee,
  formatBitxenAmount,
  CHAIN_CONFIG,
  type ChainId,
} from "@/lib/metamaskWallet";
import {
  connectWanderWallet,
  isWalletReady as isWanderReady,
  formatWalletAddress as formatArweaveAddress,
  getConnectedAddress as getWanderAddress,
} from "@/lib/wanderWallet";
import WanderLogo from "@/assets/logo/wander.svg";

export type PaymentMode = "wander" | "hybrid";
export type ArweavePaymentPhase = "confirm" | "upload" | "finalize";

interface UnifiedPaymentSelectorProps {
  onSubmit: (mode: PaymentMode, chainId?: ChainId) => Promise<void>;
  isSubmitting?: boolean;
  paymentStatus?: string | null;
  paymentProgress?: number | null;
  paymentPhase?: ArweavePaymentPhase | null;
  isReady?: boolean;
  blockedReason?: string | null;
}

export function UnifiedPaymentSelector({
  onSubmit,
  isSubmitting = false,
  paymentStatus = null,
  paymentProgress = null,
  paymentPhase = null,
  isReady = true,
  blockedReason = null,
}: UnifiedPaymentSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<PaymentMode>("hybrid");
  const [selectedChain, setSelectedChain] = useState<ChainId>("bsc");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet connection states
  const [wanderAddress, setWanderAddress] = useState<string | null>(null);
  const [metaMaskAddress, setMetaMaskAddress] = useState<string | null>(null);
  const [registrationFee, setRegistrationFee] = useState<string | null>(null);

  const availableChains = getAvailableChains();
  const isMetaMaskAvailable = isMetaMaskInstalled();

  // Check existing wallet connections on mount
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const wander = await getWanderAddress();
        if (wander) setWanderAddress(wander);

        const metamask = await getMetaMaskAddress();
        if (metamask) setMetaMaskAddress(metamask);
      } catch {
        // Ignore connection check errors
      }
    };
    checkConnections();
  }, []);

  // Fetch registration fee when chain changes (for hybrid mode)
  useEffect(() => {
    const fetchFee = async () => {
      if (selectedMode !== "hybrid" || !isMetaMaskAvailable) return;
      try {
        const fee = await getRegistrationFee(selectedChain, false);
        setRegistrationFee(formatBitxenAmount(fee));
      } catch {
        setRegistrationFee("~1.00 BITXEN");
      }
    };
    fetchFee();
  }, [selectedChain, selectedMode, isMetaMaskAvailable]);

  const handleProceed = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      if (selectedMode === "wander") {
        // Connect Wander if not connected
        if (!await isWanderReady()) {
          const address = await connectWanderWallet();
          setWanderAddress(address);
        }
        await onSubmit("wander");
      } else {
        // Hybrid mode: need both wallets
        // First connect Wander
        if (!await isWanderReady()) {
          const wanderAddr = await connectWanderWallet();
          setWanderAddress(wanderAddr);
        }

        // Then connect MetaMask
        if (!metaMaskAddress) {
          const mmAddr = await connectMetaMask();
          setMetaMaskAddress(mmAddr);
        }

        await onSubmit("hybrid", selectedChain);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const isProcessing = isConnecting || isSubmitting;
  const isBlocked = !isReady;

  // Determine current step for hybrid mode progress
  const getHybridStep = () => {
    if (!paymentStatus) return 0;
    const status = paymentStatus.toLowerCase();
    if (status.includes("step 2") || status.includes("contract") || status.includes("metamask") || status.includes("registering")) return 2;
    if (status.includes("step 1") || status.includes("arweave") || status.includes("wander")) return 1;
    return 0;
  };

  const getWanderStep = () => {
    if (paymentPhase === "upload" || paymentProgress !== null) return 2;
    if (paymentPhase === "finalize") return 3;
    const status = (paymentStatus || "").toLowerCase();
    if (status.includes("upload") || status.includes("chunk") || status.includes("resuming")) return 2;
    if (status.includes("successful") || status.includes("success")) return 3;
    return 1;
  };

  const normalizedStatus = (paymentStatus || "").toLowerCase();

  const isArweaveConfirming =
    normalizedStatus.includes("waiting for wallet") ||
    normalizedStatus.includes("wallet signature") ||
    normalizedStatus.includes("signature") ||
    normalizedStatus.includes("confirm transaction") ||
    normalizedStatus.includes("confirm in wander") ||
    normalizedStatus.includes("confirm arweave") ||
    normalizedStatus.includes("wallet confirmation") ||
    normalizedStatus.includes("preparing arweave transaction") ||
    normalizedStatus.includes("preparing upload");

  const isArweaveUploadDialogOpen =
    isProcessing &&
    Boolean(paymentStatus) &&
    ((selectedMode === "wander" &&
      !isArweaveConfirming &&
      (paymentPhase === "upload" ||
        (typeof paymentProgress === "number" && paymentProgress >= 0 && paymentProgress < 100) ||
        normalizedStatus.includes("uploading to arweave") ||
        normalizedStatus.includes("uploading to arweave (relay)") ||
        normalizedStatus.includes("upload chunk") ||
        normalizedStatus.includes("resuming arweave upload"))) ||
      (selectedMode === "hybrid" &&
        !isArweaveConfirming &&
        normalizedStatus.includes("step 1/2:") &&
        (normalizedStatus.includes("uploading to arweave") ||
          normalizedStatus.includes("uploading to arweave (relay)") ||
          normalizedStatus.includes("upload chunk") ||
          normalizedStatus.includes("resuming arweave upload"))));

  useEffect(() => {
    if (!isArweaveUploadDialogOpen) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isArweaveUploadDialogOpen]);

  return (
    <div className="space-y-6">
      <Dialog open={isArweaveUploadDialogOpen} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading to Blockchain Storage
            </DialogTitle>
            <DialogDescription>
              Your data is being uploaded to Blockchain Storage. Please keep this tab open until it finishes.
            </DialogDescription>
          </DialogHeader>
          {paymentStatus && (
            <p className="text-sm text-muted-foreground text-center">
              {paymentStatus}
            </p>
          )}
          {typeof paymentProgress === "number" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Upload progress</span>
                <span className="font-medium">{Math.max(0, Math.min(100, Math.floor(paymentProgress)))}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-purple-600 transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, paymentProgress))}%` }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Storage Type Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium mt-3">Choose Your Storage Type</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Bitxen Smart Contract Option - Hybrid (Primary/Left) */}
          <label
            className={cn(
              "cursor-pointer rounded-xl border-2 p-5 hover:shadow-md relative",
              selectedMode === "hybrid"
                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                : "border-border hover:border-emerald-300"
            )}
          >
            <input
              type="radio"
              name="paymentMode"
              value="hybrid"
              checked={selectedMode === "hybrid"}
              onChange={() => setSelectedMode("hybrid")}
              className="sr-only"
              disabled={isProcessing}
            />

            {/* Selection indicator */}
            {selectedMode === "hybrid" && (
              <div className="absolute top-0 right-0 h-6 w-10 rounded-tr-lg rounded-bl-md bg-emerald-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* Icon & Title */}
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">Bitxen Smart Contract + Arweave</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Blockchain-verified storage</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-4 w-4 text-emerald-500" />
                  <span>Verifiable ownership on-chain</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span>Multi-layer verification</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4 text-emerald-500" />
                  <span>Fee: 1 BITXEN + Network Fee varies (Paid by User)</span>
                </div>
              </div>

              {/* Recommended badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 w-fit">
                <Shield className="h-3 w-3" />
                Best Protection
              </div>
            </div>
          </label>

          {/* Arweave Option - Simple Storage (Secondary/Right) */}
          <label
            className={cn(
              "cursor-pointer rounded-xl border-2 p-5 hover:shadow-md relative",
              selectedMode === "wander"
                ? "border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 shadow-sm"
                : "border-border hover:border-slate-400"
            )}
          >
            <input
              type="radio"
              name="paymentMode"
              value="wander"
              checked={selectedMode === "wander"}
              onChange={() => setSelectedMode("wander")}
              className="sr-only"
              disabled={isProcessing}
            />

            {/* Selection indicator */}
            {selectedMode === "wander" && (
              <div className="absolute top-0 right-0 h-6 w-10 rounded-tr-lg rounded-bl-md bg-slate-700 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}

            <div className="flex flex-col gap-4 h-full">
              {/* Icon & Title */}
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-semibold text-base">Arweave</h3>
                  <p className="text-xs text-muted-foreground">Simple permanent storage</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4 text-slate-600" />
                  <span>Only stored on Arweave</span>
                </div>
                {/* <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-purple-500" />
                  <span>One-click process</span>
                </div> */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4 text-slate-600" />
                  <span>Fee: Network Fee varies (Paid by User)</span>
                </div>
              </div>

              {/* Simple badge */}
              <div className="mt-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 w-fit">
                Basic
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Chain Selection - Only for Hybrid */}
      {selectedMode === "hybrid" && (
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium flex items-center gap-2">
            <span>🔗</span>
            Select Blockchain Network
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {availableChains.map((chainId) => {
              const chain = CHAIN_CONFIG[chainId];
              const isChainSelected = selectedChain === chainId;

              return (
                <button
                  key={chainId}
                  type="button"
                  onClick={() => setSelectedChain(chainId)}
                  disabled={isProcessing}
                  className={cn(
                    "rounded-lg border-2 px-2 py-2 text-sm transition-all cursor-pointer",
                    isChainSelected
                      ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 font-medium"
                      : "border-border hover:border-emerald-300 hover:bg-muted/50",
                    isProcessing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {chain.logo && (
                      <div className="h-5 w-5 rounded-full overflow-hidden bg-white/50 p-0.5">
                        <Image
                          src={chain.logo}
                          alt={chain.shortName}
                          width={20}
                          height={20}
                          className="h-full w-full object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                    <span className="text-xs font-medium">{chain.shortName}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fee info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Contract Fee:</span>
            <span className="font-medium text-emerald-600">{registrationFee || "~1.00 BITXEN"}</span>
          </div>
        </div>
      )}

      {/* Hybrid Progress Indicator */}
      {selectedMode === "hybrid" && isProcessing && paymentStatus && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Processing Payment</p>
          <div className="flex items-center gap-3">
            {/* Step 1 */}
            <div className={cn(
              "flex-1 flex items-center gap-3 rounded-lg p-3 transition-all",
              getHybridStep() == 1 ? "bg-purple-100 dark:bg-purple-900/30 animate-pulse" : "bg-muted/50"
            )}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                getHybridStep() >= 1 ? "bg-purple-500 text-white" : "bg-gray-200 text-muted-foreground border"
              )}>
                {getHybridStep() > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0 -mt-1">
                <div className="font-medium truncate">Arweave</div>
                <div className="text-xs text-muted-foreground -mt-1">Wander</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="text-muted-foreground">→</div>

            {/* Step 2 */}
            <div className={cn(
              "flex-1 flex items-center gap-3 rounded-lg p-3 transition-all",
              getHybridStep() >= 2 ? "bg-orange-100 dark:bg-orange-900/30 animate-pulse" : "bg-muted/50"
            )}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                getHybridStep() == 2 ? "bg-orange-500 text-white" : "bg-gray-200 text-muted-foreground border"
              )}>
                {getHybridStep() > 2 ? <Check className="h-3 w-3" /> : "2"}
              </div>
              <div className="flex-1 min-w-0 -mt-1">
                <div className="font-medium truncate">Contract</div>
                <div className="text-xs text-muted-foreground -mt-1">MetaMask</div>
              </div>
            </div>
          </div>

          {/* Status message */}
          {paymentStatus && (
            <p className="text-xs text-center text-muted-foreground">
              {paymentStatus}
            </p>
          )}
        </div>
      )}

      {selectedMode === "wander" && isProcessing && paymentStatus && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Processing Arweave Upload</p>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-lg p-3 transition-all",
                getWanderStep() === 1 ? "bg-purple-100 dark:bg-purple-900/30 animate-pulse" : "bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                  getWanderStep() >= 1 ? "bg-purple-500 text-white" : "bg-gray-200 text-muted-foreground border",
                )}
              >
                {getWanderStep() > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0 -mt-1">
                <div className="font-medium truncate">Confirm & Pay</div>
                <div className="text-xs text-muted-foreground -mt-1">Wander</div>
              </div>
            </div>

            <div className="text-muted-foreground">→</div>

            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-lg p-3 transition-all",
                getWanderStep() === 2
                  ? "bg-purple-100 dark:bg-purple-900/30 animate-pulse"
                  : getWanderStep() > 2
                    ? "bg-muted/50"
                    : "bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                  getWanderStep() === 2 ? "bg-purple-500 text-white" : "bg-gray-200 text-muted-foreground border",
                )}
              >
                {getWanderStep() > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <div className="flex-1 min-w-0 -mt-1">
                <div className="font-medium truncate">Uploading</div>
                <div className="text-xs text-muted-foreground -mt-1">Arweave</div>
              </div>
            </div>
          </div>

          {typeof paymentProgress === "number" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Upload progress</span>
                <span className="font-medium">{Math.max(0, Math.min(100, Math.floor(paymentProgress)))}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-purple-600 transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, paymentProgress))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Keep this tab open during upload, especially for large attachments.
              </p>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {paymentStatus}
          </p>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-2">
        <Button
          onClick={handleProceed}
          disabled={isProcessing || isBlocked}
          className={cn(
            "w-full h-12 text-base font-medium",
            selectedMode === "wander"
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600"
          )}
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {paymentStatus || "Processing..."}
            </>
          ) : selectedMode === "wander" ? (
            <>
              <div className="h-7 w-7 rounded-full overflow-hidden bg-white p-1">
                <Image src={WanderLogo} alt="" className="h-full w-full object-contain" />
              </div>
              Pay with Wander Wallet
            </>
          ) : (
            <>
              <div className="flex items-center mr-2">
                <div className="h-7 w-7 rounded-full overflow-hidden bg-white p-1">
                  <Image src={WanderLogo} alt="" className="h-full w-full object-contain" />
                </div>
                <span className="mx-1">+</span>
                <div className="h-7 w-7 rounded-full overflow-hidden bg-white p-1">
                  <Image src="/metamask-fox.svg" alt="" width={20} height={20} className="h-full w-full object-contain" />
                </div>
              </div>
              Pay with Wander + Metamask
            </>
          )}
        </Button>

        {blockedReason && !isProcessing && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            {blockedReason}
          </p>
        )}

        {/* Helper text */}
        <p className="text-xs text-center text-muted-foreground mt-3">
          {selectedMode === "wander"
            ? isProcessing
              ? "Large uploads can take time. Please keep this page open."
              : "You will be prompted to sign one transaction in Wander Wallet."
            : "You will sign with Wander first, then confirm in MetaMask."}
        </p>
      </div>

      {/* Connected wallets indicator */}
      {(wanderAddress || (selectedMode === "hybrid" && metaMaskAddress)) && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          {wanderAddress && (
            <span className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-full px-2.5 py-1">
              <Image src={WanderLogo} alt="" className="h-3 w-3" />
              {formatArweaveAddress(wanderAddress)}
            </span>
          )}
          {selectedMode === "hybrid" && metaMaskAddress && (
            <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2.5 py-1">
              <Image src="/metamask-fox.svg" alt="" width={12} height={12} className="h-3 w-3" />
              {formatWalletAddress(metaMaskAddress)}
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
