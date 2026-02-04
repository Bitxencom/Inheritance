"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, Smartphone, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, isMobile } from "@/lib/utils";
import WanderLogo from "@/assets/logo/wander.svg";
import {
  connectWanderWallet,
  getConnectedAddress,
  formatWalletAddress,
  isUsingWanderConnect,
  preloadWanderConnect,
} from "@/lib/wanderWallet";

interface WanderWalletButtonProps {
  label?: string;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  isSubmitting?: boolean;
  isProcessingPayment?: boolean;
  paymentStatus?: string | null;
}

export function WanderWalletButton({
  label = "Pay with Wander Wallet",
  onClick,
  disabled = false,
  isSubmitting = false,
  isProcessingPayment = false,
  paymentStatus = null,
}: WanderWalletButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Preload Wander Connect script on mount
  useEffect(() => {
    preloadWanderConnect();
    setIsMobileDevice(isMobile());
  }, []);

  const handleConnect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      let address = await getConnectedAddress();

      if (!address) {
        address = await connectWanderWallet();
      }

      setWalletAddress(address);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Wander Wallet");
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePayment = async () => {
    if (!isConnected) {
      await handleConnect();
      return;
    }
    await onClick();
  };

  const isDisabled = disabled || isSubmitting || isProcessingPayment || isConnecting;

  return (
    <div className="space-y-6">
      {/* Payment Method Selection - consistent with MetaMask */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Select Payment Method</p>
        <div className="grid gap-3 grid-cols-1">
          {/* Wander Wallet Option Card - Always selected for Arweave */}
          <label
            className={cn(
              "cursor-pointer rounded-lg border-2 p-4 transition-all",
              "border-primary bg-primary/5" // Always selected style
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="wander"
              checked={true}
              readOnly
              className="sr-only"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Image
                  src={WanderLogo}
                  alt="Wander Wallet"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-sm font-medium">Wander Wallet</span>
              <span className="text-xs text-muted-foreground text-center">
                Arweave (AR)
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Wander Wallet Payment Section */}
      <div className="space-y-3 border-t pt-4">
        {/* Network Fee Info */}
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">
            Network Fee: Network Fee varies (Paid by User)
          </p>
        </div>

        {/* Connect/Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={isDisabled}
          className="w-full h-12 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium text-base"
        >
          {isConnecting ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              Connecting...
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full bg-purple-100 p-1.5 dark:bg-purple-900 h-8 w-8">
                <Image src={WanderLogo} alt="Wander Wallet" />
              </div>
              {label}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full bg-purple-100 p-1.5 dark:bg-purple-900 h-8 w-8">
                <Image src={WanderLogo} alt="Wander Wallet" />
              </div>
              Pay with Wander Wallet
            </div>
          )}
        </Button>

        {/* Mobile App Notice */}
        {isMobileDevice && (
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
                  Ensure the Wander App is installed on your device.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://www.wander.app/"
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
      {isConnected && walletAddress && (
        <p className="text-xs text-center text-muted-foreground">
          Connected: {formatWalletAddress(walletAddress)}
        </p>
      )}

      {/* Payment Status */}
      {paymentStatus && (
        <p className="text-sm text-muted-foreground text-center">
          {paymentStatus}
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