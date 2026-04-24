// Types for Vault Creation Wizard

// Re-export vault storage types
export type { PendingVault, PendingVaultStatus } from "@/lib/vault-storage";

export type SecurityQuestion = {
  question: string;
  answer: string;
};

export type FormState = {
  willDetails: {
    willType: "one-time" | "editable";
    title: string;
    content: string;
    documents: File[];
  };
  securityQuestions: SecurityQuestion[];
  triggerRelease: {
    triggerType: "date" | "manual";
    triggerDate?: string;
  };
  payment: {
    paymentMethod: "wander";
  };
};


export type SubmissionResult = {
  vaultId: string | null;
  arweaveTxId: string | null;
  message: string | null;
  fractionKeys: string[];
  willType?: "one-time" | "editable";
  createdAt?: string;
  confirmedAt?: string;
  title?: string;
  triggerType?: "date" | "manual";
  triggerDate?: string;
};

export type VaultCreationWizardProps = {
  variant?: "dialog" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStepChange?: (step?: number) => void;
  onResult?: (
    payload:
      | { status: "success"; data: SubmissionResult }
      | { status: "error"; message: string },
  ) => void;
};

export type WizardStep = {
  key: string;
  label: string;
  description?: string;
};
