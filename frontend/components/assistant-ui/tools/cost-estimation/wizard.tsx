"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Arweave from "arweave";
import { calculateBitxenFee, formatBitxenAmount, CHAIN_CONFIG, type ChainId } from "@/lib/metamaskWallet";

import type {
  CostEstimationWizardProps,
  SizeUnit,
} from "./types";
import { initialFormState, sizePresets } from "./constants";

// Helper to convert size to bytes
const convertToBytes = (value: number, unit: SizeUnit): number => {
  switch (unit) {
    case "bytes":
      return value;
    case "KB":
      return value * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "GB":
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
};

// Helper to format size
const formatSize = (bytes: number): { value: string; unit: string } => {
  if (bytes === 0) return { value: "0", unit: "Bytes" };
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const rawValue = bytes / Math.pow(k, i);
  // Remove decimal if not needed (e.g. 1.00 becomes 1, 2.50 becomes 2.5)
  const value = rawValue % 1 === 0 ? rawValue.toString() : rawValue.toFixed(2).replace(/\.?0+$/, '');
  return { value, unit: sizes[i] };
};

export function CostEstimationWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
}: CostEstimationWizardProps) {
  const isDialog = variant === "dialog";
  const [sizeInput, setSizeInput] = useState(initialFormState.sizeInput);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(initialFormState.sizeUnit);
  const [usePreset, setUsePreset] = useState(initialFormState.usePreset);
  const [presetSize, setPresetSize] = useState(initialFormState.presetSize);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStepChange?.(0);
  }, [onStepChange]);

  const resetWizard = useCallback(() => {
    setSizeInput(initialFormState.sizeInput);
    setSizeUnit(initialFormState.sizeUnit);
    setUsePreset(initialFormState.usePreset);
    setPresetSize(initialFormState.presetSize);
    setIsCalculating(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (isDialog && !open) {
      resetWizard();
    }
  }, [isDialog, open, resetWizard]);

  // Initialize Arweave
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const handleCalculate = async () => {
    setError(null);
    setIsCalculating(true);

    try {
      let dataSizeBytes: number;

      if (usePreset) {
        dataSizeBytes = presetSize;
      } else {
        const inputValue = parseFloat(sizeInput);
        if (isNaN(inputValue) || inputValue <= 0) {
          setError("Please enter a valid size greater than 0.");
          setIsCalculating(false);
          return;
        }
        dataSizeBytes = convertToBytes(inputValue, sizeUnit);
      }

      // Calculate Arweave Cost
      // Get price for data size in winston (1 AR = 10^12 winston)
      const priceWinston = await arweave.transactions.getPrice(dataSizeBytes);
      const costAR = arweave.ar.winstonToAr(priceWinston); // returns string

      // Calculate Bitxen Registration Fee
      // Assume BSC Testnet for estimation if no chain selected
      const estimationChain: ChainId = "bscTestnet";

      // Bitxen now uses a flat fee regardless of file size
      const feeWei = await calculateBitxenFee(estimationChain);
      const costBITXEN = formatBitxenAmount(feeWei);

      const dataSizeKB = (dataSizeBytes / 1024).toFixed(2);
      const dataSizeMB = (dataSizeBytes / (1024 * 1024)).toFixed(2);

      const result = {
        costAR: parseFloat(costAR),
        costBITXEN,
        dataSizeBytes,
        dataSizeKB,
        dataSizeMB,
      };

      // Send result to parent (tool.tsx) and close wizard
      onResult?.({ status: "success", data: result });
      if (isDialog) {
        onOpenChange?.(false);
      }
    } catch (error) {
      console.error("Error calculating cost:", error);
      setError(error instanceof Error ? error.message : "We couldn't calculate the cost estimation. Please try again.");
      onResult?.({
        status: "error",
        message: error instanceof Error ? error.message : "We couldn't calculate the cost estimation. Please try again.",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Form input */}
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-3">How would you like to enter the data size?</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={usePreset ? "default" : "outline"}
                onClick={() => setUsePreset(true)}
                className="flex-1"
                disabled={isCalculating}
              >
                Choose a Preset
              </Button>
              <Button
                type="button"
                variant={!usePreset ? "default" : "outline"}
                onClick={() => setUsePreset(false)}
                className="flex-1"
                disabled={isCalculating}
              >
                Enter Manually
              </Button>
            </div>
          </div>

          {usePreset ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a file size preset</label>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                {sizePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={presetSize === preset.value ? "default" : "outline"}
                    onClick={() => setPresetSize(preset.value)}
                    className="h-9 py-1.5 px-2 text-xs font-medium"
                    size="sm"
                    disabled={isCalculating}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {presetSize > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selected size: {formatSize(presetSize).value} {formatSize(presetSize).unit}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter the data size</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={sizeInput}
                    disabled={isCalculating}
                    onChange={(e) => {
                      setSizeInput(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isCalculating && sizeInput && parseFloat(sizeInput) > 0) {
                        handleCalculate();
                      }
                    }}
                    className="flex-1"
                  />
                  <select
                    value={sizeUnit}
                    disabled={isCalculating}
                    onChange={(e) => {
                      setSizeUnit(e.target.value as SizeUnit);
                      setError(null);
                    }}
                    className={cn(
                      "flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
                      "focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50",
                      "cursor-pointer"
                    )}
                  >
                    <option value="bytes">Bytes</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>
              {sizeInput && parseFloat(sizeInput) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatSize(convertToBytes(parseFloat(sizeInput) || 0, sizeUnit)).value}{" "}
                  {formatSize(convertToBytes(parseFloat(sizeInput) || 0, sizeUnit)).unit}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating || (usePreset ? presetSize === 0 : !sizeInput || parseFloat(sizeInput) <= 0)}
            className="w-full"
            size="lg"
          >
            {isCalculating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="mr-2 size-4" />
                Calculate Estimated Cost
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Blockchain Storage Upload Cost Estimate</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6 dark:border-muted-foreground/15">
      {content}
    </div>
  );
}
