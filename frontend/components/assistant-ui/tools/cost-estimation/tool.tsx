import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

import { CostEstimationWizard } from "./wizard";
import type { CostEstimationResult } from "./types";

export const CostEstimationTool: ToolCallMessagePartComponent<{
  reason?: string;
  metadata?: Record<string, unknown>;
}> = ({ args, toolName }) => {

  // Debug: log tool name to ensure the correct tool is called
  console.log("🔧 CostEstimationTool called with toolName:", toolName);

  const [isOpen, setIsOpen] = useState(true); // Open form directly
  const [estimationResult, setEstimationResult] = useState<CostEstimationResult | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleResult = useCallback(
    (
      result:
        | { status: "success"; data: CostEstimationResult }
        | { status: "error"; message: string },
    ) => {
      if (result.status === "success") {
        setEstimationResult(result.data);
        setIsOpen(false);
      }
    },
    [],
  );

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(
        (args as {
          reason?: string | number | boolean;
        }).reason ?? "",
      ).trim()
      : "";

  // Show result if estimation already exists
  if (estimationResult) {
    return (
      <div className="aui-cost-estimation-tool-completed mt-3 space-y-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
          <p className="font-medium text-green-700 dark:text-green-300">
            💰 Upload Cost Estimate
          </p>
          {reason && (
            <p className="mt-1 text-muted-foreground">{reason}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background p-6 dark:border-muted-foreground/15">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                Estimated Upload Cost: {estimationResult.costAR.toFixed(6)} AR
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs uppercase text-muted-foreground">Data Size</p>
              <p className="mt-1 text-sm font-medium">
                {estimationResult.dataSizeMB} MB
              </p>
              <p className="text-xs text-muted-foreground">
                ({estimationResult.dataSizeBytes.toLocaleString()} bytes / {estimationResult.dataSizeKB} KB)
              </p>
            </div>

            <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
              <p>💡 This is an estimate for uploading to blockchain storage. The final cost may vary slightly.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEstimationResult(null);
                  // Reset form with increment key
                  setIsOpen(true);
                  setResetKey(prev => prev + 1);
                }}
              >
                Calculate Another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show form directly
  return (
    <div className="aui-cost-estimation-tool mt-3 w-full space-y-3">
      <CostEstimationWizard
        key={`wizard-${resetKey}`}
        variant="inline"
        open={isOpen}
        onOpenChange={setIsOpen}
        onResult={handleResult}
      />
    </div>
  );
};

