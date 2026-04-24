// Types for Cost Estimation Tool

export type SizeUnit = "bytes" | "KB" | "MB" | "GB";

export type CostEstimationFormState = {
  sizeInput: string;
  sizeUnit: SizeUnit;
  usePreset: boolean;
  presetSize: number; // in bytes
};

export type CostEstimationResult = {
  costAR: number;
  costBITXEN: string; // formatted string or raw wei string
  dataSizeBytes: number;
  dataSizeKB: string;
  dataSizeMB: string;
};

export type CostEstimationWizardProps = {
  variant?: "dialog" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStepChange?: (step?: number) => void;
  onResult?: (
    result:
      | { status: "success"; data: CostEstimationResult }
      | { status: "error"; message: string },
  ) => void;
};

export type WizardStep = {
  key: string;
  label: string;
};

