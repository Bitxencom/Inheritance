// Step 2: Security Questions
// Constants for Vault Claim Wizard

import type { ClaimFormState, ClaimWizardStep } from "./types";

export const initialClaimFormState: ClaimFormState = {
  // Step 1: Vault ID
  vaultId: "",
  securityQuestionAnswers: [],
  fractionKeys: {
    key1: "",
    key2: "",
    key3: "",
  },
  unlocked: false,
  vaultContent: null,
  error: null,
};

export const claimSteps: readonly ClaimWizardStep[] = [
  {
    key: "vaultId",
    label: "Inheritance ID",
    description: "Enter your Inheritance ID"
  },
  {
    key: "verification",
    label: "Security Questions",
    description: "Answer security questions"
  },
  {
    // Step 3: Fraction Keys
    key: "fractionKeys",
    label: "Key Verification",
    description: "Enter fraction keys"
  },
  {
    key: "unlock",
    // Step 4: Unlock
    label: "Unlock Vault",
    description: "Access vault content"
  },
  {
    key: "success",
    // Step 5: Success - Show vault content
    label: "Vault Content",
    description: "View inheritance content"
  },
] as const;

