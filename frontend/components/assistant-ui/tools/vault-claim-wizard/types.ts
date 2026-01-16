// Types for Vault Claim Wizard (Unlock/Claim Inheritance)

export type SecurityQuestionAnswer = {
  question: string;
  answer: string;
};

export type ClaimFormState = {
  // Step 1: Vault ID
  vaultId: string;
  
  // Step 2: Security Questions
  securityQuestionAnswers: SecurityQuestionAnswer[];
  
  // Step 3: Fraction Keys
  fractionKeys: {
    key1: string;
    key2: string;
    key3: string;
  };
  
  // Step 4: Unlock result
  unlocked: boolean;
  vaultContent: string | null;
  error: string | null;
};

export type ClaimSubmissionResult = {
  success: boolean;
  vaultId: string;
  vaultContent: string | null;
  vaultTitle?: string | null;
  message: string | null;
  error?: string;
  documents?: Array<{ name: string; size: number; type: string }>;
};

export type VaultClaimWizardProps = {
  variant?: "dialog" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStepChange?: (step?: number) => void;
  onResult?: (
    payload:
      | { status: "success"; data: ClaimSubmissionResult }
      | { status: "error"; message: string },
  ) => void;
  initialData?: {
    vaultId: string;
    fractionKeys: string[];
    securityQuestionAnswers: { question: string; answer: string }[];
  };
};

export type ClaimWizardStep = {
  key: string;
  label: string;
  description?: string;
};

