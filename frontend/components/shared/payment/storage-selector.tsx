"use client";

import { cn } from "@/lib/utils";
import { Database, Link2, Globe, Hexagon } from "lucide-react";
import {
  CHAIN_CONFIG,
  getAvailableChains,
  type ChainId,
} from "@/lib/metamaskWallet";

export type StorageType = "arweave" | "bitxenArweave";

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
    fee: "Network Fee varies (Paid by User)",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-500",
  },
  {
    id: "bitxenArweave" as const,
    name: "Bitxen",
    badge: "BETA",
    description: "Arweave storage + Smart Contract registry",
    details: "Permanent Arweave storage with Bitxen contract tracking on BSC/ETH/Polygon.",
    icon: Link2,
    fee: "BITXEN + AR",
    color: "bg-gradient-to-r from-purple-100 to-orange-100 dark:from-purple-900/30 dark:to-orange-900/30 text-purple-700 dark:text-purple-300",
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{option.name}</h3>
                      {(option as any).badge && (
                        <div className="flex items-center !h-6 rounded-md bg-orange-100 dark:bg-orange-900/50 px-2 py-auto text-[10px] font-bold text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                          {(option as any).badge}
                        </div>
                      )}
                    </div>
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
    </div>
  );
}
