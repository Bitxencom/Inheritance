"use client";

import { cn } from "@/lib/utils";
import { Database, Link2, Globe, Hexagon } from "lucide-react";
import {
  CHAIN_CONFIG,
  getAvailableChains,
  type ChainId,
} from "@/lib/metamaskWallet";

export type StorageType = "arweave" | "bitxen";

interface StorageSelectorProps {
  selectedStorage: StorageType;
  onStorageChange: (storage: StorageType) => void;
  selectedChain?: ChainId;
  onChainChange?: (chain: ChainId) => void;
  disabled?: boolean;
}

const storageOptions = [
  {
    id: "arweave" as const,
    name: "Arweave",
    description: "Permanent decentralized storage",
    details: "Pay once, store forever. Data persists indefinitely on Arweave network.",
    icon: Globe,
    fee: "~0.0008 AR",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-500",
  },
  {
    id: "bitxen" as const,
    name: "Bitxen",
    description: "Multi-chain blockchain storage",
    details: "Store on BSC, Ethereum, Polygon, Base, or Arbitrum networks.",
    icon: Hexagon,
    fee: "Gas fee varies",
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    borderColor: "border-orange-500",
  },
];

export function StorageSelector({
  selectedStorage,
  onStorageChange,
  selectedChain = "bsc",
  onChainChange,
  disabled = false,
}: StorageSelectorProps) {
  const availableChains = getAvailableChains();

  return (
    <div className="space-y-6">
      {/* Storage Type Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Choose Storage Type</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {storageOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedStorage === option.id;

            return (
              <label
                key={option.id}
                className={cn(
                  "cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md",
                  isSelected
                    ? `${option.borderColor} bg-primary/5 shadow-sm`
                    : "border-border hover:border-primary/30",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <input
                  type="radio"
                  name="storageType"
                  value={option.id}
                  checked={isSelected}
                  onChange={() => onStorageChange(option.id)}
                  className="sr-only"
                  disabled={disabled}
                />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("rounded-lg p-2", option.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{option.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{option.details}</span>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1 text-xs inline-flex items-center gap-1 w-fit">
                    <Database className="h-3 w-3" />
                    Fee: {option.fee}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Chain Selection - Only for Bitxen */}
      {selectedStorage === "bitxen" && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Select Blockchain Network
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableChains.map((chainId) => {
              const chain = CHAIN_CONFIG[chainId];
              const isSelected = selectedChain === chainId;

              return (
                <button
                  key={chainId}
                  type="button"
                  onClick={() => onChainChange?.(chainId)}
                  disabled={disabled}
                  className={cn(
                    "rounded-lg border-2 px-3 py-2 text-sm transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:border-primary/50",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium">{chain.shortName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {chain.nativeCurrency.symbol}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Each network has different gas fees. BSC typically offers the lowest fees.
          </p>
        </div>
      )}
    </div>
  );
}
