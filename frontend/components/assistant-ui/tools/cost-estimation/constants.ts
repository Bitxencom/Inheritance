// Constants for Cost Estimation Wizard

import type { CostEstimationFormState } from "./types";

export const initialFormState: CostEstimationFormState = {
  sizeInput: "",
  sizeUnit: "KB",
  usePreset: true,
  presetSize: 0,
};

// Preset size in bytes
export const sizePresets = [
  { label: "1 KB", value: 1024 },
  { label: "5 KB", value: 5 * 1024 },
  { label: "10 KB", value: 10 * 1024 },
  { label: "50 KB", value: 50 * 1024 },
  { label: "100 KB", value: 100 * 1024 },
  { label: "250 KB", value: 250 * 1024 },
  { label: "500 KB", value: 500 * 1024 },
  { label: "750 KB", value: 750 * 1024 },
  { label: "1 MB", value: 1024 * 1024 },
  { label: "2 MB", value: 2 * 1024 * 1024 },
  { label: "5 MB", value: 5 * 1024 * 1024 },
  { label: "10 MB", value: 10 * 1024 * 1024 },
  { label: "25 MB", value: 25 * 1024 * 1024 },
  { label: "50 MB", value: 50 * 1024 * 1024 },
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "250 MB", value: 250 * 1024 * 1024 },
  { label: "500 MB", value: 500 * 1024 * 1024 },
  { label: "1 GB", value: 1024 * 1024 * 1024 },
];
