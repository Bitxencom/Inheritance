"use client";

import { AlertTriangle, ExternalLink, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { InsufficientBitxenError } from "@/lib/metamaskWallet";
import { CHAIN_CONFIG } from "@/lib/metamaskWallet";

interface BitxenInsufficientBalanceProps {
  error: InsufficientBitxenError | null;
  walletAddress?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function fmt(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(0);
}

export function BitxenInsufficientBalance({
  error,
  walletAddress,
  onRetry,
  onDismiss,
}: BitxenInsufficientBalanceProps) {
  if (!error) return null;

  const config = CHAIN_CONFIG[error.chainId];
  const isTestnet = config.isTestnet;

  // PancakeSwap URL (testnet vs mainnet)
  const pancakeSwapUrl = isTestnet
    ? "https://pancakeswap.finance/swap?chain=bscTestnet"
    : `https://pancakeswap.finance/swap?outputCurrency=${config.contractAddress}&chain=bsc`;

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress).catch(() => { });
    }
  };

  return (
    <Dialog open={!!error} onOpenChange={(open) => { if (!open) onDismiss?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <div className="flex-shrink-0 rounded-full bg-amber-500/15 p-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            Insufficient BITXEN Balance
          </DialogTitle>
          <DialogDescription>
            You need BITXEN tokens to register your vault on the blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Balance Detail */}
          <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Registration fee</span>
              <span className="font-medium text-foreground">
                {fmt(error.required)} BITXEN
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-medium text-destructive">
                {fmt(error.balance)} BITXEN
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-destructive/5 rounded-b-lg">
              <span className="text-muted-foreground">Shortfall</span>
              <span className="font-semibold text-destructive">
                {fmt(error.shortfall)} BITXEN
              </span>
            </div>
          </div>

          {/* Network info */}
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-2">
            Network:{" "}
            <span className="font-medium text-foreground">{config.name}</span>
            {isTestnet && (
              <span className="ml-1.5 inline-flex items-center rounded-sm bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                Testnet
              </span>
            )}
          </p>

          {/* Testnet / Mainnet actions */}
          {isTestnet ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                On testnet, request BITXEN from the contract owner or use a faucet.
                Copy your wallet address below:
              </p>
              {walletAddress && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full justify-between text-sm shadow-none"
                  onClick={handleCopyAddress}
                >
                  <span className="truncate">{walletAddress}</span>
                  <Copy className="ml-2 h-3.5 w-3.5 flex-shrink-0" />
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="default"
              size="lg"
              className="w-full shadow-none"
              onClick={() => window.open(pancakeSwapUrl, "_blank", "noopener")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Buy BITXEN on PancakeSwap
            </Button>
          )}

          {/* Block Explorer Token Link */}
          <Button
            variant="outline"
            size="lg"
            className="w-full shadow-none"
            onClick={() =>
              window.open(
                `${config.blockExplorer}/token/${config.contractAddress}`,
                "_blank",
                "noopener",
              )
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View BITXEN Token on Explorer
          </Button>
        </div>

        <DialogFooter>
          {onRetry && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={onRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onDismiss}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
