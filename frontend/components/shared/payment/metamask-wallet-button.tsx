"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, ExternalLink, AlertCircle, Smartphone, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, isMobile } from "@/lib/utils";
import {
  connectMetaMask,
  isMetaMaskInstalled,
  formatWalletAddress,
  getConnectedAddress,
  CHAIN_CONFIG,
  type ChainId,
} from "@/lib/metamaskWallet";

interface MetaMaskWalletButtonProps {
  label?: string;
  onClick?: () => Promise<void> | void;
  disabled?: boolean;
  selectedChain?: ChainId;
}

export function MetaMaskWalletButton({
  label = "Pay with MetaMask",
  onClick,
  disabled = false,
  selectedChain = "bsc",
}: MetaMaskWalletButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chainConfig = CHAIN_CONFIG[selectedChain];
  const isInstalled = isMetaMaskInstalled();

  const handleConnect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      let address = await getConnectedAddress();

      if (!address) {
        address = await connectMetaMask();
      }

      setConnectedAddress(address);

      // If onClick provided, execute the payment flow
      if (onClick) {
        await onClick();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect MetaMask");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Selection - same structure as Wander */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Select Payment Method</p>
        <div className="grid gap-3 grid-cols-1">
          {/* MetaMask Option Card - Always selected for Bitxen */}
          <label
            className={cn(
              "cursor-pointer rounded-lg border-2 p-4 transition-all",
              "border-primary bg-primary/5" // Always selected style
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="metamask"
              checked={true}
              readOnly
              className="sr-only"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900">
                <Image
                  src="/metamask-fox.svg"
                  alt="MetaMask"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-sm font-medium">MetaMask</span>
              <span className="text-xs text-muted-foreground text-center">
                {chainConfig.name} ({chainConfig.nativeCurrency.symbol})
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Install MetaMask Prompt */}
      {!isInstalled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                MetaMask Not Detected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Please install MetaMask browser extension to continue with Bitxen payment.
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Install MetaMask
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MetaMask Payment Section */}
      <div className="space-y-3 border-t pt-4">
        {/* Network Fee Info */}
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">
            Network Fee: Gas fee in {chainConfig.nativeCurrency.symbol} (Paid by User)
          </p>
        </div>

        {/* Connect/Pay Button */}
        <Button
          onClick={handleConnect}
          disabled={disabled || isConnecting || !isInstalled}
          className="w-full h-12 py-3 bg-orange-400 hover:bg-orange-500/90 text-white font-medium text-base"
          size="lg"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {connectedAddress ? "Processing..." : "Connecting..."}
            </>
          ) : connectedAddress ? (
            <>
              <div className="flex items-center justify-center rounded-full bg-orange-50 p-1.5 dark:bg-orange-50 h-8 w-8">
                <Image
                  src="/metamask-fox.svg"
                  alt="MetaMask"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
              </div>
              {label}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center rounded-full bg-orange-50 p-1.5 dark:bg-orange-50 h-8 w-8">
                <Image
                  src="/metamask-fox.svg"
                  alt="MetaMask"
                  width={20}
                  height={20}
                  className="w-5 h-5"
                />
              </div>
              Pay with MetaMask
            </>
          )}
        </Button>

        {/* Mobile App Notice */}
        {typeof window !== "undefined" && isMobile() && (
          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  Paying on Mobile?
                </p>
                <p className="text-xs text-muted-foreground">
                  Ensure the MetaMask App is installed on your device.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    <span>App Required</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connected Address Display */}
      {connectedAddress && (
        <p className="text-xs text-center text-muted-foreground">
          Connected: {formatWalletAddress(connectedAddress)}
        </p>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
