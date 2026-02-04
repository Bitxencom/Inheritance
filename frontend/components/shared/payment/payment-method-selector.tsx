"use client";

import { useEffect, useState } from "react";
import { Smartphone, Download } from "lucide-react";

import { cn, isMobile } from "@/lib/utils";
import { WanderWalletButton } from "./wander-wallet-button";
import WanderLogo from "@/assets/logo/wander.svg";
import Image from "next/image";
import {
  PAYMENT_METHODS_CONFIG,
  isPaymentMethodEnabled,
  getEnabledPaymentMethods,
} from "@/lib/paymentConfig";

export type PaymentMethod = "wander";

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  onWanderPayment: () => Promise<void> | void;

  isSubmitting?: boolean;
  isProcessingPayment?: boolean;
  paymentStatus?: string | null;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  onWanderPayment,

  isSubmitting = false,
  isProcessingPayment = false,
  paymentStatus = null,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const enabledMethods = getEnabledPaymentMethods();
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(isMobile());
  }, []);

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Select Payment Method</p>
        <div
          className={cn(
            "grid gap-3",
            enabledMethods.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {/* Wander Wallet Option */}
          {isPaymentMethodEnabled("wander") && (
            <label
              className={cn(
                "cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                selectedMethod === "wander"
                  ? "border-primary bg-primary/5"
                  : "border-border",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="wander"
                checked={selectedMethod === "wander"}
                onChange={() => onMethodChange("wander")}
                className="sr-only"
                disabled={disabled}
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
                <span className="text-sm font-medium">
                  {PAYMENT_METHODS_CONFIG.wander.name}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  {PAYMENT_METHODS_CONFIG.wander.description}
                </span>
              </div>
            </label>
          )}

        </div>
      </div>

      {/* Wander Wallet Payment */}
      {selectedMethod === "wander" && isPaymentMethodEnabled("wander") && (
        <div className="space-y-3 border-t pt-4">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">
              Network Fee varies (Paid by User)
            </p>
          </div>
          <WanderWalletButton
            label="Pay with Wander Wallet"
            onClick={onWanderPayment}
            disabled={isSubmitting || isProcessingPayment || disabled}
          />

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
                    Ensure the Wander App is installed on your device. Only installed apps can support direct payment.
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
      )}

      {/* Payment Status */}
      {paymentStatus && (
        <p className="text-sm text-muted-foreground text-center">
          {paymentStatus}
        </p>
      )}
    </div>
  );
}
